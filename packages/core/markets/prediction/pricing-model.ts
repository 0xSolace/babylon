/**
 * Prediction Market Pricing Model Interface
 *
 * Abstracts the pricing calculation so both simulation (CPMM) and
 * onchain (LVR) models can be used interchangeably where appropriate.
 *
 * Implementations:
 * - PredictionPricing (CPMM) — simulation mode, algebraic
 * - OnchainPreviewPricingModel — onchain mode, calls smart contract view functions
 */

export interface PredictionPricingModel {
  /**
   * Get the current price for a side (0-1 range, where 1 = certain).
   */
  getCurrentPrice(
    yesShares: number,
    noShares: number,
    side: 'yes' | 'no'
  ): number;

  /**
   * Calculate shares received for a given USD amount.
   */
  calculateBuy(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    amount: number
  ): {
    sharesBought: number;
    avgPrice: number;
    newYesPrice: number;
    newNoPrice: number;
    priceImpact: number;
  };

  /**
   * Calculate USD received for selling a given number of shares.
   */
  calculateSell(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    shares: number
  ): {
    proceeds: number;
    avgPrice: number;
    newYesPrice: number;
    newNoPrice: number;
    priceImpact: number;
  };
}
