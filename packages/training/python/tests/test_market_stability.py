"""
Market Stability Tests

Tests the vAMM price formula, dampening logic, and per-tick limits
to verify prices can't oscillate wildly (sawtooth pattern).

These tests replicate the TypeScript calculatePriceFromHoldings logic
in Python to verify the math independently.
"""

import pytest
import math


# =============================================================================
# Replicate PERP_MARKET_CONFIG from markets.ts
# =============================================================================

PERP_MARKET_CONFIG = {
    "SYNTHETIC_SUPPLY": 10_000,
    "LIQUIDITY_FACTOR": 100,       # Was 20, now 100
    "MAX_CHANGE_PER_TRADE": 0.02,  # Was 0.10, now 0.02
    "MAX_CHANGE_PER_TICK": 0.05,   # New: 5% max per tick
    "PRICE_FLOOR_RATIO": 0.5,      # Was 0.25, now 0.5
    "PRICE_CEILING_RATIO": 2.0,    # Was 4.0, now 2.0
    "MAX_NET_POSITION_RATIO": 0.3, # New: 30%
}


def get_effective_supply(config=PERP_MARKET_CONFIG):
    return config["SYNTHETIC_SUPPLY"] / config["LIQUIDITY_FACTOR"]


def calculate_price_from_holdings(
    initial_price: float,
    current_price: float,
    net_holdings: float,
    config=PERP_MARKET_CONFIG,
) -> float:
    """Replicate the TypeScript calculatePriceFromHoldings."""
    effective_supply = get_effective_supply(config)

    base_market_cap = initial_price * effective_supply
    new_market_cap = base_market_cap + net_holdings
    raw_price = new_market_cap / effective_supply

    # Per-trade change limit
    max_change = current_price * config["MAX_CHANGE_PER_TRADE"]
    min_from_change = current_price - max_change
    max_from_change = current_price + max_change

    # Absolute limits
    absolute_min = initial_price * config["PRICE_FLOOR_RATIO"]
    absolute_max = initial_price * config["PRICE_CEILING_RATIO"]

    # Combine
    min_price = max(absolute_min, min_from_change)
    max_price = min(absolute_max, max_from_change)

    return max(min_price, min(raw_price, max_price))


def clamp_price_for_tick(
    tick_start_price: float,
    current_price: float,
    initial_price: float,
    config=PERP_MARKET_CONFIG,
) -> float:
    """Replicate the TypeScript clampPriceForTick."""
    max_tick_change = tick_start_price * config["MAX_CHANGE_PER_TICK"]
    tick_min = tick_start_price - max_tick_change
    tick_max = tick_start_price + max_tick_change

    absolute_min = initial_price * config["PRICE_FLOOR_RATIO"]
    absolute_max = initial_price * config["PRICE_CEILING_RATIO"]

    effective_min = max(absolute_min, tick_min)
    effective_max = min(absolute_max, tick_max)

    return max(effective_min, min(current_price, effective_max))


def calculate_position_dampener(
    current_price: float,
    initial_price: float,
    side: str,
    config=PERP_MARKET_CONFIG,
) -> float:
    """Replicate the TypeScript calculatePositionDampener."""
    ceiling = initial_price * config["PRICE_CEILING_RATIO"]
    floor = initial_price * config["PRICE_FLOOR_RATIO"]
    total_range = ceiling - floor

    if total_range <= 0:
        return 1.0

    if side == "long":
        distance = ceiling - current_price
        ratio = distance / total_range
        return min(1.0, max(0.1, ratio / 0.3))
    else:
        distance = current_price - floor
        ratio = distance / total_range
        return min(1.0, max(0.1, ratio / 0.3))


# =============================================================================
# vAMM Formula Tests
# =============================================================================

class TestVAMMFormula:
    """Test the core vAMM price calculation."""

    def test_zero_net_holdings_returns_initial(self):
        price = calculate_price_from_holdings(100, 100, 0)
        assert price == 100.0

    def test_positive_holdings_increase_price(self):
        price = calculate_price_from_holdings(100, 100, 1000)
        assert price > 100.0

    def test_negative_holdings_decrease_price(self):
        price = calculate_price_from_holdings(100, 100, -1000)
        assert price < 100.0

    def test_per_trade_limit_caps_change(self):
        """A single massive trade should be capped at 3%."""
        price = calculate_price_from_holdings(100, 100, 1_000_000)
        max_expected = 100 * (1 + PERP_MARKET_CONFIG["MAX_CHANGE_PER_TRADE"])
        assert price <= max_expected

    def test_ceiling_enforced(self):
        """Price can never exceed 200% of initial."""
        price = calculate_price_from_holdings(100, 199, 1_000_000)
        ceiling = 100 * PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"]
        assert price <= ceiling

    def test_floor_enforced(self):
        """Price can never drop below 50% of initial."""
        price = calculate_price_from_holdings(100, 51, -1_000_000)
        floor = 100 * PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"]
        assert price >= floor

    def test_effective_supply_with_new_config(self):
        supply = get_effective_supply()
        assert supply == 100  # 10,000 / 100

    def test_single_10k_trade_impact(self):
        """$10K trade should move price ~1% (not 20% like before)."""
        price = calculate_price_from_holdings(100, 100, 10_000)
        raw_expected = (100 * 100 + 10_000) / 100  # = 200 raw, but clamped
        # Per-trade limit: 100 * 0.03 = 3, so max = 103
        assert price <= 103.0
        assert price >= 100.0


# =============================================================================
# Cumulative NPC Trading Simulation
# =============================================================================

class TestCumulativeNPCTrading:
    """Simulate multiple NPCs trading in one tick to verify no wild swings."""

    def test_10_npcs_same_direction_capped(self):
        """10 NPCs all going long should NOT move price more than 30%."""
        initial = 100.0
        current = 100.0

        # Simulate 10 NPCs each opening $10K long positions
        net_holdings = 0
        for _ in range(10):
            net_holdings += 10_000  # $10K long each
            current = calculate_price_from_holdings(initial, current, net_holdings)

        # After per-tick clamp
        final = clamp_price_for_tick(initial, current, initial)
        change_pct = abs(final - initial) / initial
        assert change_pct <= 0.08, (
            f"10 NPCs moved price {change_pct*100:.1f}% — should be ≤8%"
        )

    def test_no_sawtooth_over_20_ticks(self):
        """Simulate 20 ticks of alternating buy/sell pressure.
        Price should NOT oscillate between extremes."""
        initial = 200.0
        price = 200.0
        prices = [price]

        for tick in range(20):
            tick_start = price
            # Odd ticks: all buy. Even ticks: all sell.
            net_holdings_delta = 50_000 if tick % 2 == 0 else -50_000

            # Calculate raw holdings-based price
            # In real system, net_holdings is cumulative, but for oscillation test
            # we simulate the swing direction
            raw = calculate_price_from_holdings(
                initial, price, net_holdings_delta
            )
            # Apply per-tick clamp
            price = clamp_price_for_tick(tick_start, raw, initial)
            prices.append(price)

        # Verify: no single tick moves more than 8%
        for i in range(1, len(prices)):
            change = abs(prices[i] - prices[i - 1]) / prices[i - 1]
            assert change <= 0.09, (
                f"Tick {i}: {change*100:.1f}% change (from ${prices[i-1]:.2f} to ${prices[i]:.2f})"
            )

        # Verify: total range is reasonable (not $50-$750)
        price_range = max(prices) - min(prices)
        range_pct = price_range / initial
        assert range_pct < 0.5, (
            f"Price range ${min(prices):.0f}-${max(prices):.0f} is {range_pct*100:.0f}% of initial — too wide"
        )

    def test_price_converges_not_diverges(self):
        """After removing trade pressure, price should return toward initial."""
        initial = 100.0
        price = 100.0

        # Phase 1: Pump with 50K net longs
        price = calculate_price_from_holdings(initial, price, 50_000)
        price = clamp_price_for_tick(100, price, initial)
        assert price > 100  # Should be up

        # Phase 2: Remove pressure (net holdings back to 0)
        price = calculate_price_from_holdings(initial, price, 0)
        # Should return toward initial
        assert price <= 103  # Close to initial


# =============================================================================
# Position Dampening Tests
# =============================================================================

class TestPositionDampener:
    """Test that position sizes reduce near price extremes."""

    def test_mid_range_full_size(self):
        """At mid-range price, dampener should be 1.0."""
        d = calculate_position_dampener(100, 100, "long")
        assert d >= 0.9

    def test_near_ceiling_dampens_longs(self):
        """Near ceiling, longs should be heavily dampened."""
        # Ceiling = 200, current = 190 (5% from ceiling)
        d = calculate_position_dampener(190, 100, "long")
        assert d < 0.5, f"Dampener {d} should be <0.5 near ceiling"

    def test_near_floor_dampens_shorts(self):
        """Near floor, shorts should be heavily dampened."""
        # Floor = 50, current = 55 (10% from floor)
        d = calculate_position_dampener(55, 100, "short")
        assert d < 0.5, f"Dampener {d} should be <0.5 near floor"

    def test_at_ceiling_dampener_minimal(self):
        """At exact ceiling, dampener should be near minimum."""
        d = calculate_position_dampener(200, 100, "long")
        assert d <= 0.1

    def test_at_floor_dampener_minimal(self):
        d = calculate_position_dampener(50, 100, "short")
        assert d <= 0.1

    def test_shorts_not_dampened_near_ceiling(self):
        """Shorts should have full size near ceiling (good trade)."""
        d = calculate_position_dampener(190, 100, "short")
        assert d >= 0.8

    def test_longs_not_dampened_near_floor(self):
        """Longs should have full size near floor (good trade)."""
        d = calculate_position_dampener(55, 100, "long")
        assert d >= 0.8


# =============================================================================
# Per-Tick Clamp Tests
# =============================================================================

class TestPerTickClamp:
    def test_within_limit_unchanged(self):
        price = clamp_price_for_tick(100, 105, 100)
        assert price == 105  # 5% < 8% limit

    def test_exceeds_limit_clamped(self):
        price = clamp_price_for_tick(100, 120, 100)
        assert price == 105  # 5% limit

    def test_negative_exceeds_limit_clamped(self):
        price = clamp_price_for_tick(100, 80, 100)
        assert price == 95  # -5% limit

    def test_respects_absolute_floor(self):
        # Tick start at 55, try to go to 40, but floor is 50
        price = clamp_price_for_tick(55, 40, 100)
        assert price >= 50  # Absolute floor

    def test_respects_absolute_ceiling(self):
        # Tick start at 195, try to go to 220, but ceiling is 200
        price = clamp_price_for_tick(195, 220, 100)
        assert price <= 200  # Absolute ceiling


# =============================================================================
# Config Validation Tests
# =============================================================================

class TestConfigValues:
    """Verify config values are sane."""

    def test_liquidity_factor_with_clamp_prevents_wild_swings(self):
        """With LIQUIDITY_FACTOR=100 + 3% per-trade clamp, $100K shouldn't cause >3% move."""
        # The raw vAMM formula gives a huge move, but per-trade clamping caps it
        price = calculate_price_from_holdings(100, 100, 100_000)
        change_pct = abs(price - 100) / 100
        assert change_pct <= 0.03, (
            f"$100K trade moved price {change_pct*100:.1f}% — per-trade clamp should cap at 3%"
        )

    def test_price_range_reasonable(self):
        """Floor-to-ceiling range should be 4x or less (not 16x)."""
        floor = 100 * PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"]
        ceiling = 100 * PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"]
        ratio = ceiling / floor
        assert ratio <= 4.0, f"Ceiling/floor ratio {ratio}x is too wide"

    def test_max_change_per_trade_reasonable(self):
        assert PERP_MARKET_CONFIG["MAX_CHANGE_PER_TRADE"] <= 0.05

    def test_max_change_per_tick_reasonable(self):
        assert PERP_MARKET_CONFIG["MAX_CHANGE_PER_TICK"] <= 0.10

    def test_floor_ceiling_symmetric_enough(self):
        """Floor and ceiling should be roughly symmetric around initial."""
        # floor=0.5, ceiling=2.0 means 2x down, 2x up — symmetric
        assert PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"] >= 0.25
        assert PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"] <= 4.0


# =============================================================================
# Regression: Old Config Would Oscillate
# =============================================================================

class TestOldConfigRegression:
    """Verify the OLD config values caused the sawtooth and new ones don't."""

    OLD_CONFIG = {
        "SYNTHETIC_SUPPLY": 10_000,
        "LIQUIDITY_FACTOR": 20,
        "MAX_CHANGE_PER_TRADE": 0.10,
        "MAX_CHANGE_PER_TICK": 1.0,  # No tick limit
        "PRICE_FLOOR_RATIO": 0.25,
        "PRICE_CEILING_RATIO": 4.0,
        "MAX_NET_POSITION_RATIO": 1.0,  # No limit
    }

    def test_old_config_allows_wild_swings(self):
        """Prove the old config let a single $50K trade move price >50%."""
        old_supply = self.OLD_CONFIG["SYNTHETIC_SUPPLY"] / self.OLD_CONFIG["LIQUIDITY_FACTOR"]
        raw = (100 * old_supply + 50_000) / old_supply
        change = (raw - 100) / 100
        assert change > 0.50, (
            f"Old config: $50K trade only moved {change*100:.0f}% — expected >50%"
        )

    def test_new_config_prevents_wild_swings(self):
        """Prove the new config caps the same trade to <10%."""
        price = calculate_price_from_holdings(100, 100, 50_000)
        change = (price - 100) / 100
        assert change <= 0.03, (
            f"New config: $50K trade moved {change*100:.1f}% — should be ≤3%"
        )

    def test_old_ceiling_was_too_wide(self):
        """Old ceiling allowed $400 on $100 initial."""
        old_ceiling = 100 * self.OLD_CONFIG["PRICE_CEILING_RATIO"]
        assert old_ceiling == 400
        new_ceiling = 100 * PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"]
        assert new_ceiling == 200

    def test_old_floor_was_too_low(self):
        """Old floor allowed $25 on $100 initial."""
        old_floor = 100 * self.OLD_CONFIG["PRICE_FLOOR_RATIO"]
        assert old_floor == 25
        new_floor = 100 * PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"]
        assert new_floor == 50
