# Starts Docker Desktop (clearing the stale socket files that make it crash on this laptop),
# then starts the NeuroGut website on http://localhost:8088.
# Run:  powershell -ExecutionPolicy Bypass -File C:\Major_project_Neuro_Gut\scripts\start_docker_website.ps1

Write-Host "Stopping Docker Desktop..."
Get-Process | Where-Object { $_.ProcessName -match '^(Docker Desktop|com\.docker\..*|docker)$' } |
    ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch {} }
wsl --shutdown
Start-Sleep 3

# Docker leaves Unix socket files behind that Windows cannot delete; moving their folders aside lets it start.
$ts = Get-Date -Format yyyyMMddHHmmss
foreach ($d in @("$env:LOCALAPPDATA\Docker\run", "$env:LOCALAPPDATA\docker-secrets-engine")) {
    if (Test-Path $d) { Rename-Item $d ((Split-Path $d -Leaf) + ".stale-$ts") -ErrorAction SilentlyContinue }
}

Write-Host "Starting Docker Desktop (takes 1-3 minutes)..."
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    $v = (docker version --format '{{.Server.Version}}' 2>$null) | Out-String
    if ($LASTEXITCODE -eq 0 -and $v.Trim() -match '^\d') { $ready = $true; break }
    Start-Sleep 5
}
if (-not $ready) { Write-Host "Docker did not start. Use start_backend.bat + start_frontend.bat instead (http://localhost:3000)."; exit 1 }

Write-Host "Starting NeuroGut..."
Set-Location "C:\Major_project_Neuro_Gut"
$env:NEUROGUT_PORT = "8088"
docker compose -p neurogut-deploytest up -d
Write-Host "Waiting for the backend to load the models..."
for ($i = 0; $i -lt 60; $i++) {
    if ((docker ps --filter name=neurogut-backend --format '{{.Status}}') -match '\(healthy\)') { break }
    Start-Sleep 3
}
if (-not ((docker ps --filter name=neurogut-nginx --format '{{.Status}}' 2>$null) -match '^Up')) {
    Write-Host "Website containers did not start. Use start_backend.bat + start_frontend.bat instead (http://localhost:3000)."; exit 1
}
Write-Host "Ready: http://localhost:8088"
Start-Process "http://localhost:8088"
