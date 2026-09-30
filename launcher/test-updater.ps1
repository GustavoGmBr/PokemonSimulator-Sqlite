param([string]$UpdaterPath = '')
$ErrorActionPreference = 'Stop'
$testWorkspace = Split-Path -Parent $PSScriptRoot
if (-not $UpdaterPath) { $UpdaterPath = Join-Path $testWorkspace 'dist/compiled/PokemonSimulatorUpdater.exe' }
$testRoot = Join-Path $testWorkspace ('dist/updater-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
function New-TestPackage([string]$Case, [System.Collections.IDictionary]$Files) {
  $stage = Join-Path $testRoot "$Case/package"
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  foreach ($name in $Files.Keys) {
    $destination = Join-Path $stage $name
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    [IO.File]::WriteAllText($destination,$Files[$name])
  }
  @{version='0.2.1';platform='win-x64';kind='update';files=@($Files.Keys)+'distribution.json'} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $stage 'distribution.json') -Encoding utf8
  $zip = Join-Path $testRoot "$Case/update.zip"
  [IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip)
  return $zip
}
function Invoke-TestUpdate([string]$Case, [string]$Zip, [string]$Hash, [int]$Expected) {
  $target = Join-Path $testRoot "$Case/game"
  New-Item -ItemType Directory -Path (Join-Path $target 'backend'),(Join-Path $target 'scripts') -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $target 'backend/pokemon.db'),'save-pessoal-preservado')
  [IO.File]::WriteAllText((Join-Path $target 'backend/.env'),'configuracao-pessoal-preservada')
  [IO.File]::WriteAllText((Join-Path $target 'scripts/marker.txt'),'versao-anterior')
  $arguments = "--apply `"$target`" `"$Zip`" $Hash 0.2.1 0 --no-restart"
  $result = Start-Process -FilePath $UpdaterPath -ArgumentList $arguments -WindowStyle Hidden -PassThru
  if (-not $result.WaitForExit(15000) -or $result.ExitCode -ne $Expected) { throw "Falha no caso $Case" }
  if ([IO.File]::ReadAllText((Join-Path $target 'backend/pokemon.db')) -ne 'save-pessoal-preservado') { throw 'Save foi alterado.' }
  if ([IO.File]::ReadAllText((Join-Path $target 'backend/.env')) -ne 'configuracao-pessoal-preservada') { throw 'Configuração foi alterada.' }
  return $target
}
$zip = New-TestPackage 'valid' @{'scripts/marker.txt'='versao-nova'}
$target = Invoke-TestUpdate 'valid' $zip (Get-FileHash $zip).Hash 0
if ([IO.File]::ReadAllText((Join-Path $target 'scripts/marker.txt')) -ne 'versao-nova') { throw 'Atualização não foi instalada.' }
Write-Host 'PASS: atualização válida preserva saves e configuração.'
$zip = New-TestPackage 'checksum' @{'scripts/marker.txt'='versao-nova'}
$target = Invoke-TestUpdate 'checksum' $zip ('0'*64) 1
if ([IO.File]::ReadAllText((Join-Path $target 'scripts/marker.txt')) -ne 'versao-anterior') { throw 'Checksum inválido foi aceito.' }
Write-Host 'PASS: checksum inválido não altera a instalação.'
$zip = New-TestPackage 'protected-save' @{'backend/pokemon.db'='nao-pode-substituir-save'}
$null = Invoke-TestUpdate 'protected-save' $zip (Get-FileHash $zip).Hash 1
Write-Host 'PASS: pacote não pode substituir o banco do jogador.'
$zip = New-TestPackage 'rollback' ([ordered]@{'scripts/marker.txt'='versao-nova';'scripts/locked.txt'='arquivo'})
$target = Join-Path $testRoot 'rollback/game'
New-Item -ItemType Directory -Path (Join-Path $target 'scripts/locked.txt') -Force | Out-Null
$target = Invoke-TestUpdate 'rollback' $zip (Get-FileHash $zip).Hash 1
if ([IO.File]::ReadAllText((Join-Path $target 'scripts/marker.txt')) -ne 'versao-anterior') { throw 'Rollback não recuperou os arquivos.' }
Write-Host 'PASS: falha de instalação recupera a versão anterior.'
$caseRoot = Join-Path $testRoot 'traversal'
New-Item -ItemType Directory -Path $caseRoot -Force | Out-Null
$zip = Join-Path $caseRoot 'update.zip'
$archive = [IO.Compression.ZipFile]::Open($zip,[IO.Compression.ZipArchiveMode]::Create)
$entry = $archive.CreateEntry('../escape.txt')
$writer = New-Object IO.StreamWriter($entry.Open())
$writer.Write('fora-da-pasta'); $writer.Dispose(); $archive.Dispose()
$null = Invoke-TestUpdate 'traversal' $zip (Get-FileHash $zip).Hash 1
if (Test-Path (Join-Path $caseRoot 'escape.txt')) { throw 'Arquivo escapou da área de atualização.' }
Write-Host 'PASS: caminhos fora da pasta são recusados.'
