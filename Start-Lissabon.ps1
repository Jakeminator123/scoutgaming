# Startar Lissabon: spel pa 4200 och labb pa 4201.
# Behall fonstret oppet. Ctrl+C stoppar bada servrarna.
[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$CheckOnly,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js saknas. Installera Node.js 22.16 eller senare.' }

$nodeVersion = & $node.Source --version
if ($LASTEXITCODE -ne 0 -or [version]($nodeVersion.TrimStart('v')) -lt [version]'22.16.0') {
    throw 'Lissabon behover Node.js 22.16 eller senare.'
}

# Volta och liknande shims ska inte sta mellan Ctrl+C och startprocessen.
$nodeExecutable = & $node.Source -p 'process.execPath'
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $nodeExecutable)) {
    throw 'Node.js kunde inte hittas bakom versionshanteraren.'
}

$startArgs = @((Join-Path $PSScriptRoot 'lab\start.mjs'))
if ($NoBrowser) { $startArgs += '--no-open' }
if ($CheckOnly) { $startArgs += '--check' }
if ($SkipBuild) { $startArgs += '--skip-build' }

& $nodeExecutable @startArgs
exit $LASTEXITCODE
