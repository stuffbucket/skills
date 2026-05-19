# Standalone signtool wrapper.
# Use this when you sign outside `tauri build` (post-processing,
# repackaging, etc). For the in-build path, prefer setting
# WINDOWS_CERTIFICATE + WINDOWS_CERTIFICATE_PASSWORD env vars and
# letting tauri-cli call signtool for you.
#
# Usage: .\sign-windows.ps1 -File path\to\YourApp-setup.exe

param(
    [Parameter(Mandatory = $true)]
    [string]$File,

    # Either: thumbprint of cert in CurrentUser\My
    [string]$Thumbprint = $env:WINDOWS_CERT_THUMBPRINT,

    # Or: path to .pfx + password
    [string]$PfxPath = $env:WINDOWS_CERTIFICATE_PATH,
    [string]$PfxPassword = $env:WINDOWS_CERTIFICATE_PASSWORD,

    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [string]$Description  = "Your App Name"
)

$ErrorActionPreference = "Stop"

# Find signtool. Adjust if your SDK lives elsewhere.
$signtool = (Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe" |
             Sort-Object -Property FullName -Descending |
             Select-Object -First 1).FullName
if (-not $signtool) {
    throw "signtool.exe not found. Install Windows 10 SDK."
}

if ($Thumbprint) {
    & $signtool sign `
        /sha1 $Thumbprint `
        /tr $TimestampUrl /td sha256 /fd sha256 `
        /d $Description `
        $File
}
elseif ($PfxPath -and $PfxPassword) {
    & $signtool sign `
        /f $PfxPath /p $PfxPassword `
        /tr $TimestampUrl /td sha256 /fd sha256 `
        /d $Description `
        $File
}
else {
    throw "Provide either -Thumbprint or both -PfxPath and -PfxPassword."
}

if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE" }

# Verify.
& $signtool verify /pa /v $File
if ($LASTEXITCODE -ne 0) { throw "signature verification failed" }

Write-Host "OK: $File signed and verified"
