
# NahaLabs Agent Workforce — OpenMuse / OpenBot integration

The first revenue worker is the AI Sales Worker inside LeadMachine.

## Commercial wedge

The worker is designed to sell an outcome, not an agent:

- inspect a prospect website;
- collect observable evidence;
- identify conversion/revenue opportunities;
- prepare the next commercial action;
- keep external actions behind approval.

The first release is intentionally narrow: website research and evidence-backed diagnosis. That gives NahaLabs a concrete prospect demo before we connect autonomous browser and computer actions.

## Runtime boundaries

- OpenMuse: personal-agent/application layer with its own server, browser worker, durable task engine, and optional Linux computer.
- OpenBot: execution/runtime layer with authenticated AG-UI/CopilotKit routes and computer gateways.
- LeadMachine / NahaLabs: owns the commercial workflow, tenant identity, evidence model, approval policy, audit semantics, and customer experience.

The product must not depend on OpenBot package imports. Keep the connection behind an authenticated HTTP adapter.

## Environment

Optional server variables:

OPENMUSE_BASE_URL
Health probe: GET /api/health

OPENBOT_BASE_URL
Discovery probe: GET /api/copilotkit/info

When either runtime is missing or unreachable, the worker still performs direct public-page research and clearly labels the execution mode.

## Next runtime step

The next implementation layer should add a server-side AG-UI transport for a selected OpenBot agent. Do not expose runtime credentials to the browser. Preserve opaque agent, thread, and run IDs and record approvals before external writes.

OpenMuse's current upstream OpenBot boundary is an extension point rather than a turnkey multi-tenant deployment, so NahaLabs should retain its own policy and tenant boundary.
