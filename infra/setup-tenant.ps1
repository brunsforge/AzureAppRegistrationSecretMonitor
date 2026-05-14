#!/usr/bin/env pwsh
# setup-tenant.ps1 -- Interaktive Einrichtung eines neuen Scan-Jobs
#
# Das Script:
#   1. Liest Deployment-Outputs (Function App, Storage, Key Vault)
#   2. Fragt Tenant-spezifische Parameter ab
#   3. Speichert den Client Secret in Key Vault
#   4. Legt den Job in jobs.json (Blob Storage) an
#
# Verwendung:
#   .\infra\setup-tenant.ps1 -ResourceGroup aarm-dev-rg
#
# Voraussetzungen:
#   - az CLI, angemeldet mit ausreichenden Rechten
#   - Bicep-Deployment bereits durchgefuehrt

param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [string]$DeploymentName = 'aarm-deploy'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# == Hilfsfunktionen ===========================================================

function Ask([string]$Prompt, [string]$Default = '') {
    $hint = if ($Default) { " [$Default]" } else { '' }
    $raw  = Read-Host "$Prompt$hint"
    if ($raw.Trim() -eq '' -and $Default -ne '') { return $Default }
    return $raw.Trim()
}

function AskSecret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    return [System.Net.NetworkCredential]::new('', $secure).Password
}

function AskYesNo([string]$Prompt, [bool]$Default = $false) {
    $hint = if ($Default) { 'J/n' } else { 'j/N' }
    $raw  = Read-Host "$Prompt [$hint]"
    if ($raw.Trim() -eq '') { return $Default }
    return $raw.Trim() -match '^[jJyY]'
}

function Slugify([string]$Text) {
    $slug = $Text.ToLower() -replace '[^a-z0-9]+', '-' -replace '^-+|-+$', ''
    return $slug.Substring(0, [Math]::Min($slug.Length, 40))
}

# == 1. Deployment-Outputs lesen ===============================================

Write-Host ''
Write-Host 'AARM Tenant Setup' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "Lese Deployment-Outputs aus '$ResourceGroup' / '$DeploymentName'..."

$rawOutputs = az deployment group show `
    --resource-group $ResourceGroup `
    --name $DeploymentName `
    --query properties.outputs `
    -o json 2>$null

if (-not $rawOutputs) {
    Write-Host ''
    Write-Warning "Deployment '$DeploymentName' nicht gefunden. Bitte Werte manuell eingeben."
    $fnName       = Ask 'Function App Name'
    $fnHostname   = Ask 'Function App Hostname (z.B. aarm-dev-fn.azurewebsites.net)'
    $stName       = Ask 'Storage Account Name'
    $kvName       = Ask 'Key Vault Name'
} else {
    $outputs      = $rawOutputs | ConvertFrom-Json
    $fnName       = $outputs.functionAppName.value
    $fnHostname   = $outputs.functionAppHostname.value
    $stName       = $outputs.storageAccountName.value
    $kvName       = $outputs.keyVaultName.value

    Write-Host "  Function App  : $fnName"
    Write-Host "  Hostname      : $fnHostname"
    Write-Host "  Storage       : $stName"
    Write-Host "  Key Vault     : $kvName"
}

Write-Host ''

# == 2. Tenant-Parameter abfragen ==============================================

Write-Host 'Tenant-Konfiguration' -ForegroundColor Yellow
Write-Host '--------------------'

$tenantDisplayName = Ask 'Tenant-Anzeigename (z.B. Contoso Corporation)'
$tenantId          = Ask 'Tenant-ID (GUID des Zieltenants)'

Write-Host ''
Write-Host 'Auth-Modus' -ForegroundColor Yellow
Write-Host '  1  client-secret                 (App Registration + Client Secret)'
Write-Host '  2  workload-identity-federation  (passwortlos via UAMI)'
$authChoice = Ask 'Auswahl' '1'

$authMode      = if ($authChoice -eq '2') { 'workload-identity-federation' } else { 'client-secret' }
$clientId      = Ask 'Client-ID der App Registration im Zieltenant'
$credentialRef = $null
$credValue     = $null

if ($authMode -eq 'client-secret') {
    Write-Host ''
    Write-Host 'Client Secret' -ForegroundColor Yellow
    $credValue = AskSecret 'Client Secret Wert (wird direkt in Key Vault gespeichert)'
    $jobId     = Slugify $tenantDisplayName
    $credentialRef = "aarm-$jobId"
}

# == 3. Schedule ===============================================================

Write-Host ''
Write-Host 'Scan-Zeitplan' -ForegroundColor Yellow
$intervalDays = Ask 'Scan-Intervall in Tagen' '1'
$runAtUtc     = Ask 'Scan-Uhrzeit UTC (HH:mm)' '06:00'

# == 4. Benachrichtigungsschwellenwerte ========================================

Write-Host ''
Write-Host 'Benachrichtigungsschwellenwerte' -ForegroundColor Yellow
$expiringDays = Ask 'Secrets ablaufend innerhalb von (Tagen)' '30'
$criticalDays = Ask 'Secrets kritisch innerhalb von (Tagen)' '7'

# == 5. Teams-Webhooks (optional) ==============================================

Write-Host ''
$useWebhooks   = AskYesNo 'Teams-Webhooks konfigurieren?' $false
$webhookStatus = $null
$webhookAlerts = $null
$webhookErrors = $null

if ($useWebhooks) {
    Write-Host 'Teams-Webhooks (leer lassen um zu ueberspringen)' -ForegroundColor Yellow
    $raw = Ask 'Webhook Status (taegl. Zusammenfassung)'
    if ($raw -ne '') { $webhookStatus = $raw }
    $raw = Ask 'Webhook Alerts (ablaufende/kritische Secrets)'
    if ($raw -ne '') { $webhookAlerts = $raw }
    $raw = Ask 'Webhook Errors (Scan-Fehler)'
    if ($raw -ne '') { $webhookErrors = $raw }
}

# == 6. Mail-Benachrichtigungen (optional, erfordert ACS) ======================

Write-Host ''
$useMailTargets = AskYesNo 'E-Mail-Benachrichtigungen via ACS konfigurieren?' $false
$mailTo         = $null
$mailSendExpiring = $true
$mailSendCritical = $true
$mailSendStatus   = $false
$mailSendError    = $true

if ($useMailTargets) {
    Write-Host 'Mail-Empfaenger (kommagetrennt)' -ForegroundColor Yellow
    $raw = Ask 'Empfaenger-Adressen (z.B. ops@contoso.com,sec@contoso.com)'
    if ($raw -ne '') { $mailTo = $raw }
    $mailSendExpiring = AskYesNo 'Senden bei ablaufenden Secrets?' $true
    $mailSendCritical = AskYesNo 'Senden bei kritischen Secrets?' $true
    $mailSendStatus   = AskYesNo 'Senden nach jedem Scan (Statusbericht)?' $false
    $mailSendError    = AskYesNo 'Senden bei Scan-Fehler?' $true
}

# == 7. Log Analytics (optional) ===============================================

Write-Host ''
$useLogAnalytics = AskYesNo 'Log Analytics / Sign-in-Log-Analyse aktivieren?' $false
$laWorkspaceId   = $null

if ($useLogAnalytics) {
    $laWorkspaceId = Ask 'Log Analytics Workspace-ID (GUID)'
}

# == 8. Zusammenfassung ========================================================

$jobId = Slugify $tenantDisplayName

Write-Host ''
Write-Host 'Zusammenfassung' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host "  Job-ID          : $jobId"
Write-Host "  Tenant          : $tenantDisplayName ($tenantId)"
Write-Host "  Auth-Modus      : $authMode"
Write-Host "  Client-ID       : $clientId"
if ($credentialRef) {
    Write-Host "  KV Secret       : $credentialRef"
}
Write-Host "  Scan            : alle $intervalDays Tag(e) um $runAtUtc UTC"
Write-Host "  Ablaufend ab    : $expiringDays Tagen   Kritisch ab: $criticalDays Tagen"
$webhookInfo = if ($webhookAlerts) { 'Alerts konfiguriert' } else { 'keine' }
Write-Host "  Webhooks        : $webhookInfo"
$mailInfo = if ($mailTo) { $mailTo } else { 'keine' }
Write-Host "  Mail-Targets    : $mailInfo"
$laInfo = if ($laWorkspaceId) { $laWorkspaceId } else { 'nein' }
Write-Host "  Log Analytics   : $laInfo"
Write-Host ''

$confirm = AskYesNo 'Jetzt anlegen?' $true
if (-not $confirm) {
    Write-Host 'Abgebrochen.' -ForegroundColor DarkGray
    exit 0
}

# == 8. Client Secret in Key Vault speichern ===================================

if ($authMode -eq 'client-secret' -and $credValue) {
    Write-Host ''
    Write-Host "[1/3] Speichere Client Secret in Key Vault '$kvName'..." -ForegroundColor Cyan

    az keyvault secret set `
        --vault-name $kvName `
        --name $credentialRef `
        --value $credValue `
        --output none

    if ($LASTEXITCODE -ne 0) { throw 'Key Vault secret konnte nicht gespeichert werden.' }
    Write-Host "  Secret '$credentialRef' gespeichert."
} else {
    Write-Host ''
    Write-Host '[1/3] Kein Client Secret (workload-identity-federation).' -ForegroundColor DarkGray
}

# == 9. jobs.json aus Blob Storage lesen (oder neu anlegen) ===================

Write-Host '[2/3] Lese aktuelle jobs.json aus Blob Storage...' -ForegroundColor Cyan

# Storage Account Key verwenden -- der angemeldete Benutzer hat kein Storage-RBAC,
# nur die UAMI hat Storage Blob Data Contributor. Der Account Key umgeht das RBAC.
$stKey = (az storage account keys list `
    --account-name $stName `
    --resource-group $ResourceGroup `
    --query '[0].value' `
    -o tsv 2>$null)

if (-not $stKey) { throw "Storage Account Key fuer '$stName' konnte nicht abgerufen werden." }

$tmpFile = Join-Path ([System.IO.Path]::GetTempPath()) "aarm-jobs-$(Get-Date -Format 'yyyyMMddHHmmss').json"

# Container sicherstellen (idempotent)
az storage container create `
    --account-name $stName `
    --account-key $stKey `
    --name 'aarm-config' `
    --output none 2>$null

$exists = az storage blob exists `
    --account-name $stName `
    --account-key $stKey `
    --container-name 'aarm-config' `
    --name 'jobs.json' `
    --query exists `
    -o tsv 2>$null

if ($exists -eq 'true') {
    az storage blob download `
        --account-name $stName `
        --account-key $stKey `
        --container-name 'aarm-config' `
        --name 'jobs.json' `
        --file $tmpFile `
        --output none
    $jobsConfig = Get-Content $tmpFile -Raw | ConvertFrom-Json
    Write-Host "  $($jobsConfig.jobs.Count) Job(s) vorhanden."
} else {
    Write-Host '  Keine jobs.json gefunden -- neue Datei wird erstellt.'
    $jobsConfig = [PSCustomObject]@{ jobs = @() }
}

# Pruefen ob Tenant bereits existiert
$existingIdx = -1
for ($i = 0; $i -lt $jobsConfig.jobs.Count; $i++) {
    if ($jobsConfig.jobs[$i].tenantId -eq $tenantId) {
        $existingIdx = $i
        break
    }
}

if ($existingIdx -ge 0) {
    Write-Warning "Tenant $tenantId ist bereits als Job '$($jobsConfig.jobs[$existingIdx].id)' konfiguriert."
    $overwrite = AskYesNo 'Ueberschreiben?' $false
    if (-not $overwrite) {
        Write-Host 'Abgebrochen.' -ForegroundColor DarkGray
        exit 0
    }
}

# Neuen Job bauen
$newJob = [ordered]@{
    id                  = $jobId
    enabled             = $true
    tenantId            = $tenantId
    tenantDisplayName   = $tenantDisplayName
    authMode            = $authMode
    clientId            = $clientId
    credentialRef       = $credentialRef
    schedule            = [ordered]@{
        intervalDays = [int]$intervalDays
        runAtUtc     = $runAtUtc
    }
    teamsWebhooks       = [ordered]@{
        status  = $webhookStatus
        alerts  = $webhookAlerts
        errors  = $webhookErrors
    }
    notificationTemplates = [ordered]@{
        expiring = $null
        critical = $null
        summary  = $null
        error    = $null
    }
    notificationThresholds = [ordered]@{
        expiringWithinDays = [int]$expiringDays
        criticalWithinDays = [int]$criticalDays
    }
    mailTargets = if ($mailTo) {
        [ordered]@{
            to              = @($mailTo -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
            sendOnExpiring  = $mailSendExpiring
            sendOnCritical  = $mailSendCritical
            sendOnStatus    = $mailSendStatus
            sendOnError     = $mailSendError
        }
    } else { $null }
    logAnalytics = [ordered]@{
        workspaceId = $laWorkspaceId
        enabled     = ($null -ne $laWorkspaceId)
    }
}

# Liste aktualisieren
$jobsList = [System.Collections.Generic.List[object]]($jobsConfig.jobs)
if ($existingIdx -ge 0) {
    $jobsList[$existingIdx] = $newJob
} else {
    $jobsList.Add($newJob)
}
$jobsConfig.jobs = $jobsList.ToArray()

$updatedJson = $jobsConfig | ConvertTo-Json -Depth 10
# UTF-8 ohne BOM -- PowerShell 5.1 schreibt sonst BOM, das JSON.parse() bricht
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($tmpFile, $updatedJson, $utf8NoBom)

# == 10. jobs.json in Blob Storage hochladen ===================================

Write-Host '[3/3] Lade jobs.json in Blob Storage hoch...' -ForegroundColor Cyan

az storage blob upload `
    --account-name $stName `
    --account-key $stKey `
    --container-name 'aarm-config' `
    --name 'jobs.json' `
    --file $tmpFile `
    --overwrite `
    --output none

if ($LASTEXITCODE -ne 0) { throw 'jobs.json konnte nicht hochgeladen werden.' }

Remove-Item $tmpFile -Force

# == Abschluss =================================================================

$scanUrl      = "https://$fnHostname/api/tenants/$tenantId/scan"
$dashboardUrl = "https://$fnHostname/api/dashboard"
$keyQuery     = 'functionKeys.default'

Write-Host ''
Write-Host 'Tenant erfolgreich eingerichtet.' -ForegroundColor Green
Write-Host ''
Write-Host 'Naechste Schritte:'
Write-Host '  1. Function Key holen:'
Write-Host "     az functionapp keys list -g $ResourceGroup -n $fnName --query $keyQuery -o tsv"
Write-Host ''
Write-Host '  2. Ersten Scan ausloesen:'
Write-Host "     Invoke-RestMethod $scanUrl -Method POST -Headers @{`"x-functions-key`"=`"`$key`"}"
Write-Host ''
Write-Host '  3. Dashboard oeffnen:'
Write-Host "     $dashboardUrl"
Write-Host ''
