# Connects Firefox and the browsers built on it (Zen, LibreWolf, Floorp,
# Waterfox) on this Windows computer to the certificates kept in Garabato.
# Served by Garabato with its address and a one-time code filled in; run it
# as your user in PowerShell:  irm '<url>' | iex
#
# It runs inside your own console, so it never calls `exit` (that would close
# the window) and never prompts: it waits for running browsers instead.
# Written for Windows PowerShell 5.1: no `??`, ternaries or `&&`.

$GarabatoUrl = '@@URL@@'
$InstallCode = '@@CODE@@'

function Write-GarabatoFailure([string]$message) {
  Write-Host "Error: $message" -ForegroundColor Red
}

# Firefox-family profiles that hold NSS databases, as objects with the
# browser's name and the profile folder; those without pkcs11.txt have not
# been opened yet and are returned apart.
function Get-GarabatoProfiles {
  $roots = @(
    @{ Browser = 'Firefox'; Path = (Join-Path (Join-Path $env:APPDATA 'Mozilla') 'Firefox') },
    @{ Browser = 'Zen'; Path = (Join-Path $env:APPDATA 'zen') },
    @{ Browser = 'LibreWolf'; Path = (Join-Path $env:APPDATA 'librewolf') },
    @{ Browser = 'Floorp'; Path = (Join-Path $env:APPDATA 'Floorp') },
    @{ Browser = 'Waterfox'; Path = (Join-Path $env:APPDATA 'Waterfox') }
  )
  $found = @()
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root.Path)) { continue }
    $paths = @()
    $profilesDir = Join-Path $root.Path 'Profiles'
    if (Test-Path -LiteralPath $profilesDir) {
      $paths += Get-ChildItem -LiteralPath $profilesDir -Directory | ForEach-Object { $_.FullName }
    }
    $ini = Join-Path $root.Path 'profiles.ini'
    if (Test-Path -LiteralPath $ini) {
      foreach ($line in [IO.File]::ReadAllLines($ini)) {
        if ($line -notmatch '^Path=(.+)$') { continue }
        $path = $Matches[1].Trim()
        if (-not [IO.Path]::IsPathRooted($path)) {
          $path = Join-Path $root.Path ($path -replace '/', [IO.Path]::DirectorySeparatorChar)
        }
        $paths += $path
      }
    }
    foreach ($path in ($paths | Select-Object -Unique)) {
      if (-not (Test-Path -LiteralPath (Join-Path $path 'cert9.db'))) { continue }
      $found += [pscustomobject]@{
        Browser = $root.Browser
        Path = $path
        Ready = (Test-Path -LiteralPath (Join-Path $path 'pkcs11.txt'))
      }
    }
  }
  return , $found
}

# Rewrites pkcs11.txt without any "Garabato" block, then appends one pointing
# at the module. Keeps the other blocks, the file's line ending and UTF-8
# without a byte-order mark, which NSS needs.
function Set-GarabatoPkcs11([string]$file, [string]$library) {
  $text = [IO.File]::ReadAllText($file)
  $newline = "`n"
  if ($text.Contains("`r`n")) { $newline = "`r`n" }
  $blocks = @([regex]::Split($text.Trim(), '\r?\n[ \t]*\r?\n') |
    Where-Object { $_ -and ($_ -notmatch '(?m)^name=Garabato[ \t]*\r?$') })
  $lines = @($blocks | ForEach-Object { (($_ -split '\r?\n') -join $newline) })
  $lines += "library=$library${newline}name=Garabato"
  $content = ($lines -join ($newline + $newline)) + $newline
  [IO.File]::WriteAllText($file, $content, (New-Object Text.UTF8Encoding $false))
}

function Install-GarabatoToken {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  } catch {}

  $libDir = Join-Path $env:LOCALAPPDATA 'Garabato'
  $configDir = Join-Path $env:APPDATA 'Garabato'
  $modulePath = Join-Path $libDir 'garabato_pkcs11.dll'

  # A 32-bit PowerShell on 64-bit Windows reports x86 and keeps the real
  # architecture in PROCESSOR_ARCHITEW6432.
  $arch = $env:PROCESSOR_ARCHITEW6432
  if (-not $arch) { $arch = $env:PROCESSOR_ARCHITECTURE }
  if ($arch -ne 'AMD64') {
    Write-GarabatoFailure "este procesador ($arch) no está soportado; en Windows solo x86_64."
    return
  }

  $profiles = Get-GarabatoProfiles
  $ready = @($profiles | Where-Object { $_.Ready })
  if ($ready.Count -eq 0) {
    Write-GarabatoFailure 'no encuentro ningún perfil de Firefox, Zen, LibreWolf, Floorp o Waterfox. Abre el navegador una vez y vuelve a ejecutar el comando.'
    return
  }

  $browsers = 'firefox', 'zen', 'librewolf', 'floorp', 'waterfox'
  if (Get-Process -Name $browsers -ErrorAction SilentlyContinue) {
    Write-Host 'Cierra tus navegadores (Firefox, Zen…) para continuar; espero a que se cierren…'
    $waited = 0
    while (Get-Process -Name $browsers -ErrorAction SilentlyContinue) {
      if ($waited -ge 300) {
        Write-GarabatoFailure 'los navegadores siguen abiertos. Ciérralos y vuelve a ejecutar el comando.'
        return
      }
      Start-Sleep -Seconds 2
      $waited += 2
    }
  }

  New-Item -ItemType Directory -Force -Path $libDir, $configDir | Out-Null
  $download = Join-Path $libDir ('.module-' + [guid]::NewGuid().ToString('N'))
  try {
    Write-Host 'Descargando el módulo (Windows x86_64)…'
    try {
      Invoke-WebRequest -UseBasicParsing -OutFile $download `
        -Uri "$GarabatoUrl/api/v1/certificateToken/module?os=windows&arch=x86_64"
    } catch {
      Write-GarabatoFailure "no se pudo descargar el módulo desde $GarabatoUrl."
      return
    }

    # Only now, with the module in hand, is the one-time code spent.
    $body = @{ code = $InstallCode; arch = 'x86_64'; os = 'windows' } | ConvertTo-Json -Compress
    try {
      $redeemed = Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $body `
        -Uri "$GarabatoUrl/api/v1/certificateToken/redeem"
    } catch {
      Write-GarabatoFailure 'el comando ha caducado o ya se usó. Genera otro en Garabato → Certificados → Conectar navegador.'
      return
    }
    if (-not $redeemed.key -or -not $redeemed.moduleSha256) {
      Write-GarabatoFailure 'Garabato ha dado una respuesta inesperada.'
      return
    }

    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $download).Hash.ToLowerInvariant()
    if ($actual -ne $redeemed.moduleSha256) {
      Write-GarabatoFailure 'el módulo descargado no coincide con el de Garabato. Desconecta este navegador en Garabato y vuelve a intentarlo.'
      return
    }
    Move-Item -LiteralPath $download -Destination $modulePath -Force
  } finally {
    Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue
  }

  $utf8 = New-Object Text.UTF8Encoding $false
  $config = @{ url = $GarabatoUrl; key = $redeemed.key } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $configDir 'token.json'), $config, $utf8)

  Write-Host 'Registrando «Garabato» en tus navegadores…'
  $registered = 0
  foreach ($browserProfile in $profiles) {
    # Profile folders are "<random>.<name>"; the name is what the user knows.
    $name = (Split-Path -Leaf $browserProfile.Path) -replace '^[^.]*\.', ''
    $label = "$($browserProfile.Browser), perfil $name"
    if (-not $browserProfile.Ready) {
      Write-Host "  ! ${label}: ábrelo una vez y vuelve a ejecutar el comando"
      continue
    }
    try {
      Set-GarabatoPkcs11 (Join-Path $browserProfile.Path 'pkcs11.txt') $modulePath
      Write-Host "  ✓ $label"
      $registered++
    } catch {
      Write-Host "  ✗ ${label}: no se pudo registrar"
    }
  }

  # PowerShell 5.1 reads a .ps1 without a byte-order mark as ANSI, which
  # would garble the accents, so this one keeps the mark.
  $uninstall = @'
@@UNINSTALL@@
'@
  [IO.File]::WriteAllText((Join-Path $libDir 'uninstall.ps1'), $uninstall, (New-Object Text.UTF8Encoding $true))

  if ($registered -eq 0) {
    Write-GarabatoFailure 'no se pudo registrar el módulo en ningún navegador.'
    return
  }

  Write-Host ''
  Write-Host 'Listo. Abre el navegador y entra en la sede con certificado.'
  Write-Host 'Cuando pida la contraseña de «Garabato», escribe el código de tu app de verificación en dos pasos.'
  Write-Host 'En Windows funciona con Firefox, Zen, LibreWolf, Floorp y Waterfox; Chrome, Edge y Brave no.'
  Write-Host "Para desinstalarlo: powershell -ExecutionPolicy Bypass -File `"$libDir\uninstall.ps1`""
}

Install-GarabatoToken
