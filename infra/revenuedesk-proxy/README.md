# revenuedesk proxy Worker (production source of truth)

The public host revenuedesk.nahalabs.co.za is served by Cloudflare Worker
`revenuedesk` (account 655bd72036df93c103f655230cf9ade7). It proxies all traffic
to `revenuedesk-app.naha-thabiso.workers.dev` and serves `/bridge` itself
(workspace-scoped proxy to the publishing service, PayFast link builder,
booking email). The Supabase function `supabase/functions/content-bridge` is
NOT deployed in production (functions gateway 404, verified 22 Oct 2026) - this
Worker is the live bridge.

- `index.backup-20261022.js` - pristine source recovered from the deployed
  Worker's sourcemap on 22 Oct 2026 (pre-radar).
- `settings-20261022.json` - bindings/compat metadata from the same date.
  All six bindings are `secret_text` (CONTENT_API_KEY, PF_*, RESEND_API_KEY)
  and persist across code-only deploys; never put their values in this repo.
- `index.js` - current source. 22 Oct 2026: added the `radar` action
  (GET /v1/radar/weekly passthrough) for the RevUp market-news integration.

Deploy (code only; secrets untouched):
  CLOUDFLARE_API_TOKEN=... wrangler deploy --config infra/revenuedesk-proxy/wrangler.toml
