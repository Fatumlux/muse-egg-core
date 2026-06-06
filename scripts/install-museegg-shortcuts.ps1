$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$startScript = Join-Path $root "scripts\start-museegg.ps1"
$iconPath = Join-Path $root "apps\desktop\public\museegg.ico"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$startupPath = [Environment]::GetFolderPath("Startup")
$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function New-MuseEggShortcut {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($Path)
  $shortcut.TargetPath = $powershellPath
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
  $shortcut.WorkingDirectory = $root
  if (Test-Path -LiteralPath $iconPath) {
    $shortcut.IconLocation = $iconPath
  }
  $shortcut.Description = "啟動 MuseEgg Core OC 生命核心"
  $shortcut.Save()
}

New-MuseEggShortcut -Path (Join-Path $desktopPath "MuseEgg Core.lnk")
New-MuseEggShortcut -Path (Join-Path $startupPath "MuseEgg Core.lnk")

Write-Output "MuseEgg shortcuts installed:"
Write-Output (Join-Path $desktopPath "MuseEgg Core.lnk")
Write-Output (Join-Path $startupPath "MuseEgg Core.lnk")
