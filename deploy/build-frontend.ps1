# Build frontend for production hosting and stage upload folder
# Usage (PowerShell from repo root):
#   .\deploy\build-frontend.ps1 -ApiUrl "https://api.yourdomain.com/api"

param(
  [Parameter(Mandatory = $true)]
  [string]$ApiUrl
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"
$out = Join-Path $root "deploy\frontend-dist"

Set-Location $frontend

@"
VITE_API_URL=$ApiUrl
"@ | Set-Content -Encoding utf8 ".env.production.local"

Write-Host "Installing deps..."
npm ci

Write-Host "Building with VITE_API_URL=$ApiUrl"
npm run build

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out | Out-Null
Copy-Item -Recurse -Force (Join-Path $frontend "dist\*") $out
Copy-Item -Force (Join-Path $root "deploy\frontend.htaccess") (Join-Path $out ".htaccess")

Write-Host ""
Write-Host "DONE. Upload contents of: $out"
Write-Host "to your hosting public_html / site root."
