# CargoTrack — Development Commands for Windows
# ==============================================
# PowerShell equivalent of the Makefile.  All commands are invoked as:
#
#   .\scripts\dev.ps1 <command>
#
# Available commands:
#   up               Start all services (docker compose up)
#   down             Stop and remove containers
#   build            Rebuild all Docker images from scratch
#   restart          Restart the backend container (picks up code changes)
#   logs             Tail backend container logs
#   shell            Open Django management shell in the backend container
#   migrate          Run pending Django migrations
#   createsuperuser  Create a Django admin account
#   seed             Load demo data
#   status           Show container status + proxy state + LAN IPs for mobile
#   mobile           Build & run the Android app (npx expo run:android)
#   help             Show this help

param(
    [Parameter(Position = 0)]
    [ValidateSet("up", "down", "build", "restart", "logs", "shell", "migrate", "createsuperuser", "seed", "status", "mobile", "portforward", "help", "")]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Write-Banner {
    Write-Host ""
    Write-Host "  CargoTrack — $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "  ----------------------------------------" -ForegroundColor Cyan
}

function Get-LanIps {
    $ips = @()
    try {
        $dnsHostName = [System.Net.Dns]::GetHostName()
        $ipHostEntry = [System.Net.Dns]::GetHostEntry($dnsHostName)
        foreach ($ip in $ipHostEntry.AddressList) {
            if ($ip.AddressFamily -eq 'InterNetwork' -and -not $ip.ToString().StartsWith('127.')) {
                $ips += $ip.ToString()
            }
        }
    } catch { }
    return $ips
}

function Get-Wsl2Ip {
    $ip = wsl -d docker-desktop -- sh -c "ip -4 addr show eth0 2>/dev/null | grep inet | awk '{print `$2}' | cut -d/ -f1" 2>$null
    if (-not $ip) {
        throw "Could not determine WSL2 IP. Is Docker Desktop running?"
    }
    return $ip.Trim()
}

function Start-Proxy {
    param([string]$WslIp = (Get-Wsl2Ip))

    # Kill any existing proxy process
    $existing = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*\python.exe" -or $_.Path -like "*\python3*"
    }
    if ($existing) {
        $existing | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }

    $proxyScript = Join-Path $root "scripts\proxy.py"
    $logFile = Join-Path $env:TEMP "cargotrack-proxy.log"

    Write-Host "  Starting TCP proxy: 0.0.0.0:{8000,5173} -> $WslIp" -ForegroundColor Yellow
    Start-Process python -ArgumentList "-u", $proxyScript, $WslIp, "--ports=8000,5173" `
        -NoNewWindow -RedirectStandardOutput $logFile -WindowStyle Hidden

    Start-Sleep -Seconds 2

    # Verify it started
    $listeners = Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue `
        | Where-Object { $_.LocalAddress -eq "0.0.0.0" }
    if ($listeners.Count -ge 1) {
        Write-Host "  TCP proxy active (log: $logFile)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Proxy may not have started. Check $logFile" -ForegroundColor Yellow
    }
}

function Invoke-DockerCompose {
    param([string[]]$Args)
    Set-Location $root
    docker compose @Args
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed with exit code $LASTEXITCODE"
    }
}

switch ($Command) {
    "up" {
        Write-Banner
        Write-Host "  Starting all services..." -ForegroundColor Yellow
        Write-Host ""
        Set-Location $root
        docker compose up -d
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose up failed"
        }
        # Wait for healthy
        Write-Host "  Waiting for services to be healthy..." -ForegroundColor Yellow
        docker compose ps | Out-Host
        # Start TCP proxy for LAN/mobile access
        try {
            Start-Proxy
        } catch {
            Write-Host "  WARNING: Could not start TCP proxy: $_" -ForegroundColor Yellow
            Write-Host "  Run '.\scripts\dev.ps1 portforward' after Docker Desktop is fully ready." -ForegroundColor Yellow
        }
    }

    "down" {
        Write-Banner
        Write-Host "  Stopping all services..." -ForegroundColor Yellow
        Invoke-DockerCompose down
        Write-Host "  All services stopped." -ForegroundColor Green
    }

    "build" {
        Write-Banner
        Write-Host "  Rebuilding all Docker images (this will take a few minutes)..." -ForegroundColor Yellow
        Set-Location $root
        docker compose build --no-cache
        Write-Host "  Build complete. Run '.\scripts\dev.ps1 up' to start." -ForegroundColor Green
    }

    "restart" {
        Write-Banner
        Write-Host "  Restarting backend container..." -ForegroundColor Yellow
        Invoke-DockerCompose restart backend
        Write-Host "  Backend restarted." -ForegroundColor Green
    }

    "logs" {
        Set-Location $root
        docker compose logs -f backend
    }

    "shell" {
        Write-Host "  Opening Django shell in backend container..." -ForegroundColor Yellow
        Invoke-DockerCompose @("exec", "backend", "python", "manage.py", "shell")
    }

    "migrate" {
        Write-Host "  Running migrations..." -ForegroundColor Yellow
        Invoke-DockerCompose @("exec", "backend", "python", "manage.py", "migrate")
    }

    "createsuperuser" {
        Write-Host "  Creating superuser..." -ForegroundColor Yellow
        Invoke-DockerCompose @("exec", "-it", "backend", "python", "manage.py", "createsuperuser")
    }

    "seed" {
        Write-Host "  Seeding demo data..." -ForegroundColor Yellow
        Invoke-DockerCompose @("exec", "backend", "python", "manage.py", "seed_data")
        Write-Host "  Demo data loaded." -ForegroundColor Green
    }

    "status" {
        Write-Banner
        Write-Host "  Container status:" -ForegroundColor White
        Write-Host ""
        Set-Location $root
        docker compose ps
        Write-Host ""

        $lanIps = Get-LanIps
        if ($lanIps.Count -gt 0) {
            Write-Host "  LAN addresses (use these in the mobile app):" -ForegroundColor White
            foreach ($ip in $lanIps) {
                Write-Host "    http://${ip}:8000" -ForegroundColor Green
            }
        } else {
            Write-Host "  No LAN IP detected." -ForegroundColor Yellow
        }
        Write-Host ""

        # Show proxy status
        Write-Host "  TCP proxy (LAN -> WSL2 Docker):" -ForegroundColor White
        $listeners = Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue `
            | Where-Object { $_.LocalAddress -eq "0.0.0.0" }
        if ($listeners) {
            Write-Host "    Active" -ForegroundColor Green
            $wslIp = try { Get-Wsl2Ip } catch { $null }
            if ($wslIp) { Write-Host "    WSL2 IP: $wslIp" -ForegroundColor Gray }
            $proxyLog = Join-Path $env:TEMP "cargotrack-proxy.log"
            if (Test-Path $proxyLog) { Write-Host "    Log: $proxyLog" -ForegroundColor Gray }
        } else {
            Write-Host "    Not running — run '.\scripts\dev.ps1 portforward'" -ForegroundColor Yellow
        }
        Write-Host ""

        Write-Host "  Android emulator:  http://10.0.2.2:8000" -ForegroundColor Gray
        Write-Host "  Web frontend:      http://localhost:5173" -ForegroundColor Gray
        Write-Host "  API health check:  http://localhost:8000/api/health/" -ForegroundColor Gray
        Write-Host ""
    }

    "portforward" {
        Write-Banner
        Write-Host "  Starting TCP proxy for LAN/mobile access..." -ForegroundColor Yellow
        $wslIp = Get-Wsl2Ip
        Write-Host "  WSL2 IP: $wslIp" -ForegroundColor Gray
        Start-Proxy -WslIp $wslIp
        Write-Host ""
        Write-Host "  TCP proxy is active. Mobile devices on the same network" -ForegroundColor Green
        Write-Host "  can now reach the API." -ForegroundColor Green
        Write-Host ""
        $lanIps = Get-LanIps
        if ($lanIps.Count -gt 0) {
            Write-Host "  Use these URLs in the mobile app:" -ForegroundColor White
            foreach ($ip in $lanIps) {
                Write-Host "    http://${ip}:8000" -ForegroundColor Green
            }
        }
    }

    "mobile" {
        Write-Banner
        Write-Host "  Building and launching Android app (npx expo run:android)..." -ForegroundColor Yellow
        Write-Host ""
        Set-Location (Join-Path $root "mobile")
        npx expo run:android
    }

    default {
        Write-Host @"

  CargoTrack — Development Commands
  ==================================

  .\scripts\dev.ps1 up            Start all services (Docker Compose)
  .\scripts\dev.ps1 down          Stop and remove containers
  .\scripts\dev.ps1 build         Rebuild all Docker images
  .\scripts\dev.ps1 restart       Restart backend (picks up code changes)
  .\scripts\dev.ps1 logs          Stream backend logs
  .\scripts\dev.ps1 shell         Django management shell
  .\scripts\dev.ps1 migrate       Run pending migrations
  .\scripts\dev.ps1 createsuperuser   Create admin account
  .\scripts\dev.ps1 seed          Load demo data
  .\scripts\dev.ps1 status        Show containers + LAN IPs for mobile
  .\scripts\dev.ps1 portforward   Start TCP proxy for LAN/mobile access to WSL2 Docker
  .\scripts\dev.ps1 mobile        Build & run Android development build

  Quick start:
    .\scripts\dev.ps1 build       # first time only
    .\scripts\dev.ps1 up          # start everything + auto TCP proxy
    .\scripts\dev.ps1 status      # see LAN IPs for mobile

"@
    }
}
