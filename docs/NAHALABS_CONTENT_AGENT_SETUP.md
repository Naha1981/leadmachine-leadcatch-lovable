# NahaLabs Content Agent Skills

The NahaLabs Content Agent is now project-local. No machine-global Claude skill installation is required.

## Canonical LeadMachine repository

- Repository: https://github.com/Naha1981/leadmachine-leadcatch-lovable
- Lovable project: 779ab8a2-3a42-4b06-8078-9ad14667c2f3
- Live app: https://second-life-ai.lovable.app

## Upstream capability

- Repository: https://github.com/Jakeschincariol/instagram-agent-skill
- License: MIT
- Verified upstream scope: 13 Instagram skills as of 2026-10-02.
- Upstream commit pinned in the repository attribution file.
- The upstream skill definitions are vendored under `.claude/skills/ig-*`.

## What is already installed in this repo

The branch contains these project-local skills:

`ig-reel`, `ig-viral`, `ig-caption`, `ig-carousel`, `ig-story`, `ig-profile`, `ig-plan`, `ig-human`, `ig-comment`, `ig-reply`, `ig-dm`, `ig-repurpose`, `ig-audit`.

Claude Code can discover the skills from the repository itself when opened at the project root.

## No PowerShell requirement

PowerShell is not part of the required runtime.

The optional Windows script exists only as a refresh/bootstrap mechanism for an AI coding agent. It syncs the upstream repository into the project-local `.claude/skills/` tree; it does not install anything into `%USERPROFILE%\.claude\skills`.

An AI coding agent can perform the same job with its own terminal/filesystem tooling.

## Verification

From Claude Code in this repository, test:

```text
/ig-reel
/ig-plan
/ig-human
/ig-repurpose
```

Expected behavior is draft/research output, not autonomous publishing.

## NahaLabs operating mode

Research → Evidence → Opportunity → Content → QA → Human approval → Distribution → Intent → Lead Machine → Revenue → Learning.

Rules:

- Facts ≠ AI guesses.
- Preserve provenance for factual claims.
- Never invent statistics, customers, results or partnerships.
- Extract patterns from high-performing content; do not copy it.
- Treat Instagram as a distribution adapter, not the product.
- Human approval is required before public publishing.
- Use public prospect research before requesting confidential customer data.
- Connect commercial intent to Lead Machine rather than optimizing vanity metrics.

## Initial safety boundary

Do not configure BLOTATO, APIFY, Meta publishing credentials or other autonomous distribution credentials during dogfooding. Publishing/API integrations remain a separate Council-gated step.
