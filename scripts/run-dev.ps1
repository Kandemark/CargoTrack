# CargoTrack — Windows Development Server Launcher
# ==================================================
# Starts the Django backend on 0.0.0.0:8000 so Android emulators and physical
# devices on the same network can reach the API.
#
# Usage:
#   .\scripts\run-dev.ps1
#
# What it does:
#   1. Opens Windows Firewall for port 8000 (inbound TCP)
#   2. Applies pending Django migrations
#   3. Starts Daphne ASGI server on 0.0.0.0:8000
#   4. Prints LAN IPs so you know what address to use in the mobile app

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " CargoTrack — Dev Server Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Activate virtual environment ──────────────────────────────────────────
$venvPath = Join-Path $PSScriptRoot ".." "venv"
$venvActivate = Join-Path $venvPath "Scripts" "Activate.ps1"

if (Test-Path $venvActivate) {
    Write-Host "[1/4] Activating virtual environment..." -ForegroundColor Yellow
    . $venvActivate
} else {
    Write-Host "[1/4] No venv found at $venvPath — using system Python." -ForegroundColor Yellow
}

# ── 2. Windows Firewall rule ─────────────────────────────────────────────────
Write-Host "[2/4] Checking Windows Firewall rule for port 8000..." -ForegroundColor Yellow

$existingRule = netsh advfirewall firewall show rule name="CargoTrack Django (8000)" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($existingRule)) {
    try {
        netsh advfirewall firewall add rule name="CargoTrack Django (8000)" dir=in action=allow protocol=TCP localport=8000 | Out-Null
        Write-Host "       Firewall rule added — port 8000 is now open for inbound connections." -ForegroundColor Green
    } catch {
        Write-Host "       WARNING: Could not add firewall rule. Run as Administrator if needed." -ForegroundColor Red
        Write-Host "       Without this rule, physical devices cannot reach the server." -ForegroundColor Red
    }
} else {
    Write-Host "       Firewall rule already exists." -ForegroundColor Green
}

# ── 3. Apply migrations ──────────────────────────────────────────────────────
Write-Host "[3/4] Applying database migrations..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "..")
python manage.py migrate --no-input
Write-Host "       Migrations applied." -ForegroundColor Green

# ── 4. Detect LAN IPs ────────────────────────────────────────────────────────
Write-Host "[4/4] Detecting LAN IP addresses..." -ForegroundColor Yellow

$lanIps = @()
try {
    $dnsHostName = [System.Net.Dns]::GetHostName()
    $ipHostEntry = [System.Net.Dns]::GetHostEntry($dnsHostName)
    foreach ($ip in $ipHostEntry.AddressList) {
        if ($ip.AddressFamily -eq 'InterNetwork' -and -not $ip.ToString().StartsWith('127.')) {
            $lanIps += $ip.ToString()
        }
    }
} catch {
    # Fallback: try ipconfig
    $ipconfig = ipconfig | Select-String "IPv4 Address" | ForEach-Object { $_ -replace '.*:\s*', '' }
    foreach ($line in $ipconfig) {
        $ip = $line.Trim()
        if ($ip -and -not $ip.StartsWith('127.') -and $ip -notin $lanIps) {
            $lanIps += $ip
        }
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Django API server starting!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($lanIps.Count -gt 0) {
    Write-Host "  LAN addresses (use these in the mobile app):" -ForegroundColor White
    foreach ($ip in $lanIps) {
        Write-Host "    http://${ip}:8000" -ForegroundColor Green
    }
} else {
    Write-Host "  No LAN IP detected. Check your network connection." -ForegroundColor Red
}

Write-Host ""
Write-Host "  Android emulator (same PC):" -ForegroundColor White
Write-Host "    http://10.0.2.2:8000" -ForegroundColor Green
Write-Host ""
Write-Host "  Health check:" -ForegroundColor White
Write-Host "    http://localhost:8000/api/health/" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host ""

# ── 5. Start Daphne on 0.0.0.0:8000 ──────────────────────────────────────────
daphne -b 0.0.0.0 -p 8000 cargotrack.asgi:application
