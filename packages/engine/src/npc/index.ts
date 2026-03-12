/**
 * NPC (Non-Player Character) Module
 *
 * Provides portfolio management, investment strategies, and trading logic for NPCs.
 */

export {
  NPCInvestmentManager,
  type PortfolioMetrics,
  type PortfolioPosition,
  type RebalanceAction,
} from './npc-investment-manager';

export {
  NPCPortfolioStrategy,
  type StrategyConfig,
} from './npc-portfolio-strategy';

export {
  buildFallbackMetricsByPool,
  getEffectiveLeverage,
  getPositionExposure,
  type FallbackPerpRow,
  type FallbackPositionRow,
  type PoolMetrics,
} from './portfolio-metrics';

export {
  formatTradingStrategyBias,
  getNpcTradingStrategy,
  TRADING_STRATEGIES,
  type TradingStrategyBias,
  type TradingStrategyConfig,
} from './trading-strategies';
