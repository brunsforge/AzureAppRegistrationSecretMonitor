#!/usr/bin/env pwsh
# deploy.ps1 -- Build and deploy the AARM Azure Function
#
# Usage:
#   # Full deploy (infra + code):
#   .\infra\deploy.ps1 -ResourceGroup aarm-dev-rg
#
#   # Infra only (no code push):
#   .\infra\deploy.ps1 -ResourceGroup aarm-dev-rg -InfraOnly
#
#   # Code only (re-deploy after code changes, infra already exists):
#   .\infra\deploy.ps1 -ResourceGroup aarm-dev-rg -CodeOnly
#
# Prerequisites: az CLI (logged in), azure-functions-core-tools v4, Node.js 20+, npm
#
# DEPLOYMENT NOTE
# ---------------
# The repository uses npm workspaces. All packages (@azure/functions, Azure SDKs, ...) are
# hoisted to the root node_modules/, not the local apps/azure-function/node_modules/.
# func azure functionapp publish only packages the local directory -- without the root
# node_modules/ all dependencies are missing.
#
# Solution: a _deploy/ subdirectory with
#   - its own package.json (only @azure/functions as dependency, no workspace reference)
#   - a fresh npm install
#   - the esbuild bundle (dist/index.js) that embeds all other dependencies
#
# Additional esbuild requirements:
#   - banner: createRequire -- CJS packages bundled into ESM need require() for Node built-ins
#   - @azure/identity-cache-persistence as external + dynamic import -- Windows/macOS keychain
#     addon, not available on Linux/Azure; fails gracefully via try/catch
#   - initializeStorage() called non-blocking (.catch()) -- a top-level await that throws
#     prevents all function registrations

param(
    [string]$ResourceGroup   = 'aarm-dev-rg',
    [string]$Prefix         = 'aarm',
    [string]$Environment    = 'dev',
    [string]$Location       = 'westeurope',
    [string]$DeploymentName = 'aarm-deploy',
    [switch]$InfraOnly,
    [switch]$CodeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot  = Resolve-Path (Join-Path $PSScriptRoot '..\..\..') # repo root
$fnDir     = Join-Path $repoRoot 'apps\azure-function'
$deployDir = Join-Path $fnDir '_deploy'
$infraDir  = Join-Path $repoRoot 'infra'

# == 1. Deploy infrastructure ==================================================

if (-not $CodeOnly) {
    Write-Host "[1/3] Deploying infrastructure to resource group '$ResourceGroup'..." -ForegroundColor Cyan

    $rawOutput = az deployment group create `
        --resource-group $ResourceGroup `
        --template-file "$infraDir\main.bicep" `
        --parameters "$infraDir\main.bicepparam" `
        --name $DeploymentName `
        --output json

    if ($LASTEXITCODE -ne 0) { throw 'Infrastructure deployment failed.' }

    $outputs    = ($rawOutput | ConvertFrom-Json).properties.outputs
    $fnName     = $outputs.functionAppName.value
    $fnHostname = $outputs.functionAppHostname.value
    $stName     = $outputs.storageAccountName.value
    $kvName     = $outputs.keyVaultName.value

    Write-Host "  Function App  : $fnName"
    Write-Host "  Hostname      : $fnHostname"
    Write-Host "  Storage       : $stName"
    Write-Host "  Key Vault     : $kvName"
} else {
    $fnNameRaw = az functionapp list `
        --resource-group $ResourceGroup `
        --query "[?starts_with(name,'$Prefix-$Environment-fn')].name | [0]" `
        -o tsv
    $fnName = if ($fnNameRaw) { $fnNameRaw.Trim() } else { '' }

    if (-not $fnName) {
        throw "No function app found in '$ResourceGroup' with prefix '$Prefix-$Environment-fn'. Run without -CodeOnly first."
    }

    $fnHostnameRaw = az functionapp show `
        --resource-group $ResourceGroup `
        --name $fnName `
        --query defaultHostName `
        -o tsv 2>$null
    $fnHostname = if ($fnHostnameRaw) { $fnHostnameRaw.Trim() } else { "$fnName.azurewebsites.net" }

    Write-Host "[1/3] Skipped (CodeOnly -- using existing function app '$fnName')" -ForegroundColor DarkGray
}

if ($InfraOnly) {
    Write-Host 'InfraOnly: skipping code build and deployment.' -ForegroundColor DarkGray
    exit 0
}

# == 2. Build ==================================================================

Write-Host '[2/3] Building function app...' -ForegroundColor Cyan

Write-Host '  Building @brunsforge/azure-app-registration-monitor...'
npm run build --prefix (Join-Path $repoRoot 'packages\core') 2>&1 | Select-Object -Last 3

Write-Host '  Running esbuild...'
Push-Location $fnDir
try {
    node esbuild.mjs
    if ($LASTEXITCODE -ne 0) { throw 'esbuild failed.' }
} finally {
    Pop-Location
}

if (-not (Test-Path "$deployDir\node_modules\cookie")) {
    Write-Host '  Setting up _deploy/node_modules (@azure/functions + dependencies)...'
    npm install --prefix $deployDir --omit=dev 2>&1 | Select-Object -Last 2
}

Copy-Item "$fnDir\dist\index.js" "$deployDir\dist\index.js" -Force
$bundleKB = [math]::Round((Get-Item "$deployDir\dist\index.js").Length / 1KB)
Write-Host "  Bundle: $bundleKB KB"

# == 3. Deploy code ============================================================

Write-Host "[3/3] Deploying code to '$fnName'..." -ForegroundColor Cyan

Push-Location $deployDir
try {
    func azure functionapp publish $fnName --no-build
    if ($LASTEXITCODE -ne 0) { throw 'Code deployment failed.' }
} finally {
    Pop-Location
}

# == Summary ===================================================================

$fnKey = (az functionapp keys list `
    --resource-group $ResourceGroup `
    --name $fnName `
    --query 'functionKeys.default' -o tsv 2>$null).Trim()

Write-Host ''
Write-Host 'Deployment complete.' -ForegroundColor Green
Write-Host ''
Write-Host "Function App  : https://$fnHostname"
Write-Host "Dashboard     : https://$fnHostname/api/dashboard"
Write-Host "Status        : https://$fnHostname/api/status"
if ($fnKey) {
    Write-Host "Function Key  : $fnKey"
}
Write-Host ''
Write-Host 'Next steps:'
Write-Host '  Add your first tenant/scan job:'
Write-Host "  .\infra\setup-tenant.ps1 -ResourceGroup $ResourceGroup -DeploymentName $DeploymentName"
