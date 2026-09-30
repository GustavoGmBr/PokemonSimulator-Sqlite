param([string]$NodePath = '', [switch]$SkipFrontendBuild, [string]$ResumeStage = '', [switch]$ReuseTemplate, [switch]$ReplaceArtifacts, [switch]$PackageOnly)
$ErrorActionPreference = 'Stop'
$releaseRoot = Split-Path -Parent $PSScriptRoot
$releasePackage = Get-Content (Join-Path $releaseRoot 'package.json') -Raw | ConvertFrom-Json
$releaseVersion = $releasePackage.version
if ($releaseVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Use uma versão major.minor.patch.' }
if (-not $NodePath) { $NodePath = (Get-Command node).Source }
$releaseOutput = Join-Path $releaseRoot "dist/releases/v$releaseVersion"
$releaseStage = if ($ResumeStage) { [IO.Path]::GetFullPath($ResumeStage) } else { Join-Path $releaseOutput ('staging-' + [guid]::NewGuid().ToString('N')) }
if (-not $releaseStage.StartsWith([IO.Path]::GetFullPath($releaseOutput).TrimEnd('\') + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Área de montagem fora da pasta de releases.' }
$releaseFull = Join-Path $releaseStage 'compact'
$releaseComplete = Join-Path $releaseStage 'complete'
$releaseUpdate = Join-Path $releaseStage 'update'
New-Item -ItemType Directory -Path $releaseFull,$releaseUpdate -Force | Out-Null

function Copy-ReleaseTree([string]$Source, [string]$Destination) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  & robocopy.exe $Source $Destination /E /NFL /NDL /NJH /NJS /NP /XD .git (Join-Path $releaseRoot 'backend/public/pokemon') /XF .env '.env.local' '*.log' '*.db' '*.db-wal' '*.db-shm' '*.db-journal' '*.tmp*' | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "Falha ao copiar $Source" }
}
function Run-ReleaseNode([string[]]$Arguments) {
  & $NodePath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Comando de preparação falhou: $($Arguments -join ' ')" }
}
if (-not $PackageOnly) {
Write-Host "Preparando versão $releaseVersion para Windows x64…"
if (-not (Test-Path (Join-Path $releaseRoot 'backend/public/pokemon/1-front.png'))) {
  throw 'Execute npm run sprites:download na raiz antes de gerar uma nova versão.'
}
Run-ReleaseNode @((Join-Path $releaseRoot 'scripts/build-sprites.js'))
$releaseNpm = Join-Path (Split-Path $NodePath -Parent) 'node_modules/npm/bin/npm-cli.js'
if (-not $SkipFrontendBuild) {
  $releasePreviousOrigin = $env:VITE_API_ORIGIN
  try { $env:VITE_API_ORIGIN = ''; Run-ReleaseNode @($releaseNpm, '--prefix', (Join-Path $releaseRoot 'frontend'), 'run', 'build') }
  finally { $env:VITE_API_ORIGIN = $releasePreviousOrigin }
}
foreach ($directory in @('backend/src','backend/data','backend/public','backend/node_modules','backend/prisma/migrations','frontend/dist')) {
  Write-Host "Copiando $directory…"
  Copy-ReleaseTree (Join-Path $releaseRoot $directory) (Join-Path $releaseFull $directory)
}
foreach ($file in @('package.json','release-config.json','README.md','THIRD_PARTY_NOTICES.txt','iniciar-jogo.cmd','backend/package.json','backend/package-lock.json','backend/.env.example','backend/prisma/schema.prisma','backend/scripts/migrate-local.js','scripts/start-game.js','scripts/game-identity.js','scripts/game-ports.js','scripts/download-sprites.js','scripts/sprite-archive.js')) {
  $destination = Join-Path $releaseFull $file
  New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $releaseRoot $file) -Destination $destination
}
New-Item -ItemType Directory -Path (Join-Path $releaseFull 'runtime'),(Join-Path $releaseFull 'backend/templates') -Force | Out-Null
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $releaseFull 'runtime/node.exe')
$releaseNodeVersion = (& $NodePath --version).Trim()
$releaseLicense = Join-Path (Split-Path $NodePath -Parent) 'LICENSE'
if (Test-Path $releaseLicense) { Copy-Item $releaseLicense (Join-Path $releaseFull 'runtime/LICENSE') }
else { Invoke-WebRequest -Uri "https://raw.githubusercontent.com/nodejs/node/$releaseNodeVersion/LICENSE" -OutFile (Join-Path $releaseFull 'runtime/LICENSE') }
& (Join-Path $releaseRoot 'launcher/build.ps1') -OutputDirectory $releaseFull

Write-Host 'Criando banco inicial sem contas ou saves pessoais…'
$releasePreviousDatabase = $env:DATABASE_URL
$releaseTemplate = Join-Path $releaseFull 'backend/templates/pokemon.db'
$releaseSchema = Join-Path $releaseFull 'backend/prisma/schema.prisma'
$releasePrisma = Join-Path $releaseRoot 'backend/node_modules/prisma/build/index.js'
$releaseTemporaryDatabaseName = 'release-template-' + [guid]::NewGuid().ToString('N') + '.db'
$releaseTemporaryDatabase = Join-Path $releaseRoot "backend/$releaseTemporaryDatabaseName"
try {
  if (-not ($ReuseTemplate -and (Test-Path -LiteralPath $releaseTemplate))) {
  $env:DATABASE_URL = "file:../$releaseTemporaryDatabaseName"
  [IO.File]::WriteAllBytes($releaseTemporaryDatabase, [byte[]]@())
  Run-ReleaseNode @($releasePrisma,'migrate','deploy','--schema',(Join-Path $releaseRoot 'backend/prisma/schema.prisma'))
  Run-ReleaseNode @((Join-Path $releaseRoot 'backend/scripts/seed-moves.js'))
  Copy-Item -LiteralPath $releaseTemporaryDatabase -Destination $releaseTemplate -Force
  }
  $env:DATABASE_URL = 'file:../pokemon.db'
  Run-ReleaseNode @($releasePrisma,'generate','--schema',$releaseSchema)
}
finally {
  $env:DATABASE_URL = $releasePreviousDatabase
  if (Test-Path -LiteralPath $releaseTemporaryDatabase) { Remove-Item -LiteralPath $releaseTemporaryDatabase }
}
Write-Host 'Removendo ferramentas de desenvolvimento do pacote…'
$env:DATABASE_URL = 'file:../templates/pokemon.db'
try { Run-ReleaseNode @((Join-Path $releaseFull 'backend/scripts/migrate-local.js')) }
finally { $env:DATABASE_URL = $releasePreviousDatabase }
Run-ReleaseNode @($releaseNpm,'--prefix',(Join-Path $releaseFull 'backend'),'prune','--omit=dev','--no-audit','--no-fund')
foreach ($license in Get-ChildItem (Join-Path $releaseRoot 'frontend/node_modules') -Recurse -File -Filter 'LICENSE*') {
  $relative = $license.FullName.Substring((Join-Path $releaseRoot 'frontend/node_modules').Length + 1)
  $destination = Join-Path $releaseFull "runtime/licenses/frontend/$relative"
  New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $license.FullName -Destination $destination
}

Copy-ReleaseTree $releaseFull $releaseUpdate
# As sprites são baixadas separadamente no primeiro início.
$releaseUpdateSprites = [IO.Path]::GetFullPath((Join-Path $releaseUpdate 'backend/public/pokemon'))
$releaseStagePrefix = [IO.Path]::GetFullPath($releaseStage).TrimEnd('\') + '\'
if (-not $releaseUpdateSprites.StartsWith($releaseStagePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Pasta de atualização fora da área de montagem.' }
if (Test-Path -LiteralPath $releaseUpdateSprites) { Remove-Item -LiteralPath $releaseUpdateSprites -Recurse -Force }
# O banco de referência é copiado explicitamente, nunca o banco do jogador.
Copy-Item -LiteralPath $releaseTemplate -Destination (Join-Path $releaseUpdate 'backend/templates/pokemon.db')

Write-Host 'Preparando a edição completa com as sprites locais…'
Copy-ReleaseTree $releaseFull $releaseComplete
Copy-Item -LiteralPath $releaseTemplate -Destination (Join-Path $releaseComplete 'backend/templates/pokemon.db')
$releaseSpriteManifest = Get-Content (Join-Path $releaseRoot 'backend/data/sprite-download.json') -Raw | ConvertFrom-Json
$releaseCompleteSprites = Join-Path $releaseComplete 'backend/public/pokemon'
New-Item -ItemType Directory -Path $releaseCompleteSprites -Force | Out-Null
foreach ($sprite in $releaseSpriteManifest.files.PSObject.Properties) {
  if ($sprite.Name -notmatch '^[0-9][A-Za-z0-9._-]{0,98}\.(png|gif|webp)$') { throw 'Nome de sprite inválido.' }
  $sourceSprite = Join-Path $releaseRoot "backend/public/pokemon/$($sprite.Name)"
  if ((Get-Item -LiteralPath $sourceSprite).Length -ne $sprite.Value.size) { throw "Sprite incompleta: $($sprite.Name)" }
  Copy-Item -LiteralPath $sourceSprite -Destination (Join-Path $releaseCompleteSprites $sprite.Name)
}
# All images were hashed by build-sprites.js before packaging.
[IO.File]::WriteAllText((Join-Path $releaseCompleteSprites '.installed.json'), (@{sha256=$releaseSpriteManifest.sha256} | ConvertTo-Json -Compress))
} else {
  if (-not $ResumeStage) { throw 'PackageOnly exige ResumeStage com uma montagem concluída.' }
  foreach ($directory in @($releaseFull,$releaseComplete,$releaseUpdate)) {
    if (-not (Test-Path -LiteralPath (Join-Path $directory 'runtime/node.exe'))) { throw "Montagem incompleta: $directory" }
  }
  $releaseNodeVersion = (& (Join-Path $releaseFull 'runtime/node.exe') --version).Trim()
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($kind in @('compact','complete','update')) {
  $directory = if ($kind -eq 'compact') { $releaseFull } elseif ($kind -eq 'complete') { $releaseComplete } else { $releaseUpdate }
  foreach ($privateFile in Get-ChildItem -LiteralPath $directory -File -Recurse -Force) {
    $relative = $privateFile.FullName.Substring($directory.Length + 1).Replace('\','/')
    if (($privateFile.Name -like '.env*' -and $privateFile.Name -ne '.env.example') -or $privateFile.Name -like '*.log' -or $privateFile.Name -like '*.tmp*' -or ($privateFile.Name -match '\.db($|-)' -and $relative -ne 'backend/templates/pokemon.db')) {
      Remove-Item -LiteralPath $privateFile.FullName
    }
  }
  $files = @(Get-ChildItem -LiteralPath $directory -File -Recurse -Force | Where-Object { $_.Name -ne 'distribution.json' } | ForEach-Object { $_.FullName.Substring($directory.Length + 1).Replace('\','/') }) + 'distribution.json'
  @{ version=$releaseVersion; platform='win-x64'; kind=$kind; nodeVersion=$releaseNodeVersion; files=$files } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $directory 'distribution.json') -Encoding utf8
  $name = "PokemonSimulator-v$releaseVersion-$kind-win-x64.zip"
  $archive = Join-Path $releaseOutput $name
  $reuseArchive = $PackageOnly -and (Test-Path -LiteralPath $archive)
  if ($reuseArchive) {
    $existingZip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
      $entries = @($existingZip.Entries | Where-Object { -not $_.FullName.Replace('\','/').EndsWith('/') })
      if ($entries.Count -ne $files.Count) { throw 'O pacote existente difere da montagem.' }
      foreach ($entry in $entries) {
        if ($entry.FullName.Replace('\','/') -notin $files -or (Get-Item -LiteralPath (Join-Path $directory $entry.FullName)).Length -ne $entry.Length) { throw 'O pacote existente difere da montagem.' }
      }
    } finally { $existingZip.Dispose() }
  } elseif (Test-Path -LiteralPath $archive) {
    if (-not $ReplaceArtifacts) { throw "O artefato já existe: $archive. Use outra versão ou mova o arquivo existente." }
    Remove-Item -LiteralPath $archive
  }
  if (-not $reuseArchive) {
    Write-Host "Compactando $name…"
    [IO.Compression.ZipFile]::CreateFromDirectory($directory,$archive,[IO.Compression.CompressionLevel]::Optimal,$false)
  }
  $hasher = [Security.Cryptography.SHA256]::Create()
  $hashStream = [IO.File]::OpenRead($archive)
  try { $checksum = [BitConverter]::ToString($hasher.ComputeHash($hashStream)).Replace('-','').ToLowerInvariant() }
  finally { $hashStream.Dispose(); $hasher.Dispose() }
  "$checksum  $name" | Set-Content "$archive.sha256" -Encoding ascii
  Write-Host "$name criado: $([Math]::Round((Get-Item $archive).Length / 1MB, 1)) MB"
}
@{ version=$releaseVersion; fullDirectory=$releaseFull; compactDirectory=$releaseFull; completeDirectory=$releaseComplete; updateDirectory=$releaseUpdate } | ConvertTo-Json | Set-Content (Join-Path $releaseOutput 'build-info.json') -Encoding utf8
Write-Host "Pacotes disponíveis em $releaseOutput"
