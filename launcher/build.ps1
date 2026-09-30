param([string]$OutputName = 'PokemonSimulator.exe', [string]$OutputDirectory = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$source = Join-Path $PSScriptRoot 'Program.cs'
if (-not $OutputDirectory) { $OutputDirectory = $root }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = Join-Path $OutputDirectory $OutputName

if (-not (Test-Path -LiteralPath $compiler)) {
  throw 'O compilador do .NET Framework 4.x não foi encontrado neste Windows.'
}

& $compiler /nologo /target:winexe /out:$output /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll $source (Join-Path $PSScriptRoot 'UpdateService.cs')
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível compilar PokemonSimulator.exe.' }
$updaterOutput = Join-Path $OutputDirectory 'PokemonSimulatorUpdater.exe'
& $compiler /nologo /target:winexe /out:$updaterOutput /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $PSScriptRoot 'Updater.cs')
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível compilar o atualizador.' }
Write-Host "Executável criado: $output"
