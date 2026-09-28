# Start only the local studio. Never writes credentials or changes Render.
[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$CheckOnly,
    [ValidateRange(1024, 65535)][int]$Port = 4188
)

$ErrorActionPreference = 'Stop'
$labPath = Join-Path $PSScriptRoot 'lab'
$labUrl = "http://127.0.0.1:$Port"
$labBrowserJob = $null
$labExitCode = 0

function Test-LabPort {
    $labSocket = New-Object System.Net.Sockets.TcpClient
    try {
        $labConnect = $labSocket.ConnectAsync('127.0.0.1', $Port)
        return ($labConnect.Wait(750) -and $labSocket.Connected)
    } catch { return $false }
    finally { $labSocket.Dispose() }
}

function Test-Studio {
    try {
        $labHealth = Invoke-RestMethod -Uri "$labUrl/api/health" -TimeoutSec 5 -UseBasicParsing
        return ($labHealth.ok -eq $true -and $labHealth.service -eq 'croupier-next-studio' -and $labHealth.localOnly -eq $true)
    } catch { return $false }
}

try {
    if (-not (Test-Path -LiteralPath (Join-Path $labPath 'package.json'))) {
        throw 'Labbmappen saknas. Behall startfilerna i Croupier-repots rot.'
    }
    if (Test-LabPort) {
        if (-not (Test-Studio)) {
            throw "Port $Port anvands, men svarar inte som Croupier Studio. Ingen process har stoppats."
        }
        Write-Host "Labbet kor redan: $labUrl"
        exit 0
    }

    $labNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $labNode) { throw 'Node.js saknas. Installera Node.js 22.16 eller senare och oppna startfilen igen.' }
    $labNodeVersion = & $labNode.Source --version
    if ($LASTEXITCODE -ne 0 -or [version]($labNodeVersion.TrimStart('v')) -lt [version]'22.16.0') {
        throw 'Labbet behover Node.js 22.16 eller senare.'
    }
    # Resolve version-manager shims once so the foreground process is Node itself.
    $labNodeExecutable = & $labNode.Source -p 'process.execPath'
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $labNodeExecutable)) {
        throw 'Node.js kunde inte hittas bakom versionshanteraren.'
    }
    $labNext = Join-Path $labPath 'node_modules/next/dist/bin/next'
    if (-not (Test-Path -LiteralPath $labNext)) {
        if ($CheckOnly) { throw 'Labbets beroenden saknas. Normal start installerar dem fran package-lock.json.' }
        $labNpm = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if (-not $labNpm) { throw 'npm saknas i Node.js-installationen.' }
        Write-Host 'Forsta starten: installerar labbets lasta beroenden. Inga nycklar andras.'
    }
    if ($CheckOnly) {
        Write-Host "Kontroll klar: Node.js, labb och ledig port $Port. Ingenting har startats."
        exit 0
    }

    Write-Host "Startar Croupier Studio: $labUrl"
    Write-Host 'Behall detta fonster oppet. Stoppa servern med Ctrl+C.'
    Write-Host 'OpenClaw pa Render startas inte om; befintliga installningar anvands.'
    if (-not $NoBrowser) {
        # A short-lived helper opens the browser only after this server is ready.
        $labBrowserJob = Start-Job -ArgumentList $labUrl -ScriptBlock {
            param($readyUrl)
            $readyDeadline = [DateTime]::UtcNow.AddMinutes(2)
            while ([DateTime]::UtcNow -lt $readyDeadline) {
                try {
                    $readyHealth = Invoke-RestMethod -Uri "$readyUrl/api/health" -TimeoutSec 2 -UseBasicParsing
                    if ($readyHealth.ok -eq $true -and $readyHealth.service -eq 'croupier-next-studio' -and $readyHealth.localOnly -eq $true) {
                        Start-Process $readyUrl
                        return
                    }
                } catch { }
                Start-Sleep -Milliseconds 500
            }
        }
    }
    Push-Location -LiteralPath $labPath
    try {
        & $labNodeExecutable (Join-Path $PSScriptRoot 'tools/start-lab-session.mjs') --port $Port
        $labExitCode = $LASTEXITCODE
    } finally { Pop-Location }
} catch {
    Write-Host "Kunde inte starta labbet: $($_.Exception.Message)" -ForegroundColor Red
    $labExitCode = 1
} finally {
    if ($null -ne $labBrowserJob) {
        Stop-Job -Job $labBrowserJob -ErrorAction SilentlyContinue
        Remove-Job -Job $labBrowserJob -Force -ErrorAction SilentlyContinue
    }
}
exit $labExitCode
