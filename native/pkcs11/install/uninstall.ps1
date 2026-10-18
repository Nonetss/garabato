# Removes Garabato's browser token from this Windows computer: the "Garabato"
# entry from every Firefox-family profile, the module and its configuration.
# The browser's key stays valid until it is disconnected in Garabato.
# Run: powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Garabato\uninstall.ps1"

function Uninstall-GarabatoToken {
  $ErrorActionPreference = 'Stop'
  $libDir = Join-Path $env:LOCALAPPDATA 'Garabato'
  $configDir = Join-Path $env:APPDATA 'Garabato'
  $roots = @(
    (Join-Path (Join-Path $env:APPDATA 'Mozilla') 'Firefox'),
    (Join-Path $env:APPDATA 'zen'),
    (Join-Path $env:APPDATA 'librewolf'),
    (Join-Path $env:APPDATA 'Floorp'),
    (Join-Path $env:APPDATA 'Waterfox')
  )

  $running = Get-Process -Name firefox, zen, librewolf, floorp, waterfox -ErrorAction SilentlyContinue
  if ($running) {
    Write-Host 'Cierra tus navegadores (Firefox, Zen…) y vuelve a ejecutar el desinstalador.' -ForegroundColor Red
    return
  }

  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $profiles = @()
    $profilesDir = Join-Path $root 'Profiles'
    if (Test-Path -LiteralPath $profilesDir) {
      $profiles += Get-ChildItem -LiteralPath $profilesDir -Directory | ForEach-Object { $_.FullName }
    }
    $ini = Join-Path $root 'profiles.ini'
    if (Test-Path -LiteralPath $ini) {
      foreach ($line in [IO.File]::ReadAllLines($ini)) {
        if ($line -notmatch '^Path=(.+)$') { continue }
        $path = $Matches[1].Trim()
        if ([IO.Path]::IsPathRooted($path)) { $profiles += $path }
      }
    }
    foreach ($browserProfile in ($profiles | Select-Object -Unique)) {
      $file = Join-Path $browserProfile 'pkcs11.txt'
      if (-not (Test-Path -LiteralPath $file)) { continue }
      $text = [IO.File]::ReadAllText($file)
      $newline = "`n"
      if ($text.Contains("`r`n")) { $newline = "`r`n" }
      $blocks = @([regex]::Split($text.Trim(), '\r?\n[ \t]*\r?\n') |
        Where-Object { $_ -and ($_ -notmatch '(?m)^name=Garabato[ \t]*\r?$') })
      $lines = @($blocks | ForEach-Object { (($_ -split '\r?\n') -join $newline) })
      $content = ($lines -join ($newline + $newline)) + $newline
      [IO.File]::WriteAllText($file, $content, (New-Object Text.UTF8Encoding $false))
    }
  }

  Remove-Item -LiteralPath (Join-Path $configDir 'token.json') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $libDir 'garabato_pkcs11.dll') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $configDir -Force -ErrorAction SilentlyContinue
  Write-Host 'Garabato se ha quitado de tus navegadores.'
  Write-Host 'Para invalidar también su clave, desconecta este navegador en Garabato → Certificados.'
  Write-Host "Puedes borrar la carpeta $libDir."
}

Uninstall-GarabatoToken
