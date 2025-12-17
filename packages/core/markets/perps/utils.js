export function shouldLiquidate(currentPrice, liquidationPrice, side) {
  if (side === 'long') {
    return currentPrice <= liquidationPrice;
  }
  return currentPrice >= liquidationPrice;
}
//# sourceMappingURL=utils.js.map
