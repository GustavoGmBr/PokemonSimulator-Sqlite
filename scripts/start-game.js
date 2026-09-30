import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { workspaceId, gameVersion } from './game-identity.js';
import { API_PORT, FRONTEND_PORT, availablePort } from './game-ports.js';
import { ensureSprites } from './download-sprites.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
const backendEnv = path.join(backend, '.env');
const portable = existsSync(path.join(root, 'distribution.json'));
let frontendPort = FRONTEND_PORT;
let frontendOrigin = `http://127.0.0.1:${frontendPort}`;
const noBrowser = process.argv.includes('--no-browser') || process.env.POKEMON_SIMULATOR_NO_BROWSER === '1';
const children = new Map();
const setupProcesses = new Set();
let stopping = false;
let childFailure = null;
const startup = new AbortController();

function envValue(source, name) {
  const match = source.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm'));
  return match?.[1]?.trim().replace(/^(?:"(.*)"|'(.*)')$/, '$1$2') ?? '';
}

function schemaText(source) {
  return source.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\s+/g, part => part.startsWith('"') ? part : '');
}

function finishIfStopped() {
  if (stopping && children.size === 0 && setupProcesses.size === 0) process.stdin.pause();
}

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error('Instale Node.js 22.12 ou superior para iniciar o jogo.');
  }
}

function loadConfig() {
  if (!existsSync(backendEnv)) {
    const template = readFileSync(path.join(backend, '.env.example'), 'utf8');
    writeFileSync(backendEnv, template, { flag: 'wx' });
    console.log('Criei backend/.env com a configuração padrão do banco SQLite local.');
  }
  let source = readFileSync(backendEnv, 'utf8');
  if (!envValue(source, 'DATABASE_URL').startsWith('file:')) {
    source = /^\s*DATABASE_URL=.*$/m.test(source)
      ? source.replace(/^\s*DATABASE_URL=.*$/m, 'DATABASE_URL="file:../pokemon.db"')
      : `${source.trimEnd()}\nDATABASE_URL="file:../pokemon.db"\n`;
    writeFileSync(backendEnv, source);
    console.log('Atualizei DATABASE_URL para usar backend/pokemon.db.');
  }
  const configuredPort = Number(process.env.POKEMON_SIMULATOR_API_PORT || envValue(source, 'PORT') || API_PORT);
  const port = [3001, 3334, 3435, 5173, 5184, 5185].includes(configuredPort) ? API_PORT : configuredPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT em backend/.env deve estar entre 1 e 65535.');
  }
  return { port, databaseUrl: envValue(source, 'DATABASE_URL'), apiUrl: `http://127.0.0.1:${port}/api/health/ready` };
}

function run(label, cwd, command) {
  console.log(`\n${label}...`);
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    const commandPath = existsSync(npmCli) ? process.execPath : isWindows ? 'cmd.exe' : 'npm';
    const args = existsSync(npmCli) ? [npmCli, ...command] : isWindows
      ? ['/d', '/s', '/c', `npm ${command.join(' ')}`] : command;
    const child = spawn(commandPath, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    setupProcesses.add(child);
    child.once('error', (error) => { setupProcesses.delete(child); finishIfStopped(); reject(error); });
    child.once('exit', (code) => {
      setupProcesses.delete(child);
      finishIfStopped();
      code === 0 ? resolve() : reject(new Error(`${label} falhou (código ${code}).`));
    });
  });
}

function runNode(label, cwd, script, env = {}) {
  console.log(`\n${label}...`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    setupProcesses.add(child);
    child.once('error', (error) => { setupProcesses.delete(child); finishIfStopped(); reject(error); });
    child.once('exit', (code) => {
      setupProcesses.delete(child);
      finishIfStopped();
      code === 0 ? resolve() : reject(new Error(`${label} falhou (código ${code}).`));
    });
  });
}

async function ensureDependencies(directory) {
  if (existsSync(path.join(directory, 'node_modules'))) return;
  await run(`Instalando dependências de ${path.basename(directory)}`, directory, ['ci']);
}

async function isApiReady(url) {
  try {
    const [healthResponse, savesResponse] = await Promise.all([
      fetch(url, { signal: AbortSignal.timeout(1500) }),
      fetch(url.replace('/health/ready', '/jogador/saves'), { signal: AbortSignal.timeout(1500) }),
    ]);
    const [health, saves] = await Promise.all([healthResponse.json(), savesResponse.json()]);
    return healthResponse.headers.get('x-pokemon-workspace') === workspaceId && healthResponse.headers.get('x-pokemon-version') === gameVersion &&
      healthResponse.ok && health?.success === true && health?.data?.database === 'online' &&
      savesResponse.ok && saves?.success === true && Array.isArray(saves.data);
  } catch { return false; }
}

async function isFrontendReady() {
  try {
    const [page, health, saves, sprite] = await Promise.all([
      fetch(frontendOrigin, { signal: AbortSignal.timeout(1500) }),
      fetch(`${frontendOrigin}/api/health/ready`, { signal: AbortSignal.timeout(1500) }),
      fetch(`${frontendOrigin}/api/jogador/saves`, { signal: AbortSignal.timeout(1500) }),
      fetch(`${frontendOrigin}/assets/pokemon/1-front.png`, { signal: AbortSignal.timeout(1500) }),
    ]);
    if (!page.ok || !(await page.text()).includes('<title>Pokémon Simulator')) return false;
    if (page.headers.get('x-pokemon-workspace') !== workspaceId || health.headers.get('x-pokemon-workspace') !== workspaceId) return false;
    if (health.headers.get('x-pokemon-version') !== gameVersion) return false;
    if (!health.ok || (await health.json())?.data?.database !== 'online') return false;
    if (!saves.ok || !(await saves.json())?.success) return false;
    return sprite.ok && sprite.headers.get('content-type')?.startsWith('image/');
  } catch { return false; }
}

async function waitUntil(check, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    checkStopping();
    if (childFailure) throw childFailure;
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${label} não respondeu em 30 segundos. Confira as mensagens acima.`);
}

function checkStopping() {
  if (stopping) throw new Error('Inicialização cancelada.');
}

function startService(name, cwd, script, args = [], env = {}) {
  const child = spawn(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
  children.set(name, child);
  child.once('error', (error) => { childFailure = new Error(`${name}: ${error.message}`); });
  child.once('exit', (code) => {
    children.delete(name);
    if (!stopping) {
      childFailure = new Error(`${name} encerrou inesperadamente (código ${code}).`);
      console.error(`\n${childFailure.message}`);
      stop();
      process.exitCode = 1;
    }
    finishIfStopped();
  });
}

async function chooseApiPort(config) {
  config.port = await availablePort(config.port, { signal: startup.signal });
  config.apiUrl = `http://127.0.0.1:${config.port}/api/health/ready`;
  return false;
}

async function chooseFrontendPort() {
  frontendPort = await availablePort(FRONTEND_PORT, { signal: startup.signal });
  frontendOrigin = `http://127.0.0.1:${frontendPort}`;
  return false;
}

function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform !== 'win32') { child.kill(); return; }
  const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  killer.once('error', () => child.kill());
}

function stop() {
  if (stopping) return;
  stopping = true;
  startup.abort();
  for (const child of children.values()) stopProcess(child);
  for (const child of setupProcesses) stopProcess(child);
  finishIfStopped();
}

if (process.env.POKEMON_SIMULATOR_GUI === '1') {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (input) => {
    if (input.trim().toLowerCase() === 'stop') stop();
  });
  process.stdin.on('end', stop);
}

function openBrowser() {
  if (noBrowser) return;
  const frontendUrl = `${frontendOrigin}/saves`;
  const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `start "" "${frontendUrl}"`]
    : [frontendUrl];
  const opener = spawn(command, args, { stdio: 'ignore', windowsHide: true });
  opener.once('error', () => console.log(`Abra ${frontendUrl} no navegador.`));
  opener.unref();
}

async function main() {
  checkNode();
  const config = loadConfig();
  await ensureSprites({ root, signal: startup.signal });
  checkStopping();
  const apiReady = await chooseApiPort(config);
  const webReady = portable ? false : await chooseFrontendPort();
  checkStopping();

  if (!apiReady) {
    if (portable) {
      const database = path.resolve(backend, 'prisma', config.databaseUrl.slice(5));
      if (!existsSync(database)) {
        copyFileSync(path.join(backend, 'templates', 'pokemon.db'), database, constants.COPYFILE_EXCL);
        console.log('Banco local preparado. Seus saves serão guardados em backend/pokemon.db.');
      }
    } else {
      await ensureDependencies(backend);
      checkStopping();
      const generatedSchema = path.join(backend, 'node_modules/.prisma/client/schema.prisma');
      const currentSchema = schemaText(readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8'));
      if (!existsSync(generatedSchema) || schemaText(readFileSync(generatedSchema, 'utf8')) !== currentSchema) {
        await run('Gerando Prisma Client', backend, ['run', 'prisma:generate']);
      }
      checkStopping();
      await run('Preparando banco SQLite', backend, ['run', 'db:setup']);
      checkStopping();
      await runNode('Verificando golpes no banco', backend, 'scripts/seed-moves-if-needed.js');
      checkStopping();
    }
    if (portable) await runNode('Verificando atualizações do banco SQLite', backend, 'scripts/migrate-local.js', { DATABASE_URL: config.databaseUrl });
    checkStopping();
    console.log('\nIniciando API...');
    startService('API', backend, 'src/server.js', [], {
      PORT: String(config.port),
      HOST: '127.0.0.1',
      CORS_ORIGIN: frontendOrigin,
      ...(portable ? { POKEMON_SIMULATOR_PORTABLE: '1', DATABASE_URL: config.databaseUrl } : {}),
    });
    await waitUntil(() => isApiReady(config.apiUrl), 'API');
  } else {
    console.log('API já está ativa.');
  }

  if (portable) {
    frontendOrigin = `http://127.0.0.1:${config.port}`;
    await waitUntil(isFrontendReady, 'Interface');
  } else if (!webReady) {
    await ensureDependencies(frontend);
    checkStopping();
    console.log('\nIniciando interface...');
    startService('Interface', frontend, 'node_modules/vite/bin/vite.js', ['--host', '127.0.0.1', '--port', String(frontendPort)], {
      API_PROXY_TARGET: `http://127.0.0.1:${config.port}`,
      VITE_API_ORIGIN: '',
    });
    await waitUntil(isFrontendReady, 'Interface');
  } else {
    console.log('Interface já está ativa.');
  }

  checkStopping();
  console.log(`\nJogo pronto: ${frontendOrigin}/saves`);
  if (children.size) console.log('Mantenha esta janela aberta enquanto joga. Ctrl+C encerra o jogo.');
  openBrowser();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

main().catch((error) => {
  if (stopping) return;
  console.error(`\nNão foi possível iniciar: ${error.message}`);
  stop();
  process.exitCode = 1;
});
