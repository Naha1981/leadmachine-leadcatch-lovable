# NahaLabs Content Agent Skill Installer
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/Jakeschincariol/instagram-agent-skill.git"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VendorRoot = Join-Path $ProjectRoot ".claude\vendor"
$VendorRepo = Join-Path $VendorRoot "instagram-agent-skill"
$UserClaude = Join-Path $HOME ".claude"
$UserSkills = Join-Path $UserClaude "skills"
$InstagramHome = Join-Path $UserClaude "instagram"
$NahaLabsHome = Join-Path $UserClaude "nahalabs"

Write-Host "NahaLabs Content Agent setup"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required. Install Git, then rerun this script."
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python is required. Install Python 3.13.x, then rerun this script."
}

New-Item -ItemType Directory -Force -Path $VendorRoot,$UserSkills,$InstagramHome,$NahaLabsHome | Out-Null

if (Test-Path $VendorRepo) {
  Write-Host "Refreshing upstream repository..."
  git -C $VendorRepo fetch --depth 1 origin main
  git -C $VendorRepo reset --hard origin/main
} else {
  Write-Host "Cloning upstream repository..."
  git clone --depth 1 $RepoUrl $VendorRepo
}

$SkillDirs = Get-ChildItem (Join-Path $VendorRepo "skills") -Directory | Where-Object { $_.Name -like "ig-*" }
if (-not $SkillDirs) {
  throw "No ig-* skills were found in the upstream repository."
}

foreach ($dir in $SkillDirs) {
  $target = Join-Path $UserSkills $dir.Name
  if (Test-Path $target) {
    Remove-Item -Recurse -Force $target
  }
  Copy-Item -Recurse -Force $dir.FullName $target
}

$VoiceTemplate = Join-Path $VendorRepo "templates\voice.md"
$VoiceFile = Join-Path $InstagramHome "voice.md"
if (-not (Test-Path $VoiceFile) -and (Test-Path $VoiceTemplate)) {
  Copy-Item $VoiceTemplate $VoiceFile
}

$NahaLabsRules = Join-Path $NahaLabsHome "content-agent.md"
@'
# NahaLabs Content Agent Operating Rules

You are operating as the NahaLabs Content Intelligence Agent.

Mission:
Turn evidence-backed business intelligence into useful content and measurable commercial opportunities.

Core loop:
Research → Evidence → Opportunity → Content → QA → Human Approval → Distribution → Intent → Lead Machine → Revenue → Learning.

Rules:
- NahaLabs is an intelligent systems engineering company / AI Opportunity Engineering.
- Do not frame NahaLabs as a chatbot agency.
- Facts ≠ AI guesses.
- Distinguish source-backed facts, customer-confirmed facts, proposals and assumptions.
- Never invent statistics, customers, results, partnerships or market claims.
- Do not copy viral content. Extract patterns and create original work.
- Prefer South African business context where relevant.
- Content must be useful without requiring a purchase.
- Public prospect research comes before requests for confidential customer data.
- Human approval is required before public publishing.
- Instagram, LinkedIn and other channels are distribution adapters.
- The commercial destination is intent, conversation, qualified lead and revenue—not vanity metrics.
- Reuse existing NahaLabs capabilities before adding dependencies.
- For product/build decisions, audit first and run NahaLabs Council before production code.

When using Instagram skills:
- Use /ig-viral as research input, not as a copying engine.
- Use /ig-reel, /ig-caption, /ig-carousel and /ig-story for production.
- Use /ig-human for QA/humanization.
- Use /ig-repurpose to multiply a researched asset.
- Use /ig-plan as the planning layer.
- Keep publishing manual during the first dogfood phase.
'@ | Set-Content -Encoding UTF8 $NahaLabsRules

Write-Host ""
Write-Host "Installed $($SkillDirs.Count) Instagram skill directories into $UserSkills"
Write-Host "Voice file: $VoiceFile"
Write-Host "NahaLabs rules: $NahaLabsRules"
Write-Host ""
Write-Host "Next: open Claude Code in this repo and run /ig-reel"
