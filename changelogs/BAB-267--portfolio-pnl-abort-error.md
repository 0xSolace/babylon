**PR:** https://github.com/BabylonSocial/babylon/pull/1279
**Linear:** [BAB-267](https://linear.app/eliza-labs/issue/BAB-267)

### Silence Expected Portfolio Abort Errors on Markets
- Stop intentional `/markets` portfolio refresh cancellations from surfacing as unhandled client errors.
- Keep the existing error behavior for real portfolio breakdown failures, including HTTP and JSON parsing issues.
- Preserve the current portfolio normalization logic while making the fetch path easier to test.
- Add focused unit coverage for success, generic failure, and abort handling.
