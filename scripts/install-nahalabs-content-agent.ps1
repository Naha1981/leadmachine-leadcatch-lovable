# NahaLabs Content Agent Skill Refresher
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/Jakeschincariol/instagram-agent-skill.git"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VendorRoot = Join-Path $ProjectRoot ".claude\vendor"
$VendorRepo = Join-Path $VendorRoot "instagram-agent-skill"
$ProjectSkills = Join-Path $ProjectRoot ".claude\skills"

Write-Host "NahaLabs Content Agent local refresh"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required for an upstream refresh."
}

New-Item -ItemType Directory -Force -Path $VendorRoot,$ProjectSkills | Out-Null

if (Test-Path $VendorRepo) {
  git -C $VendorRepo fetch --depth 1 origin main
  git -C $VendorRepo reset --hard origin/main
} else {
  git clone --depth 1 $RepoUrl $VendorRepo
}

$SkillDirs = Get-ChildItem (Join-Path $VendorRepo "skills") -Directory | Where-Object { $_.Name -like "ig-*" }
if (-not $SkillDirs) {
  throw "No ig-* skills were found in the upstream repository."
}

foreach ($dir in $SkillDirs) {
  $target = Join-Path $ProjectSkills $dir.Name
  if (Test-Path $target) {
    Remove-Item -Recurse -Force $target
  }
  Copy-Item -Recurse -Force $dir.FullName $target
}

Write-Host "Refreshed $($SkillDirs.Count) ig-* skill directories into $ProjectSkills"
Write-Host "No user-global Claude skills or publishing credentials were changed."
