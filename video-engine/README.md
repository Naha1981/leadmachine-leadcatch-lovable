# Lead Machine Video Engine

Remotion-based personalised prospect videos for NahaLabs Lead Machine.

## What it does

`MASTER_PROSPECTS.xlsx`
→ deterministic prospect selection
→ `LeadMachineVideo.tsx`
→ one MP4 per prospect
→ optional public Supabase Storage URL
→ `out/prospects/manifest.json`

No manual video editing is required.

The composition is intentionally evidence-led: it uses the spreadsheet's public research fields and labels the leakage section as a research signal rather than asserting that revenue was actually lost.

## First local test

From `video-engine/`:

```bash
bun install
bun run studio
```

Open Remotion Studio and inspect the default composition.

Render the default demo:

```bash
bun run render:one
```

## Batch rendering from the prospect workbook

The workbook can sit in the repository root:

```
/NahaLabs_LeadMachine_Prospects.xlsx
```

Render A+/A/B prospects:

```bash
bun run render:sheet -- --limit=10
```

Render every renderable prospect:

```bash
bun run render:sheet -- --all=true
```

Render a specific tier:

```bash
bun run render:sheet -- --tier=A
```

Use multiple render jobs:

```bash
bun run render:sheet -- --limit=20 --jobs=2
```

Existing videos are skipped unless:

```bash
bun run render:sheet -- --limit=20 --overwrite=true
```

## Public URLs

For today's prospect outreach, set these environment variables locally:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
LEAD_MACHINE_VIDEO_BUCKET=lead-machine-videos
SUPABASE_UPLOAD=true
```

The renderer will create/use a public Storage bucket, upload the MP4s, and write the public URLs into:

```
out/prospects/manifest.json
```

Never commit the service-role key.

## Design

- 1080 × 1920 portrait
- 30fps
- 30 seconds
- Silent / caption-first by design
- Lead Machine green + restrained gold
- Prospect-specific business name, location, research signals, CTA and Demo URL

## Next layer

The same composition can later receive generated voiceover, website screenshots, business logos, QR codes and NahaLLM-generated narration without changing the batch pipeline.
