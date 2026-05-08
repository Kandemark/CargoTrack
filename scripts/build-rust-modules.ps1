# build-rust-modules.ps1 — Build Rust PyO3 extensions and copy to Django ML dir.
# Usage: .\scripts\build-rust-modules.ps1 [-Release] [-Clean]

param(
    [switch]$Release,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$profile = if ($Release) { "release" } else { "debug" }
$targetDir = "target\$profile"

$modules = @(
    @{ Name = "fuel_optimizer_rs"; Path = "$root\services\fuel-optimizer" },
    @{ Name = "container_matcher_rs"; Path = "$root\services\container-matcher" }
)

$destDir = "$root\services\api\cargotrack\ml"

Write-Host "=== Building Rust PyO3 modules ($profile) ===" -ForegroundColor Cyan

foreach ($mod in $modules) {
    Write-Host "Building $($mod.Name)..." -ForegroundColor Yellow
    $buildArgs = @("build")
    if ($Release) { $buildArgs += "--release" }
    Push-Location $mod.Path
    try {
        cargo @buildArgs 2>&1 | Select-Object -Last 3
        $src = Join-Path $mod.Path "$targetDir\$($mod.Name).dll"
        $dst = Join-Path $destDir "$($mod.Name).pyd"
        if (Test-Path $src) {
            Copy-Item $src $dst -Force
            Write-Host "  -> Copied to $dst" -ForegroundColor Green
        } else {
            Write-Host "  ERROR: DLL not found at $src" -ForegroundColor Red
            Get-ChildItem "$mod.Path\target" -Recurse -Filter "$($mod.Name).*" | Select-Object FullName
        }
    } finally {
        Pop-Location
    }
}

Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Verify: python -c 'import fuel_optimizer_rs; import container_matcher_rs; print(\"OK\")'"
