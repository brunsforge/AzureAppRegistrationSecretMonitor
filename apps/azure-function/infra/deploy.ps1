#!/usr/bin/env pwsh
# deploy.ps1 — Build and deploy the AARM Azure Function
#
# Usage:
#   # Full deploy (infra + code):
#   .\infra\deploy.ps1 -ResourceGroup aarm-rg
#
#   # Infra only (no code push):
#   .\infra\deploy.ps1 -ResourceGroup aarm-rg -InfraOnly
#
#   # Code only (re-deploy after code changes, infra already exists):
#   .\infra\deploy.ps1 -ResourceGroup aarm-rg -CodeOnly
#
# Prerequisites: az CLI (logged in), Node.js 20+, npm

param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [string]$Prefix   = 'aarm',
    [string]$Location = 'westeurope',
    [switch]$InfraOnly,
    [switch]$CodeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$fnDir     = Split-Path -Parent $scriptDir   # apps/azure-function

# ── 1. Deploy infrastructure ───────────────────────────────────────────────────
if (-not $CodeOnly) {
    Write-Host "[1/3] Deploying infrastructure to resource group '$ResourceGroup'…" -ForegroundColor Cyan

    $rawOutput = az deployment group create `
        --resource-group $ResourceGroup `
        --template-file "$scriptDir/main.bicep" `
        --parameters "prefix=$Prefix" "location=$Location" `
        --output json

    if ($LASTEXITCODE -ne 0) { throw "Infrastructure deployment failed." }

    $deployment = $rawOutput | ConvertFrom-Json
    $outputs    = $deployment.properties.outputs

    $fnName   = $outputs.functionAppName.value
    $fnUrl    = $outputs.functionAppUrl.value
    $kvName   = $outputs.keyVaultName.value
    $kvUri    = $outputs.keyVaultUri.value
    $stName   = $outputs.storageAccountName.value

    Write-Host ""
    Write-Host "Infrastructure deployed:" -ForegroundColor Green
    Write-Host "  Function App : $fnName"
    Write-Host "  URL          : $fnUrl"
    Write-Host "  Storage      : $stName"
    Write-Host "  Key Vault    : $kvName ($kvUri)"
    Write-Host ""
} else {
    # Resolve function app name from existing deployment
    $fnName = (az functionapp list `
        --resource-group $ResourceGroup `
        --query "[?starts_with(name,'$Prefix-fn')].name | [0]" `
        -o tsv).Trim()

    if (-not $fnName) {
        throw "No function app found in '$ResourceGroup' with prefix '$Prefix-fn'. Run without -CodeOnly first."
    }
    Write-Host "[1/3] Skipped (CodeOnly — using existing function app '$fnName')" -ForegroundColor DarkGray
}

if ($InfraOnly) {
    Write-Host "InfraOnly: skipping code build and deployment." -ForegroundColor DarkGray
    exit 0
}

# ── 2. Build ───────────────────────────────────────────────────────────────────
Write-Host "[2/3] Building function app…" -ForegroundColor Cyan
Push-Location $fnDir
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }
} finally {
    Pop-Location
}
Write-Host "  Build OK"

# ── 3. Deploy code (zip deploy + Oryx build on Azure) ─────────────────────────
Write-Host "[3/3] Deploying code to '$fnName'…" -ForegroundColor Cyan

# Package: compiled output + manifest files (no node_modules — Oryx installs on Azure)
$zipPath = Join-Path ([System.IO.Path]::GetTempPath()) "aarm-fn-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"

$items = @(
    "$fnDir\dist"
    "$fnDir\host.json"
    "$fnDir\package.json"
    "$fnDir\package-lock.json"
)

# Compress-Archive doesn't handle directories well; use 7zip or dotnet zip
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
    foreach ($item in $items) {
        if (Test-Path $item -PathType Container) {
            Get-ChildItem $item -Recurse -File | ForEach-Object {
                $entryName = $_.FullName.Substring($fnDir.Length + 1).Replace('\', '/')
                [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName)
            }
        } elseif (Test-Path $item -PathType Leaf) {
            $entryName = (Split-Path $item -Leaf)
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $item, $entryName)
        }
    }
} finally {
    $zip.Dispose()
}

Write-Host "  Package: $zipPath ($([math]::Round((Get-Item $zipPath).Length / 1MB, 1)) MB)"

az functionapp deployment source config-zip `
    --resource-group $ResourceGroup `
    --name $fnName `
    --src $zipPath `
    --output none

if ($LASTEXITCODE -ne 0) { throw "Code deployment failed." }

Remove-Item $zipPath

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Dashboard : https://$fnName.azurewebsites.net/api/dashboard"
Write-Host "Status    : https://$fnName.azurewebsites.net/api/status?code=<function-key>"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Get the function key: az functionapp keys list -g $ResourceGroup -n $fnName --query 'functionKeys.default' -o tsv"
Write-Host "  2. In MAUI Settings: set Function base URI to https://$fnName.azurewebsites.net and paste the key."
Write-Host "  3. Add your first tenant via the MAUI Tenants page (Cloud Mode)."
