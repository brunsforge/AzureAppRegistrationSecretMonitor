#Requires -Version 5.1
<#
.SYNOPSIS
    Build the AARM CLI and MAUI app and produce a self-contained local installation.

.DESCRIPTION
    1. Builds packages/core and packages/cli  (TypeScript -> dist/)
    2. dotnet publish the MAUI Blazor app     (self-contained Windows x64)
    3. Bundles aarm.js + node.exe + keytar.node into cli/ next to the exe
    4. Optionally self-signs the exe          (-SelfSign)
    5. Optionally creates shortcuts           (-CreateShortcut)

.PARAMETER OutputDir
    Target folder.  Default: <repo-root>\dist\AzureAppRegistrationMonitor

.PARAMETER SelfContained
    $true  -> bundles .NET runtime (larger, portable)
    $false -> framework-dependent (requires .NET 10 on target)
    Default: $true

.PARAMETER CreateShortcut
    Create a Desktop and Start Menu shortcut after publishing.

.PARAMETER SelfSign
    Create and apply a self-signed code-signing cert to suppress
    the SmartScreen "Unknown publisher" warning on first run.

.EXAMPLE
    .\scripts\publish-local.ps1
    .\scripts\publish-local.ps1 -OutputDir "C:\Tools\AARM" -CreateShortcut -SelfSign
#>
param(
    [string] $OutputDir     = "",
    [bool]   $SelfContained = $true,
    [switch] $CreateShortcut,
    [switch] $SelfSign
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

if ($OutputDir -eq "") {
    $OutputDir = Join-Path $Root "dist\AzureAppRegistrationMonitor"
}

$ProjFile  = Join-Path $Root "apps\maui-blazor\src\AzureAppRegistrationMonitor\AzureAppRegistrationMonitor.csproj"
$CliDist   = Join-Path $Root "packages\cli\dist"
$CoreDir   = Join-Path $Root "packages\core"
$CliDir    = Join-Path $Root "packages\cli"
$CliBundle = Join-Path $OutputDir "cli"
$ExeName   = "AzureAppRegistrationMonitor.exe"
$ExePath   = Join-Path $OutputDir $ExeName

Write-Host ""
Write-Host "-------------------------------------------" -ForegroundColor Cyan
Write-Host "  AARM Local Publish" -ForegroundColor Cyan
Write-Host "  Output        : $OutputDir" -ForegroundColor Cyan
Write-Host "  Self-contained: $SelfContained" -ForegroundColor Cyan
Write-Host "-------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Build CLI ----------------------------------------------------------

Write-Host "[1/4] Building CLI packages..." -ForegroundColor Yellow

Push-Location $CoreDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed in packages/core" }
}
finally { Pop-Location }

Push-Location $CliDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed in packages/cli" }
    npm run build:bundle
    if ($LASTEXITCODE -ne 0) { throw "npm run build:bundle (esbuild) failed" }
}
finally { Pop-Location }

Write-Host "      CLI built OK" -ForegroundColor Green

# -- Step 2: Publish MAUI app ---------------------------------------------------

Write-Host "[2/4] Publishing MAUI app..." -ForegroundColor Yellow

$publishArgs = @(
    "publish", $ProjFile,
    "-c", "Release",
    "-f", "net10.0-windows10.0.19041.0",
    "-p:RuntimeIdentifierOverride=win10-x64",
    "-o", $OutputDir,
    "--nologo"
)

if ($SelfContained) {
    $publishArgs += "--self-contained"
    $publishArgs += "true"
} else {
    $publishArgs += "--self-contained"
    $publishArgs += "false"
}

& dotnet @publishArgs

if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit code $LASTEXITCODE)" }

Write-Host "      MAUI published OK" -ForegroundColor Green

# -- Step 3: Bundle CLI ---------------------------------------------------------

Write-Host "[3/4] Bundling CLI into $CliBundle ..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $CliBundle -Force | Out-Null

# aarm.js
$AarmJs = Join-Path $CliDist "aarm.mjs"
if (-not (Test-Path $AarmJs)) {
    throw "aarm.js not found at $AarmJs  -  run 'npm run build' in packages/cli first."
}
Copy-Item $AarmJs (Join-Path $CliBundle "aarm.js")
Write-Host "      aarm.js copied" -ForegroundColor Green

# keytar native module
$KeytarSrc = Join-Path $CliDir "node_modules\keytar"
if (Test-Path $KeytarSrc) {
    $KeytarDest  = Join-Path $CliBundle "node_modules\keytar"
    $KeytarBuild = Join-Path $KeytarDest "build\Release"
    New-Item -ItemType Directory -Path $KeytarBuild -Force | Out-Null

    foreach ($file in @("package.json", "index.js")) {
        $src = Join-Path $KeytarSrc $file
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $KeytarDest $file)
        }
    }

    $nativeNode = Get-ChildItem (Join-Path $KeytarSrc "build\Release\keytar.node") -ErrorAction SilentlyContinue |
                  Select-Object -First 1

    if ($nativeNode) {
        Copy-Item $nativeNode.FullName (Join-Path $KeytarBuild "keytar.node")
        Write-Host "      keytar.node copied" -ForegroundColor Green
    } else {
        Write-Warning "keytar.node not found  -  credential storage may not work."
    }
} else {
    Write-Warning "keytar not found in node_modules. Run 'npm install' in packages/cli."
}

# node.exe
$NodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if ($NodeCmd) {
    Copy-Item $NodeCmd.Source (Join-Path $CliBundle "node.exe")
    $nodeVer = & node.exe --version 2>&1
    Write-Host "      node.exe copied ($nodeVer)" -ForegroundColor Green
} else {
    Write-Warning "node.exe not found on PATH."
    Write-Warning "The app will fall back to npm-global or PATH lookup for the CLI."
    Write-Warning "Install Node.js >= 20 from https://nodejs.org if CLI commands fail."
}

# -- Step 4: Self-sign (optional) ----------------------------------------------

if ($SelfSign) {
    Write-Host "[4/4] Signing exe with self-signed certificate..." -ForegroundColor Yellow

    $certSubject = "CN=AARM Local Build"
    $cert = Get-ChildItem Cert:\CurrentUser\My |
            Where-Object { $_.Subject -eq $certSubject } |
            Select-Object -First 1

    if (-not $cert) {
        $cert = New-SelfSignedCertificate `
            -Subject $certSubject `
            -CertStoreLocation "Cert:\CurrentUser\My" `
            -Type CodeSigningCert `
            -HashAlgorithm SHA256 `
            -NotAfter (Get-Date).AddYears(3)
        Write-Host "      Certificate created: $($cert.Thumbprint)" -ForegroundColor Green
    } else {
        Write-Host "      Reusing certificate: $($cert.Thumbprint)" -ForegroundColor Green
    }

    # Add to Trusted Publishers so SmartScreen accepts it without a warning
    $store = [System.Security.Cryptography.X509Certificates.X509Store]::new(
        "TrustedPublisher",
        [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($cert)
    $store.Close()

    $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($signtool) {
        & signtool sign /fd SHA256 /sha1 $cert.Thumbprint /td SHA256 `
            /tr http://timestamp.digicert.com "$ExePath"
    } else {
        Set-AuthenticodeSignature -FilePath $ExePath -Certificate $cert `
            -TimestampServer "http://timestamp.digicert.com" | Out-Null
    }

    Write-Host "      Signed OK" -ForegroundColor Green

} else {
    Write-Host "[4/4] Skipping signing  (use -SelfSign to enable)" -ForegroundColor DarkGray
}

# -- Optional: Shortcuts --------------------------------------------------------

if ($CreateShortcut) {
    $wsh = New-Object -ComObject WScript.Shell

    $shortcutTargets = @(
        [System.Environment]::GetFolderPath("Desktop"),
        (Join-Path ([System.Environment]::GetFolderPath("Programs")) "AARM")
    )

    foreach ($dir in $shortcutTargets) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $lnk = $wsh.CreateShortcut((Join-Path $dir "Azure App Registration Monitor.lnk"))
        $lnk.TargetPath       = $ExePath
        $lnk.WorkingDirectory = $OutputDir
        $lnk.Description      = "Azure App Registration Monitor"
        $lnk.Save()
    }

    Write-Host "      Shortcuts created" -ForegroundColor Green
}

# -- Summary --------------------------------------------------------------------

Write-Host ""
Write-Host "-------------------------------------------" -ForegroundColor Green
Write-Host "  Done!" -ForegroundColor Green
Write-Host "  Executable : $ExePath" -ForegroundColor Green
Write-Host "  CLI bundle : $CliBundle" -ForegroundColor Green

if (-not $SelfContained) {
    Write-Host ""
    Write-Host "  NOTE: framework-dependent build." -ForegroundColor Yellow
    Write-Host "  .NET 10 must be installed on the target machine." -ForegroundColor Yellow
    Write-Host "  Download: https://dot.net/download" -ForegroundColor Yellow
}

Write-Host "-------------------------------------------" -ForegroundColor Green
Write-Host ""
