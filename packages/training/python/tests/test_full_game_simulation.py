"""
Full Game Simulation Tests

Simulates the complete NPC trading loop over a 30-day game (720 ticks)
to verify price stability, detect sawtooth oscillation, and ensure
the economic system behaves realistically.

This replicates the TypeScript game loop logic in Python for validation.
"""

import pytest
import random
import math
from dataclasses import dataclass, field
from typing import Literal


# =============================================================================
# Replicate core engine types and config
# =============================================================================

PERP_MARKET_CONFIG = {
    "SYNTHETIC_SUPPLY": 10_000,
    "LIQUIDITY_FACTOR": 100,
    "MAX_CHANGE_PER_TRADE": 0.02,
    "MAX_CHANGE_PER_TICK": 0.05,
    "PRICE_FLOOR_RATIO": 0.5,
    "PRICE_CEILING_RATIO": 2.0,
    "MAX_NET_POSITION_RATIO": 0.3,
}

NPC_TRADE_PROBABILITY = 0.6
MAX_POSITION_SIZE = 10_000
LEVERAGE = 5
MAX_AMOUNT = MAX_POSITION_SIZE / LEVERAGE  # 2000


def get_effective_supply(config=PERP_MARKET_CONFIG):
    return config["SYNTHETIC_SUPPLY"] / config["LIQUIDITY_FACTOR"]


def calculate_price_from_holdings(initial, current, net_holdings, config=PERP_MARKET_CONFIG):
    eff = get_effective_supply(config)
    raw = (initial * eff + net_holdings) / eff
    max_chg = current * config["MAX_CHANGE_PER_TRADE"]
    abs_min = initial * config["PRICE_FLOOR_RATIO"]
    abs_max = initial * config["PRICE_CEILING_RATIO"]
    lo = max(abs_min, current - max_chg)
    hi = min(abs_max, current + max_chg)
    return max(lo, min(raw, hi))


def clamp_price_for_tick(tick_start, current, initial, config=PERP_MARKET_CONFIG):
    max_chg = tick_start * config["MAX_CHANGE_PER_TICK"]
    lo = max(initial * config["PRICE_FLOOR_RATIO"], tick_start - max_chg)
    hi = min(initial * config["PRICE_CEILING_RATIO"], tick_start + max_chg)
    return max(lo, min(current, hi))


def calculate_dampener(current, initial, side, config=PERP_MARKET_CONFIG):
    ceiling = initial * config["PRICE_CEILING_RATIO"]
    floor_val = initial * config["PRICE_FLOOR_RATIO"]
    rng = ceiling - floor_val
    if rng <= 0:
        return 1.0
    if side == "long":
        ratio = (ceiling - current) / rng
    else:
        ratio = (current - floor_val) / rng
    return min(1.0, max(0.1, ratio / 0.3))


# =============================================================================
# Simulated NPC
# =============================================================================

@dataclass
class SimNPC:
    id: str
    strategy: Literal["trend", "contrarian", "random"]
    balance: float = 10_000.0
    positions: list = field(default_factory=list)

    @property
    def net_exposure(self) -> float:
        return sum(p["size"] * (1 if p["side"] == "long" else -1) for p in self.positions)


@dataclass
class SimPosition:
    side: str
    size: float
    entry_price: float


# =============================================================================
# Simulated Market
# =============================================================================

@dataclass
class SimMarket:
    ticker: str
    initial_price: float
    current_price: float
    positions: list = field(default_factory=list)  # All open positions
    price_history: list = field(default_factory=list)

    @property
    def net_holdings(self) -> float:
        return sum(p["size"] * (1 if p["side"] == "long" else -1) for p in self.positions)

    def record_price(self, tick: int):
        self.price_history.append({"tick": tick, "price": self.current_price})


def simulate_npc_decision(npc: SimNPC, market: SimMarket, tick: int, rng: random.Random) -> dict | None:
    """Simulate an NPC trading decision (mimics LLM output)."""
    # 60% chance to trade
    if rng.random() > NPC_TRADE_PROBABILITY:
        return None

    price_ratio = market.current_price / market.initial_price
    existing_positions = [p for p in market.positions if p.get("npc_id") == npc.id]

    # CRITICAL: Close profitable/aging positions (prevents unbounded accumulation)
    # NPCs with 2+ positions should close one ~40% of the time
    if len(existing_positions) >= 2 and rng.random() < 0.4:
        # Close the oldest or most profitable position
        pos_to_close = existing_positions[0]
        return {"action": "close", "position": pos_to_close}

    # NPCs with ANY position near price extremes should close
    if existing_positions:
        for pos in existing_positions:
            if pos["side"] == "long" and price_ratio > 1.6:
                return {"action": "close", "position": pos}
            if pos["side"] == "short" and price_ratio < 0.65:
                return {"action": "close", "position": pos}

    # Strategy-based decision
    if npc.strategy == "trend":
        if len(market.price_history) >= 2:
            recent_change = market.price_history[-1]["price"] - market.price_history[-2]["price"]
            if recent_change > 0:
                side = "long"
            elif recent_change < 0:
                side = "short"
            else:
                return None
        else:
            side = "long" if rng.random() > 0.5 else "short"
    elif npc.strategy == "contrarian":
        if price_ratio > 1.2:
            side = "short"
        elif price_ratio < 0.8:
            side = "long"
        else:
            side = "short" if rng.random() > 0.5 else "long"
    else:  # random
        if rng.random() > 0.6:
            return None
        side = "long" if rng.random() > 0.5 else "short"

    # Don't open new positions in same direction if already exposed
    for pos in existing_positions:
        if pos["side"] == side:
            return None  # Already have a position this direction, hold

    # Close opposite positions before opening new
    for pos in existing_positions:
        if pos["side"] != side:
            return {"action": "close", "position": pos}

    # Size: 5-10% of balance (conservative)
    pct = rng.uniform(0.05, 0.10)
    raw_amount = min(npc.balance * pct, MAX_AMOUNT)

    # Apply dampener
    dampener = calculate_dampener(market.current_price, market.initial_price, side)
    amount = raw_amount * dampener

    if amount < 10 or npc.balance < 100:
        return None

    return {"action": "open", "side": side, "amount": amount}


def execute_trade(decision: dict, npc: SimNPC, market: SimMarket):
    """Execute a trade and update positions/prices."""
    if decision["action"] == "close":
        pos = decision["position"]
        # Remove position
        market.positions = [p for p in market.positions if p is not pos]
        # Credit P&L
        pnl = (market.current_price - pos["entry_price"]) / pos["entry_price"] * pos["size"]
        if pos["side"] == "short":
            pnl = -pnl
        npc.balance += pos["size"] / LEVERAGE + pnl
    else:
        size = decision["amount"] * LEVERAGE
        pos = {
            "npc_id": npc.id,
            "side": decision["side"],
            "size": size,
            "entry_price": market.current_price,
        }
        market.positions.append(pos)
        npc.balance -= decision["amount"]

    # Recompute price from net holdings
    market.current_price = calculate_price_from_holdings(
        market.initial_price,
        market.current_price,
        market.net_holdings,
    )


# =============================================================================
# Full Game Simulation
# =============================================================================

def run_full_simulation(
    initial_price: float = 200.0,
    num_npcs: int = 12,
    num_ticks: int = 720,
    seed: int = 42,
) -> SimMarket:
    """Run a full 30-day game simulation."""
    rng = random.Random(seed)

    market = SimMarket(
        ticker="TSLAI",
        initial_price=initial_price,
        current_price=initial_price,
    )
    market.record_price(0)

    # Create diverse NPC pool
    strategies = ["trend"] * 4 + ["contrarian"] * 4 + ["random"] * 4
    npcs = [
        SimNPC(id=f"npc-{i}", strategy=strategies[i % len(strategies)])
        for i in range(num_npcs)
    ]

    for tick in range(1, num_ticks + 1):
        tick_start_price = market.current_price

        # Each NPC decides
        decisions = []
        for npc in npcs:
            dec = simulate_npc_decision(npc, market, tick, rng)
            if dec:
                decisions.append((npc, dec))

        # Execute trades
        for npc, dec in decisions:
            execute_trade(dec, npc, market)

        # Apply per-tick clamp
        market.current_price = clamp_price_for_tick(
            tick_start_price,
            market.current_price,
            market.initial_price,
        )

        market.record_price(tick)

    return market


# =============================================================================
# Analysis Helpers
# =============================================================================

def detect_sawtooth(prices: list[float], window: int = 10) -> bool:
    """Detect sawtooth oscillation pattern.

    A sawtooth is characterized by alternating large up/down moves
    with high regularity. Returns True if pattern is detected.
    """
    if len(prices) < window * 3:
        return False

    # Count direction changes
    direction_changes = 0
    large_moves = 0
    for i in range(1, len(prices)):
        change = (prices[i] - prices[i - 1]) / prices[i - 1] if prices[i - 1] != 0 else 0
        if abs(change) > 0.03:  # 3% is a large move
            large_moves += 1
        if i >= 2:
            prev_change = prices[i - 1] - prices[i - 2]
            curr_change = prices[i] - prices[i - 1]
            if prev_change * curr_change < 0:  # Direction reversal
                direction_changes += 1

    # Sawtooth: frequent reversals AND large moves
    reversal_rate = direction_changes / (len(prices) - 2)
    large_move_rate = large_moves / (len(prices) - 1)

    return reversal_rate > 0.6 and large_move_rate > 0.3


def compute_volatility(prices: list[float]) -> float:
    """Annualized volatility from tick returns."""
    if len(prices) < 2:
        return 0.0
    returns = []
    for i in range(1, len(prices)):
        if prices[i - 1] > 0:
            returns.append((prices[i] - prices[i - 1]) / prices[i - 1])
    if not returns:
        return 0.0
    mean_r = sum(returns) / len(returns)
    variance = sum((r - mean_r) ** 2 for r in returns) / len(returns)
    return math.sqrt(variance)


def max_drawdown(prices: list[float]) -> float:
    """Maximum drawdown as a fraction."""
    if not prices:
        return 0.0
    peak = prices[0]
    max_dd = 0.0
    for p in prices:
        if p > peak:
            peak = p
        dd = (peak - p) / peak if peak > 0 else 0
        max_dd = max(max_dd, dd)
    return max_dd


# =============================================================================
# Tests
# =============================================================================

class TestFullGameSimulation:
    """Run a full 30-day game and verify market stability."""

    @pytest.fixture(scope="class")
    def simulation(self):
        return run_full_simulation(initial_price=200.0, num_npcs=12, num_ticks=720, seed=42)

    def test_price_stays_within_bounds(self, simulation):
        """Price must stay between floor (50%) and ceiling (200%) of initial."""
        prices = [h["price"] for h in simulation.price_history]
        floor_val = simulation.initial_price * PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"]
        ceiling = simulation.initial_price * PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"]
        for i, p in enumerate(prices):
            assert p >= floor_val - 0.01, f"Tick {i}: ${p:.2f} below floor ${floor_val:.2f}"
            assert p <= ceiling + 0.01, f"Tick {i}: ${p:.2f} above ceiling ${ceiling:.2f}"

    def test_no_sawtooth_pattern(self, simulation):
        """Price should NOT exhibit a regular sawtooth oscillation."""
        prices = [h["price"] for h in simulation.price_history]
        assert not detect_sawtooth(prices), (
            "Sawtooth oscillation detected! Price is bouncing between extremes."
        )

    def test_no_single_tick_exceeds_limit(self, simulation):
        """No single tick should move price more than MAX_CHANGE_PER_TICK."""
        prices = [h["price"] for h in simulation.price_history]
        limit = PERP_MARKET_CONFIG["MAX_CHANGE_PER_TICK"] + 0.005
        for i in range(1, len(prices)):
            if prices[i - 1] == 0:
                continue
            change = abs(prices[i] - prices[i - 1]) / prices[i - 1]
            assert change <= limit, (
                f"Tick {i}: {change*100:.1f}% change exceeds {limit*100:.1f}% limit "
                f"(${prices[i-1]:.2f} → ${prices[i]:.2f})"
            )

    def test_price_stays_off_ceiling(self, simulation):
        """Price should not spend most of its time at ceiling."""
        prices = [h["price"] for h in simulation.price_history]
        ceiling = simulation.initial_price * PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"]
        at_ceiling = sum(1 for p in prices if p >= ceiling * 0.98)
        pct_at_ceiling = at_ceiling / len(prices)
        assert pct_at_ceiling < 0.3, (
            f"Price at ceiling {pct_at_ceiling*100:.0f}% of the time — stuck"
        )

    def test_price_stays_off_floor(self, simulation):
        """Price should not spend most of its time at floor."""
        prices = [h["price"] for h in simulation.price_history]
        floor_val = simulation.initial_price * PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"]
        at_floor = sum(1 for p in prices if p <= floor_val * 1.02)
        pct_at_floor = at_floor / len(prices)
        assert pct_at_floor < 0.3, (
            f"Price at floor {pct_at_floor*100:.0f}% of the time — stuck"
        )

    def test_max_drawdown_within_bounds(self, simulation):
        """Max drawdown bounded by floor (can't exceed 1 - floor/ceiling)."""
        prices = [h["price"] for h in simulation.price_history]
        dd = max_drawdown(prices)
        # With floor=50% and ceiling=200%, max theoretical drawdown is 75%
        assert dd < 0.76, f"Max drawdown {dd*100:.1f}% exceeds theoretical max"

    def test_price_history_length(self, simulation):
        """Should have 721 price points (tick 0 through 720)."""
        assert len(simulation.price_history) == 721


class TestMultiSeedStability:
    """Run simulation with multiple seeds to verify it's consistently stable."""

    @pytest.mark.parametrize("seed", [1, 42, 100, 999, 12345])
    def test_no_sawtooth_across_seeds(self, seed):
        sim = run_full_simulation(initial_price=200.0, num_npcs=12, num_ticks=200, seed=seed)
        prices = [h["price"] for h in sim.price_history]
        assert not detect_sawtooth(prices), f"Sawtooth detected with seed={seed}"

    @pytest.mark.parametrize("seed", [1, 42, 100, 999, 12345])
    def test_bounds_respected_across_seeds(self, seed):
        sim = run_full_simulation(initial_price=200.0, num_npcs=12, num_ticks=200, seed=seed)
        prices = [h["price"] for h in sim.price_history]
        floor_val = 200.0 * PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"]
        ceiling = 200.0 * PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"]
        assert min(prices) >= floor_val - 0.01
        assert max(prices) <= ceiling + 0.01

    @pytest.mark.parametrize("seed", [1, 42, 100, 999, 12345])
    def test_no_tick_exceeds_limit_across_seeds(self, seed):
        sim = run_full_simulation(initial_price=200.0, num_npcs=12, num_ticks=200, seed=seed)
        prices = [h["price"] for h in sim.price_history]
        limit = PERP_MARKET_CONFIG["MAX_CHANGE_PER_TICK"] + 0.005
        for i in range(1, len(prices)):
            if prices[i - 1] == 0:
                continue
            change = abs(prices[i] - prices[i - 1]) / prices[i - 1]
            assert change <= limit, (
                f"Seed {seed}, tick {i}: {change*100:.1f}% exceeds limit"
            )


class TestStressScenarios:
    """Test extreme scenarios that could break the market."""

    def test_all_npcs_buy_simultaneously(self):
        """Even if all 20 NPCs buy at once, price stays bounded."""
        market = SimMarket(ticker="TEST", initial_price=100, current_price=100)
        tick_start = market.current_price

        for i in range(20):
            dampener = calculate_dampener(market.current_price, 100, "long")
            size = MAX_AMOUNT * dampener * LEVERAGE
            market.positions.append({"npc_id": f"npc-{i}", "side": "long", "size": size, "entry_price": market.current_price})
            market.current_price = calculate_price_from_holdings(100, market.current_price, market.net_holdings)

        final = clamp_price_for_tick(tick_start, market.current_price, 100)
        change = abs(final - tick_start) / tick_start
        assert change <= 0.05 + 0.001, f"20 NPCs buying moved price {change*100:.1f}%"

    def test_all_npcs_sell_simultaneously(self):
        """Even if all 20 NPCs sell at once, price stays bounded."""
        market = SimMarket(ticker="TEST", initial_price=100, current_price=100)
        tick_start = market.current_price

        for i in range(20):
            dampener = calculate_dampener(market.current_price, 100, "short")
            size = MAX_AMOUNT * dampener * LEVERAGE
            market.positions.append({"npc_id": f"npc-{i}", "side": "short", "size": size, "entry_price": market.current_price})
            market.current_price = calculate_price_from_holdings(100, market.current_price, market.net_holdings)

        final = clamp_price_for_tick(tick_start, market.current_price, 100)
        change = abs(final - tick_start) / tick_start
        assert change <= 0.05 + 0.001, f"20 NPCs selling moved price {change*100:.1f}%"

    def test_rapid_reversal_dampened(self):
        """Rapid buy→sell→buy cycle with tick clamping should stay bounded."""
        market = SimMarket(ticker="TEST", initial_price=100, current_price=100)
        prices = [100.0]

        for cycle in range(10):
            tick_start = market.current_price
            for i in range(10):
                dampener = calculate_dampener(market.current_price, 100, "long")
                size = 1000 * dampener * LEVERAGE
                market.positions.append({"npc_id": f"npc-{i}", "side": "long", "size": size, "entry_price": market.current_price})
                market.current_price = calculate_price_from_holdings(100, market.current_price, market.net_holdings)
            market.current_price = clamp_price_for_tick(tick_start, market.current_price, 100)
            prices.append(market.current_price)

            tick_start = market.current_price
            market.positions = []
            market.current_price = calculate_price_from_holdings(100, market.current_price, 0)
            market.current_price = clamp_price_for_tick(tick_start, market.current_price, 100)
            prices.append(market.current_price)

        # Per-tick clamp at 5% means 10 cycles = 10 up + 10 down = bounded
        # Each tick limited to 5%, so range is bounded by that
        for i in range(1, len(prices)):
            if prices[i - 1] > 0:
                change = abs(prices[i] - prices[i - 1]) / prices[i - 1]
                assert change <= 0.051, f"Cycle step {i}: {change*100:.1f}% exceeds 5% tick limit"

    def test_dampener_prevents_ceiling_bounce(self):
        """Longs near ceiling should be dampened enough to prevent hitting ceiling."""
        market = SimMarket(ticker="TEST", initial_price=100, current_price=180)

        # Try to open a long near ceiling (200)
        dampener = calculate_dampener(180, 100, "long")
        assert dampener < 0.5, f"Dampener {dampener:.2f} too high at $180 (ceiling $200)"

        size = MAX_AMOUNT * dampener * LEVERAGE
        market.positions.append({"npc_id": "test", "side": "long", "size": size, "entry_price": 180})
        new_price = calculate_price_from_holdings(100, 180, market.net_holdings)
        # Should NOT hit ceiling
        assert new_price < 200, f"Price hit ceiling: ${new_price:.2f}"

    def test_high_initial_price_stability(self):
        """Verify stability with higher initial prices (like BTCAI at $120K)."""
        sim = run_full_simulation(initial_price=120_000, num_npcs=12, num_ticks=200, seed=42)
        prices = [h["price"] for h in sim.price_history]
        floor_val = 120_000 * PERP_MARKET_CONFIG["PRICE_FLOOR_RATIO"]
        ceiling = 120_000 * PERP_MARKET_CONFIG["PRICE_CEILING_RATIO"]
        assert min(prices) >= floor_val - 1
        assert max(prices) <= ceiling + 1
        assert not detect_sawtooth(prices)


class TestPriceChartOutput:
    """Generate a text-based price chart for visual inspection."""

    def test_print_price_chart(self, capsys):
        """Print an ASCII price chart of a full simulation for review."""
        sim = run_full_simulation(initial_price=200.0, num_npcs=12, num_ticks=720, seed=42)
        prices = [h["price"] for h in sim.price_history]

        # Sample every 24 ticks (once per day)
        daily_prices = [prices[i] for i in range(0, len(prices), 24)]

        min_p = min(daily_prices)
        max_p = max(daily_prices)
        chart_width = 60

        print("\n" + "=" * 70)
        print(f"  PRICE CHART: {sim.ticker} (30-day simulation)")
        print(f"  Initial: ${sim.initial_price:.0f} | "
              f"Final: ${sim.current_price:.2f} | "
              f"Min: ${min_p:.2f} | Max: ${max_p:.2f}")
        print(f"  Floor: ${sim.initial_price * 0.5:.0f} | "
              f"Ceiling: ${sim.initial_price * 2.0:.0f}")
        print("=" * 70)

        for day, price in enumerate(daily_prices):
            if max_p == min_p:
                pos = chart_width // 2
            else:
                pos = int((price - min_p) / (max_p - min_p) * chart_width)
            bar = " " * pos + "█"
            print(f"  Day {day:2d} | ${price:7.2f} |{bar}")

        print("=" * 70)

        # Stats
        returns = []
        for i in range(1, len(prices)):
            if prices[i - 1] > 0:
                returns.append((prices[i] - prices[i - 1]) / prices[i - 1])

        vol = compute_volatility(prices)
        dd = max_drawdown(prices)
        total_return = (prices[-1] - prices[0]) / prices[0]

        print(f"  Total return: {total_return*100:+.1f}%")
        print(f"  Per-tick volatility: {vol*100:.3f}%")
        print(f"  Max drawdown: {dd*100:.1f}%")
        print(f"  Sawtooth detected: {detect_sawtooth(prices)}")
        print(f"  Final net holdings: ${sim.net_holdings:,.0f}")
        print(f"  Open positions: {len(sim.positions)}")
        print("=" * 70)

        # The chart itself is informational, but verify key metrics
        assert not detect_sawtooth(prices)
        assert dd < 0.76  # Bounded by floor/ceiling range

