# LeadMachine Market Intelligence

## Purpose

Market Intelligence is a permanent dashboard capability. It continuously collects public market evidence for each enabled business, clusters recurring themes, scores evidence strength and freshness, and surfaces the highest-value findings without requiring the owner to type a question.

Product categories:

- `CUSTOMER_PROBLEMS`
- `COMPETITOR_OPPORTUNITIES`
- `UNANSWERED_QUESTIONS`
- `CONTENT_OPPORTUNITIES`
- `LEAD_GENERATION_OPPORTUNITIES`

Dashboard display limits are 3, 5, 7, 4 and 2 respectively. The underlying signal store is not limited to those counts.

## Architecture

```
GitHub scheduler
      ↓
/api/cron/market-intelligence
      ↓
processMarketIntelligence()
      ↓
source adapters
  ├─ existing Demand Radar Reddit evidence
  ├─ public web / competitor reader
  └─ optional Agent Reach adapter
      ↓
normalize → deduplicate → classify → cluster
      ↓
evidence scoring + AI synthesis
      ↓
Supabase market intelligence tables
      ↓
authenticated dashboard server function
      ↓
Market Intelligence panel
```

Agent Reach is an acquisition adapter, not the product name and not a browser dependency.

## Agent Reach validation

The current upstream project documents:

- public webpage reading without credentials;
- YouTube search/transcripts through `yt-dlp`;
- web search through an Exa/MCP path;
- Reddit search/read requiring authenticated session tooling on servers;
- X/Twitter search requiring account/session configuration;
- a `doctor` command for source health checks.

The production integration therefore treats Agent Reach as optional. The application does not fail when its adapter is disabled or unavailable. Existing Reddit Demand Radar remains the independent Reddit pipeline.

Official upstream: https://github.com/Panniantong/Agent-Reach

## Evidence model

Every accepted signal has one or more rows in `market_intelligence_evidence`.

Evidence stores:

- source and source type
- source URL
- external ID
- title and author
- publication/discovery dates
- evidence text
- source metadata
- deterministic evidence hash

A finding separates:

- **Observed claim** — what the evidence directly supports.
- **Inference** — what the system believes the pattern may indicate.
- **Recommended action** — the business response to consider.

One isolated item is capped at low confidence and cannot become a high-evidence signal.

## Freshness

The worker runs every three hours for regular refreshes and once daily for the deeper pass.

The dashboard ranks signals using:

- confidence
- evidence diversity/recurrence
- relevance
- freshness

Expired/stale signals drop out of the active ranking.

Demand Radar continues running separately at its existing five-minute cadence.

## Competitors

Competitors are discovered from the business name, industry, services and location. Owners do not need to enter competitor lists before the feature starts working.

The `market_intelligence_competitors` table also supports later manual add/ignore workflows.

## Feature control

Platform rollout is controlled through:

`market_intelligence_platform_settings.enabled`

Tenant rollout is controlled through:

`business_profiles.market_intelligence_enabled`

Both must allow the feature for the dashboard to render it.

## Quick actions

Market Intelligence never publishes or sends an external action automatically.

Clicking a quick action creates a tenant-scoped Zero UI action record, generates an owner-reviewable draft, writes an execution receipt and audit log, and returns the draft to the dashboard.

Examples:

- FAQ
- offer
- WhatsApp response
- competitor analysis
- counter-offer
- landing-page brief
- article
- auto-reply snippet
- content post
- campaign brief
- lead form
- WhatsApp campaign

The existing WhatsApp transport and Zero UI execution boundaries remain unchanged.

## Environment variables

Server-side only:

```
MARKET_INTELLIGENCE_CRON_SECRET=
MARKET_INTELLIGENCE_MODEL=openai/gpt-6-astra
AGENT_REACH_ENABLED=false
AGENT_REACH_API_URL=
AGENT_REACH_API_KEY=
```

Use the same secret for `MARKET_INTELLIGENCE_CRON_SECRET` and `CRON_SECRET` only when that is intentional. No Agent Reach credential belongs in browser code.

## Operations

Each tenant run records:

- documents collected
- candidate signals
- accepted signals
- duplicates removed
- failures
- start/completion times

A failure for one tenant is caught and recorded so remaining tenants continue processing.

## Known limitations

- X and Reddit session-based collection depends on valid upstream authentication/session setup. Those adapters are optional and isolated.
- Web search uses public search pages and can degrade under provider changes; existing evidence remains available.
- The feature should not be described as second-by-second real-time. The UI reports the last completed worker run.
