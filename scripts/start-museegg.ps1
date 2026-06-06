$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$desktopApp = Join-Path $root "apps\desktop"
$mainFile = Join-Path $desktopApp "dist-electron\main.js"
$rendererIndex = Join-Path $desktopApp "dist\index.html"

$webApiProcesses = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq "node.exe" -and (
    $_.CommandLine -like "*apps/desktop/dist-web/server.js*" -or
    $_.CommandLine -like "*apps\desktop\dist-web\server.js*"
  )
}
foreach ($process in $webApiProcesses) {
  Stop-Process -Id $process.ProcessId -Force
}

$alreadyRunning = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like "*dist-electron/main.js*" -or $_.CommandLine -like "*dist-electron\main.js*"
} | Select-Object -First 1

if ($alreadyRunning) {
  exit 0
}

if (!(Test-Path -LiteralPath $mainFile) -or !(Test-Path -LiteralPath $rendererIndex)) {
  Push-Location $root
  try {
    & npm.cmd run build
  } finally {
    Pop-Location
  }
}

$env:MUSEEGG_DISABLE_OPENCLAW_AUTOSYNC = "1"
Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "start") `
  -WorkingDirectory $desktopApp `
  -WindowStyle Hidden
