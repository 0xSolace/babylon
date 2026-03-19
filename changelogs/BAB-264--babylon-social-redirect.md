**PR:** https://github.com/BabylonSocial/babylon/pull/1271
**Linear:** [BAB-264](https://linear.app/eliza-labs/issue/BAB-264/buginfra-babylonsocial-redirects-to-expireddomains-and-breaks)

### Canonical Redirects for Legacy babylon.social Traffic
- Redirect restored `babylon.social` traffic to Babylon's live production domains instead of serving app and API traffic on a legacy hostname.
- Keep public/share paths on `babylon.market` and send app/API paths to `play.babylon.market`.
- Remove duplicate waitlist host parsing in middleware by reusing the shared host-routing helper.
- Add unit coverage for legacy hostname detection and canonical path routing.
- Infra note: the live outage still requires `babylon.social` to be restored and attached to the Babylon Vercel project.
