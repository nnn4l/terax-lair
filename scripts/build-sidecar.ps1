param(
    [string]$ProxyPath = "C:\Users\nathan\dev\UniClaudeProxy",
    [string]$OutputDir = "$PSScriptRoot\..\src-tauri\binaries"
)

$ErrorActionPreference = "Stop"

# Resolve absolute paths
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

if (-not (Test-Path $ProxyPath)) {
    throw "Proxy path not found: $ProxyPath"
}
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Push-Location $ProxyPath
try {
    Write-Host "Building uniclaude-proxy sidecar with PyInstaller..."
    python -m PyInstaller `
        --onefile `
        --name uniclaude-proxy `
        --distpath "$OutputDir" `
        --workpath "$ProxyPath\.pyinstaller-build" `
        --specpath "$ProxyPath\.pyinstaller-spec" `
        --add-data "config.json;." `
        --hidden-import uvicorn.logging `
        --hidden-import uvicorn.loops `
        --hidden-import uvicorn.loops.auto `
        --hidden-import uvicorn.protocols `
        --hidden-import uvicorn.protocols.http `
        --hidden-import uvicorn.protocols.http.auto `
        --hidden-import uvicorn.protocols.websockets `
        --hidden-import uvicorn.protocols.websockets.auto `
        --hidden-import uvicorn.lifespan `
        --hidden-import uvicorn.lifespan.on `
        app\main.py

    # Tauri expects target-triple suffix on binaries
    $src = Join-Path $OutputDir "uniclaude-proxy.exe"
    $dst = Join-Path $OutputDir "uniclaude-proxy-x86_64-pc-windows-msvc.exe"
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "Sidecar binary: $dst"
    } else {
        throw "PyInstaller did not produce expected binary at $src"
    }
} finally {
    Pop-Location
}
