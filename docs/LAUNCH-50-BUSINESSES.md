# LeadMachine — Launch checklist for 50 businesses

## Fixed (Oct 1 2026)
- Agent Workforce TypeScript errors (TS4111 index access, exactOptionalPropertyTypes) in
  `agent-workforce-execution.server.ts`, `agent-workforce.functions.ts`, `openbot-agui.server.ts`, `contracts.ts`.
- Security bug: private-IP block regex in `assertPublicResearchUrl` was double-escaped (`\\d`) and never matched,
  so the Sales Worker could fetch 10.x / 127.x / 192.168.x addresses. Now fixed.
- Root error screen typed with `ErrorComponentProps`. `bunx tsgo --noEmit` = 0 errors.

## Prompt for your AI coding assistant
```
Repo: Naha1981/leadmachine-leadcatch-lovable (TanStack Start v1, Supabase, tsconfig strict +
noPropertyAccessFromIndexSignature + exactOptionalPropertyTypes). Typecheck is clean — keep it so.
1. Apply supabase/migrations/20260930030000_zero_ui.sql, 20260930040000_zero_ui_hardening.sql,
   20260930050000_agent_workforce_receipts.sql to the database; every new public table needs GRANTs + RLS.
2. Set CRON_SECRET in the host env and in GitHub Actions secrets (demand-radar, lead-leakage, zero-ui crons).
3. Fix scripts/browser-e2e.mjs ERR_MODULE_NOT_FOUND (add missing dependency to package.json or fix import).
4. Remove className="dark" from <html> in src/routes/__root.tsx; theme-color #ffffff; Toaster theme="light".
5. Replace the single-session Render Baileys operator with WAHA or Evolution API (one session per tenant)
   — required before more than one business connects WhatsApp.
6. For Vercel: route AI calls through OPENROUTER_API_KEY when LOVABLE_API_KEY is absent.
7. Rate-limit /api/public/site-lead (per IP + per slug) to stop spam.
8. Run: bunx tsgo --noEmit && bun run build && the E2E flow (sign up → onboarding → publish /s/slug →
   submit quote → inbox → Score with AI → Draft reply).
```

## Required before onboarding business #2
| Item | Status |
|---|---|
| Multi-tenant WhatsApp (WAHA/Evolution) | Blocker |
| Zero UI + receipts migrations applied | Blocker for Zero UI / Agent Workforce |
| CRON_SECRET set | Blocker for Demand Radar crons |
| Real pricing on landing page | Placeholder |
| Light mode | Pending |
