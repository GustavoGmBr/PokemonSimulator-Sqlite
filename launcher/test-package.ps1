param([string]$Version = '')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
if (-not $Version) { $Version = (Get-Content (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version }
$output = Join-Path $workspace "dist/releases/v$Version"
$build = Get-Content (Join-Path $output 'build-info.json') -Raw | ConvertFrom-Json
$case = Join-Path $workspace ('dist/package-test-' + [guid]::NewGuid().ToString('N'))
$target = Join-Path $case 'Instalação com espaços'
New-Item -ItemType Directory -Path $target -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($kind in @('compact','complete','update')) {
  $archive = [IO.Compression.ZipFile]::OpenRead((Join-Path $output "PokemonSimulator-v$Version-$kind-win-x64.zip"))
  try {
    $sprites = @($archive.Entries | Where-Object { $_.FullName.Replace('\','/') -match '^backend/public/pokemon/[0-9].+\.(png|gif|webp)$' })
    if (($kind -eq 'complete' -and $sprites.Count -ne 13932) -or ($kind -ne 'complete' -and $sprites.Count -ne 0)) { throw "Sprites incorretas: $kind" }
    foreach ($entry in $archive.Entries) {
      $relative = $entry.FullName.Replace('\','/')
      if (($relative -match '(^|/)\.env($|\.)' -and -not $relative.EndsWith('.env.example')) -or ($relative -match '\.db($|-)' -and $relative -ne 'backend/templates/pokemon.db')) { throw 'Dados privados no pacote.' }
    }
    $reader = New-Object IO.StreamReader($archive.GetEntry('distribution.json').Open())
    try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    if ($manifest.version -ne $Version -or $manifest.kind -ne $kind) { throw 'Manifesto incorreto.' }
  } finally { $archive.Dispose() }
}
Write-Host 'PASS: os três pacotes têm manifestos corretos, sprites somente na edição completa e nenhum save pessoal.'
[IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $output "PokemonSimulator-v$Version-complete-win-x64.zip"), $target)
$database = Join-Path $target 'backend/pokemon.db'
$seed = Join-Path $case 'legacy-save.mjs'
@'
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const db = new DatabaseSync(process.argv[2]);
db.exec(readFileSync(process.argv[3], 'utf8'));
db.prepare('ATTACH DATABASE ? AS reference').run(process.argv[4]);
db.exec('INSERT INTO GolpeBatalha SELECT * FROM reference.GolpeBatalha; INSERT INTO EspecieAtaque SELECT * FROM reference.EspecieAtaque; DETACH DATABASE reference;');
db.exec(`INSERT INTO Usuario (id, login, senhaHash, atualizadoEm) VALUES ('qa-owner', 'local-qa', 'local-save', CURRENT_TIMESTAMP);
INSERT INTO Save (id, usuarioId, nomeTreinador, moedas, fichas, inicialEspecieId, iniciadoEm, atualizadoEm) VALUES ('qa-save', 'qa-owner', 'Save preservado', 12345, 123, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO PokemonCapturado (id, saveId, especieId, nivel, hpAtual) VALUES ('qa-starter', 'qa-save', 1, 5, 20);`);
db.close();
'@ | Set-Content -LiteralPath $seed -Encoding utf8
& (Join-Path $target 'runtime/node.exe') $seed $database (Join-Path $target 'backend/prisma/migrations/20260930000000_sqlite_initial/migration.sql') (Join-Path $target 'backend/templates/pokemon.db')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar save anterior de teste.' }
[IO.File]::WriteAllText((Join-Path $target 'backend/.env'), "DATABASE_URL=`"file:../pokemon.db`"`nPORT=34435`n")
[IO.File]::WriteAllText((Join-Path $target 'package.json'), '{"version":"0.2.2"}')
$saveBytes = [IO.File]::ReadAllBytes($database)
$updateZip = Join-Path $output "PokemonSimulator-v$Version-update-win-x64.zip"
$checksum = ([IO.File]::ReadAllText("$updateZip.sha256") -split '\s+')[0]
$downloadCache = Join-Path $env:LOCALAPPDATA ('PokemonSimulator/updates/test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $downloadCache -Force | Out-Null
$cachedZip = Join-Path $downloadCache "PokemonSimulator-v$Version-update-win-x64.zip"
Copy-Item -LiteralPath $updateZip -Destination $cachedZip
$helper = Join-Path $build.compactDirectory 'PokemonSimulatorUpdater.exe'
$arguments = "--apply `"$target`" `"$cachedZip`" $checksum $Version 0 --no-restart"
$installer = Start-Process -FilePath $helper -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $installer.WaitForExit(60000) -or $installer.ExitCode -ne 0) { throw 'O pacote real de atualização não foi instalado.' }
if ([Convert]::ToBase64String([IO.File]::ReadAllBytes($database)) -ne [Convert]::ToBase64String($saveBytes)) { throw 'Banco alterado pelo instalador.' }
if ((Get-Content (Join-Path $target 'package.json') -Raw | ConvertFrom-Json).version -ne $Version) { throw 'Versão instalada incorreta.' }
Write-Host 'PASS: atualização real a partir de AppData instala sem exceder o limite de caminhos e preserva o banco anterior byte a byte.'
$launcher = Start-Process -FilePath (Join-Path $target 'PokemonSimulator.exe') -ArgumentList '--check --skip-update' -WindowStyle Hidden -PassThru
if (-not $launcher.WaitForExit(60000) -or $launcher.ExitCode -ne 0) { throw "Inicialização do jogo empacotado falhou. Log: $(Join-Path $target 'launcher/latest.log')" }
$verify = Join-Path $case 'verify-save.mjs'
@'
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const db = new DatabaseSync(process.argv[2]);
const save = db.prepare('SELECT moedas, fichas FROM Save WHERE id=?').get('qa-save');
const pokemon = db.prepare('SELECT ivs FROM PokemonCapturado WHERE id=?').get('qa-starter');
if (save.moedas !== 12345 || save.fichas !== 123 || Object.values(JSON.parse(pokemon.ivs)).some(value => value !== 31)) throw Error('Save ou migração de IVs incorretos.');
db.close();
const root = path.dirname(path.dirname(process.argv[2]));
const requirePackage = createRequire(path.join(root, 'backend/package.json'));
const { PrismaClient } = requirePackage('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: `file:${process.argv[2].replaceAll('\\', '/')}` });
const { createApp } = await import(pathToFileURL(path.join(root, 'backend/src/app.js')));
const server = createApp({ db: prisma, config: { CORS_ORIGIN: 'http://127.0.0.1' } }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/cassino`, { headers: { 'X-Save-Id': 'qa-save' } });
  if (!response.ok) throw Error('Packaged casino API failed.');
  const { data } = await response.json();
  if (data.regras.roleta.length !== 37 || data.regras.corredores.length !== 5 || data.regras.fortune.length !== 7 || data.fichas !== 123) throw Error('Packaged casino rules or wallet differ.');
} finally { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); }
'@ | Set-Content -LiteralPath $verify -Encoding utf8
& (Join-Path $target 'runtime/node.exe') $verify $database
if ($LASTEXITCODE -ne 0) { throw 'A migração do save antigo falhou.' }
Write-Host 'PASS: EXE inicia jogo, API, interface e sprites; migra save antigo para IVs sem perder moedas ou fichas.'
