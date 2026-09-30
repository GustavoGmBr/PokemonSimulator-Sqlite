param([string]$UpdaterPath = '')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
if (-not $UpdaterPath) { $UpdaterPath = Join-Path $workspace 'dist/compiled/PokemonSimulatorUpdater.exe' }
$case = Join-Path $workspace ('dist/handover-' + [guid]::NewGuid().ToString('N'))
$target = Join-Path $case 'Jogo Pokémon com espaços'
$stage = Join-Path $case 'package'
New-Item -ItemType Directory -Path $target,$stage,(Join-Path $target 'backend') -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $target 'backend/pokemon.db'),'save-preservado')
[IO.File]::WriteAllText((Join-Path $target 'package.json'),'{"version":"0.2.2"}')
$parentSource = Join-Path $case 'Parent.cs'
@'
using System;
using System.IO;
using System.Diagnostics;
internal static class Parent {
    private static void Main(string[] args) {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string ready = Path.Combine(Path.GetDirectoryName(args[1]), "ready");
        ProcessStartInfo info = new ProcessStartInfo(args[0]);
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.Arguments = "--apply " + UpdateService.Quote(root) + " " + UpdateService.Quote(args[1]) + " " + args[2] + " 0.2.3 " + Process.GetCurrentProcess().Id + " --ready-file " + UpdateService.Quote(ready);
        using (Process installer = Process.Start(info)) {
            DateTime deadline = DateTime.UtcNow.AddSeconds(20);
            while (!File.Exists(ready)) {
                if (installer.HasExited || DateTime.UtcNow > deadline) { Environment.ExitCode = 1; return; }
                System.Threading.Thread.Sleep(50);
            }
        }
    }
}
'@ | Set-Content -LiteralPath $parentSource -Encoding utf8
$nextSource = Join-Path $case 'Next.cs'
@'
using System;
using System.IO;
internal static class Next {
    private static void Main(string[] args) {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        File.WriteAllText(Path.Combine(root, "restarted.txt"), string.Join(" ", args));
    }
}
'@ | Set-Content -LiteralPath $nextSource -Encoding utf8
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe "/out:$(Join-Path $target 'PokemonSimulator.exe')" /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll $parentSource (Join-Path $PSScriptRoot 'UpdateService.cs')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar a simulação de passagem.' }
& $compiler /nologo /target:winexe "/out:$(Join-Path $stage 'PokemonSimulator.exe')" $nextSource
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o próximo inicializador.' }
[IO.File]::WriteAllText((Join-Path $stage 'package.json'),'{"version":"0.2.3"}')
@{version='0.2.3';kind='update';platform='win-x64';files=@('PokemonSimulator.exe','package.json','distribution.json')} | ConvertTo-Json | Set-Content (Join-Path $stage 'distribution.json') -Encoding utf8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $case 'update.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip)
$hash = (Get-FileHash -LiteralPath $zip).Hash
$arguments = @('"' + $UpdaterPath + '"', '"' + $zip + '"', $hash) -join ' '
$parent = Start-Process -FilePath (Join-Path $target 'PokemonSimulator.exe') -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $parent.WaitForExit(25000) -or $parent.ExitCode -ne 0) { throw 'O instalador não confirmou o início.' }
$deadline = [DateTime]::UtcNow.AddSeconds(20)
while (-not (Test-Path (Join-Path $target 'restarted.txt'))) {
  if ([DateTime]::UtcNow -gt $deadline) { throw 'O jogo não reiniciou após instalar a atualização.' }
  Start-Sleep -Milliseconds 100
}
if ([IO.File]::ReadAllText((Join-Path $target 'restarted.txt')) -ne '--skip-update') { throw 'O reinício poderia entrar em loop.' }
if ((Get-Content (Join-Path $target 'package.json') -Raw | ConvertFrom-Json).version -ne '0.2.3') { throw 'A versão instalada não mudou.' }
if ([IO.File]::ReadAllText((Join-Path $target 'backend/pokemon.db')) -ne 'save-preservado') { throw 'Save alterado.' }
Write-Host 'PASS: pasta com espaços e barra final, confirmação, encerramento, substituição do EXE, instalação e reinício sem loop.'
