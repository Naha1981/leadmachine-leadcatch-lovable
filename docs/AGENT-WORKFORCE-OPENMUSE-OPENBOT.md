# NahaLabs Agent Workforce — OpenMuse / OpenBot integration

The first revenue worker is the AI Sales Worker inside LeadMachine.

## Commercial wedge

The worker sells an outcome, not an agent:

- inspect a prospect website;
- collect observable evidence;
- identify conversion/revenue opportunities;
- prepare the next commercial action;
- require approval before prospect-facing execution;
- record receipts for every execution step.

The product loop is:

`public evidence → diagnosis → approval → OpenBot preparation → personalised Remotion asset → WhatsApp execution → action receipts`

## Runtime boundaries

- OpenMuse: personal-agent/application layer with its own server, browser worker, durable task engine, and optional Linux computer.
- OpenBot: execution/runtime layer. NahaLabs connects to a managed Bot through its authenticated AG-UI endpoint.
- LeadMachine / NahaLabs: owns the commercial workflow, tenant identity, evidence model, approval policy, audit semantics, action receipts, and customer experience.
- WhatsApp Operator: executes the business WhatsApp send. It remains a server-side dependency and is never called directly by the browser.
- Remotion worker: renders the personalised prospect video and uploads the finished MP4 to Supabase Storage.

The product must not depend on OpenBot package imports. Keep the connection behind an authenticated HTTP adapter.

## Current implementation

### Sales Worker

`src/lib/agent-workforce.functions.ts`

- persists a `zero_ui_agent_runs` record;
- performs public website research with SSRF protections;
- stores SOURCE-BACKED evidence and findings;
- creates a `sales.revenue_recovery` action;
- creates a durable `zero_ui_approvals` record;
- returns the action/approval IDs to the authenticated UI.

### Approval gate

`src/lib/agent-workforce-execution.functions.ts`

Only an authenticated tenant owner/admin can approve or reject a sales execution action.

Approval is recorded before the worker can claim the action. Rejection changes the action to `rejected`, so the cron worker cannot execute it.

### OpenBot AG-UI

`src/lib/agent-workforce/openbot-agui.server.ts`

Server-only transport:

- `OPENBOT_AGUI_URL`
- `OPENBOT_AGENT_TOKEN`
- `x-openbot-agent-token` authentication;
- standard AG-UI-style `RunAgentInput`;
- SSE event collection with run outcome tracking;
- tenant/action/run identity carried in `forwardedProps`.

The managed agent token authenticates the execution Bot. LeadMachine remains the authoritative source for the human user's approval identity. A full OpenBot user-session/cookie bridge is not claimed as live.

### Action receipts

`drizzle/migrations/0006_agent_workforce_execution.sql`

Each step writes a receipt to `zero_ui_action_receipts`:

- `openbot.prepare`
- `video.render`
- `whatsapp.send`

Statuses include `started`, `completed`, `failed`, `skipped`, and `outcome_unknown`.

### WhatsApp execution

The worker reuses `src/lib/operator.server.ts` and the existing NahaLabs WhatsApp Operator.

A prospect-facing message is only sent after the LeadMachine approval record is `approved`.

### Personalised Remotion

`video-engine/server.mjs`

The existing LeadMachine composition is now exposed through an authenticated HTTP render service. It:

1. bundles the current Remotion composition;
2. renders one prospect-specific MP4;
3. uploads it to Supabase Storage;
4. returns a public video URL and render job ID.

Render deployment configuration lives in `video-engine/render.yaml`.

### Zero-UI worker

`src/lib/zero-ui-worker.server.ts`

The existing Zero-UI cron now claims approved `sales.revenue_recovery` actions before processing the existing follow-up and daily-summary jobs.

Cron route:

`/api/cron/zero-ui`

This is the automation layer that turns an approved plan into execution without requiring the customer to operate a dashboard.

## Environment

### LeadMachine server

`OPENMUSE_BASE_URL`
Health probe: `GET /api/health`

`OPENBOT_BASE_URL`
Discovery probe: `GET /api/copilotkit/info`

`OPENBOT_AGUI_URL`
Managed Bot AG-UI endpoint base. The adapter posts to `/ag-ui`.

`OPENBOT_AGENT_TOKEN`
Server-only managed Agent/Bot token.

`VIDEO_ENGINE_URL`
Base URL for the Rendered Remotion worker.

`VIDEO_ENGINE_API_KEY`
Server-only shared API key between LeadMachine and the video worker.

When optional runtimes are missing, public evidence research still runs. External execution steps record `skipped` rather than pretending they succeeded.

## Deployment state

Code is implemented on:

`feat/agent-workforce-execution-layer`

Pull request:

https://github.com/Naha1981/leadmachine-leadcatch-lovable/pull/2

The branch is intentionally not described as production-live until:

- the Supabase migration is applied;
- the OpenBot managed AG-UI URL/token are configured;
- the Remotion worker is deployed and connected;
- the existing business WhatsApp account is connected;
- CI/browser acceptance is green.

## Next commercial milestone

A prospect run should produce one coherent evidence pack:

**“Here is what we observed → here is the revenue opportunity → here is the proposed fix → here is the personalised proof asset → approve → LeadMachine executes → here is the receipt.”**
