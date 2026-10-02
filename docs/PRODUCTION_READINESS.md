# Production readiness

## Required production schema

LeadMachine requires these Supabase tables:

- `whatsapp_operator_credentials`
- `platform_admins`
- `zero_ui_action_receipts`
- `zero_ui_configs`
- `zero_ui_followups`

The first three were the missing tables identified during the production audit. The migration files already live under `supabase/migrations/`.

## Apply the three hardening migrations

Set a GitHub repository secret named `SUPABASE_DB_URL` containing the production Supabase Postgres connection string, then run:

```text
Actions → Apply production hardening migrations → Run workflow
```

The workflow executes only these idempotent migrations:

1. `20260930040000_zero_ui_hardening.sql`
2. `20260930050000_agent_workforce_execution.sql`
3. `20261001020000_whatsapp_operator_tenant_credentials.sql`

## Verify readiness

After deployment, call:

```text
GET /api/health
```

HTTP 200 means the required schema is present and the WhatsApp Operator URL is configured. HTTP 503 means the application is not production-ready yet; the response includes the missing table names.

## Verify WhatsApp tenant isolation

The repository includes a non-destructive integration check:

```text
READINESS_TENANT_A_ID=...
READINESS_TENANT_A_TOKEN=...
READINESS_TENANT_B_ID=...
READINESS_TENANT_B_TOKEN=...
bun run test:operator-isolation
```

It verifies that two tenant credentials cannot see each other's account and that a cross-tenant account-status request is rejected.


## Quote form protection

The public quote form uses two server-side controls:

- A signed form token issued when the public page is rendered. The server, not the browser, determines when the form session started.
- Durable IP and phone limits stored in `quote_submissions`.

Configure `QUOTE_FORM_TOKEN_SECRET` in production. The existing `WEBHOOK_SECRET` is accepted as a fallback for deployments that already use it.

Database lookup or recording failures fail closed with HTTP 503 rather than allowing the enquiry through.
