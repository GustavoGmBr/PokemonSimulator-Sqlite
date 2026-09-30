import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { githubClient } from './github-api.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, 'release-config.json'), 'utf8'));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tag = `v${version}`;
const output = path.join(root, 'dist/releases', tag);
const names = [`PokemonSimulator-${tag}-win-x64.zip`, `PokemonSimulator-${tag}-update-win-x64.zip`];
const assets = names.flatMap(name => [name, `${name}.sha256`]);
for (const name of assets) if (!fs.existsSync(path.join(output, name))) throw new Error(`Gere os pacotes antes de publicar: ${name}`);
const client = await githubClient();
const user = await client.request('/user');
const [owner, repository] = config.repository.split('/');
if (owner !== user.login) throw new Error(`A conta autenticada (${user.login}) não corresponde ao proprietário configurado (${owner}).`);
function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} falhou`);
  return result.stdout.trim();
}
let remote;
try { remote = await client.request(`/repos/${config.repository}`); } catch (error) { if (error.status !== 404) throw error; }
const source = path.join(output, `source-${Date.now()}`);
fs.mkdirSync(source, { recursive: true });
if (remote) {
  git(root, ['clone', '--depth', '1', '--branch', 'main', remote.clone_url, source]);
  for (const name of git(source, ['ls-files']).split('\n').filter(Boolean)) fs.rmSync(path.join(source, name), { force: true });
} else git(source, ['init', '--initial-branch=main']);
const files = git(root, ['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(Boolean);
for (const relative of files) {
  if (relative.startsWith('backend/public/pokemon/') || /(^|\/)(node_modules|dist|\.git|runtime)\//.test(relative) || /\.(exe|db|log)(-|$)/i.test(relative) || /(^|\/)\.env(?!\.example$)/.test(relative)) continue;
  const original = path.join(root, relative);
  if (!fs.existsSync(original) || !fs.statSync(original).isFile()) continue;
  if (fs.statSync(original).size > 95 * 1024 * 1024) throw new Error(`Arquivo de código-fonte grande demais: ${relative}`);
  const destination = path.join(source, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(original, destination);
}
git(source, ['config', 'user.name', user.login]);
git(source, ['config', 'user.email', `${user.id}+${user.login}@users.noreply.github.com`]);
git(source, ['add', '--all']);
if (git(source, ['status', '--porcelain'])) git(source, ['commit', '-m', `Release ${tag}: offline SQLite game and automatic updates`]);
const commit = git(source, ['rev-parse', 'HEAD']);
if (!remote) {
  remote = await client.request('/user/repos', { method: 'POST', body: { name: repository, description: 'Simulador Pokémon offline para Windows, com saves SQLite e atualizações automáticas.', private: false, auto_init: false, has_wiki: false } });
  git(source, ['remote', 'add', 'origin', remote.clone_url]);
  console.log(`Repositório criado: ${remote.html_url}`);
}
git(source, ['push', 'origin', 'main']);
console.log(`Código publicado: ${commit}`);
let release;
const releases = await client.request(`/repos/${config.repository}/releases`);
release = releases.find(item => item.tag_name === tag);
if (release && !release.draft) throw new Error(`${tag} já está publicada. Aumente a versão antes de publicar outra release.`);
if (!release) release = await client.request(`/repos/${config.repository}/releases`, { method: 'POST', body: { tag_name: tag, target_commitish: commit, name: `Pokémon Simulator SQLite ${tag}`, body: fs.readFileSync(path.join(root, 'RELEASE_NOTES.md'), 'utf8'), draft: true, prerelease: false } });
for (const name of assets) {
  const file = path.join(output, name);
  const size = fs.statSync(file).size;
  const existing = release.assets.find(asset => asset.name === name && asset.size === size && asset.state === 'uploaded');
  if (existing) { console.log(`Arquivo já enviado: ${name}`); continue; }
  const incomplete = release.assets.find(asset => asset.name === name);
  if (incomplete) await client.request(`/repos/${config.repository}/releases/assets/${incomplete.id}`, { method: 'DELETE' });
  console.log(`Enviando ${name} (${(size / 1024 / 1024).toFixed(1)} MB)…`);
  const stream = fs.createReadStream(file);
  let sent = 0;
  let last = Date.now();
  stream.on('data', chunk => { sent += chunk.length; if (Date.now() - last > 20_000) { console.log(`${name}: ${Math.floor(sent * 100 / size)}%`); last = Date.now(); } });
  const uploaded = await new Promise((resolve, reject) => {
    const request = https.request(`${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...client.headers, 'Content-Type': name.endsWith('.zip') ? 'application/zip' : 'text/plain', 'Content-Length': String(size) } }, response => {
      response.setEncoding('utf8'); let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => { try { const data = JSON.parse(body); if (response.statusCode >= 300) reject(new Error(`Falha no envio de ${name}: HTTP ${response.statusCode} ${data.message}`)); else resolve(data); } catch (error) { reject(error); } });
    });
    request.setTimeout(15 * 60_000, () => request.destroy(new Error(`Tempo limite no envio de ${name}.`)));
    request.on('error', reject); stream.on('error', reject); stream.pipe(request);
  });
  if (name.endsWith('.zip') && uploaded.digest) {
    const expected = fs.readFileSync(`${file}.sha256`, 'ascii').split(/\s/)[0];
    if (uploaded.digest !== `sha256:${expected}`) throw new Error(`Checksum divergente no GitHub: ${name}`);
  }
  console.log(`Enviado: ${name}`);
}
release = await client.request(`/repos/${config.repository}/releases/${release.id}`, { method: 'PATCH', body: { draft: false, make_latest: 'true' } });
fs.writeFileSync(path.join(output, 'published.json'), `${JSON.stringify({ repository: remote.html_url, release: release.html_url, commit, tag, assets: release.assets.map(asset => ({ name: asset.name, url: asset.browser_download_url, size: asset.size })) }, null, 2)}\n`);
console.log(`Versão publicada: ${release.html_url}`);
