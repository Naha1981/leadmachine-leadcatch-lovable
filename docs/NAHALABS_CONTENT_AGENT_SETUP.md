# NahaLabs Content Agent Skills

This setup installs the upstream Instagram Agent Skill as a reusable local Claude Code capability and adds a NahaLabs wrapper to the current Lovable-backed LeadMachine repository.

## Canonical LeadMachine repository

- Repository: https://github.com/Naha1981/leadmachine-leadcatch-lovable
- Built with Lovable and synced from Lovable.
- Lovable project editor: https://lovable.dev/projects/779ab8a2-3a42-4b06-8078-9ad14667c2f3
- Live app: https://second-life-ai.lovable.app

## Upstream capability

- Repository: https://github.com/Jakeschincariol/instagram-agent-skill
- License: MIT
- Verified upstream scope: 13 Instagram skills as of 2026-10-02.
- NahaLabs does not copy or modify the upstream repository in this first step; the installer pins the source by repository URL and copies the skill folders locally.

## Windows setup

Run PowerShell from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-nahalabs-content-agent.ps1
```

The installer:
1. Checks Git and Python.
2. Clones/refreshes the upstream repository under `.claude\vendor\instagram-agent-skill`.
3. Copies `skills\ig-*` into the user Claude skills directory.
4. Creates `~\.claude\instagram\voice.md` from the upstream template when it does not exist.
5. Creates `~\.claude\nahalabs\content-agent.md` with NahaLabs operating rules.
6. Does not add API keys or enable autonomous publishing.

## First verification

Open Claude Code in this repository and run:

```text
/ig-reel
```

Then test:

```text
/ig-human
/ig-plan
/ig-repurpose
```

The upstream README explicitly states that nothing is posted until approval; the skills are designed to write and prepare assets rather than silently publish.

## NahaLabs operating mode

Use the wrapper instructions at `~\.claude\nahalabs\content-agent.md` for all NahaLabs work:

Research → Evidence → Opportunity → Content → QA → Human approval → Distribution → Intent → Lead Machine → Revenue → Learning.

Instagram is a channel, not the product.

## Important

Do not configure BLOTATO, APIFY or any other publishing/research credentials during this first setup. We first dogfood the local writing/research skills and validate value. Publishing/API integrations are a separate Council-gated step.
