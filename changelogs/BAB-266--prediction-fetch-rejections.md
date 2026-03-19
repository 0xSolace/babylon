**PR:** https://github.com/BabylonSocial/babylon/pull/1277
**Linear:** [BAB-266](https://linear.app/eliza-labs/issue/BAB-266/bugmarkets-avoid-unhandled-promise-rejections-when-prediction-market)

### Prediction Market Fetch Error Handling
- Stop `/markets` prediction fetch failures from surfacing as extra unhandled promise rejections in the browser.
- Keep the existing "Failed to load markets." fallback while routing fetch failures through store error state instead of rejected promises.
- Allow the prediction markets store to recover cleanly on the next retry or polling cycle after a failed request.
- Add a regression test covering failed prediction fetches and successful retry recovery.
