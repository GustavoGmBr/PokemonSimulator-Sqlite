import { existsSync, readFileSync, createReadStream, createWriteStream, statSync } from 'node:fs';
import { mkdir, rm, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpriteArchive, spriteName } from './sprite-archive.js';

export async function ensureSprites({ root, signal, report = console.log, fetchImpl = fetch }) {
  const configPath = path.join(root, 'backend/data/sprite-download.json');
  if (!existsSync(configPath)) throw new Error('Manifesto das sprites ausente. Atualize os arquivos do jogo.');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository) || !/^v\d+\.\d+\.\d+$/.test(config.tag) || !/^PokemonSimulator-sprites-v\d+\.\d+\.\d+\.tar\.gz$/.test(config.asset) || !/^[a-f0-9]{64}$/.test(config.sha256)) throw new Error('Manifesto das sprites inválido.');
  const names = Object.keys(config.files);
  if (!names.length || names.some(name => !spriteName(name))) throw new Error('Lista de sprites inválida.');
  const directory = path.join(root, 'backend/public/pokemon');
  const marker = path.join(directory, '.installed.json');
  let installed;
  try { installed = JSON.parse(readFileSync(marker, 'utf8')); } catch { }
  const complete = names.every(name => {
    const file = path.join(directory, name);
    return existsSync(file) && statSync(file).isFile() && statSync(file).size === config.files[name].size;
  });
  if (complete && installed?.sha256 === config.sha256) return;
  if (complete) {
    report('Verificando sprites locais…');
    let valid = true;
    for (const name of names) {
      signal?.throwIfAborted();
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(path.join(directory, name))) hash.update(chunk);
      if (hash.digest('hex') !== config.files[name].sha256) { valid = false; break; }
    }
    if (valid) {
      await writeFile(marker, JSON.stringify({ sha256: config.sha256 }));
      return;
    }
  }
  const cache = path.join(root, '.cache/sprites');
  await mkdir(cache, { recursive: true });
  const archive = path.join(cache, config.asset);
  const partial = `${archive}.part`;
  try {
    report('Primeiro início: baixando as sprites. Depois desta preparação, o jogo funciona offline.');
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', forwardAbort, { once: true });
    let idleTimer;
    const resetTimer = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => controller.abort(new Error('Download sem resposta por 60 segundos.')), 60_000); };
    try {
      signal?.throwIfAborted();
      resetTimer();
      const url = `https://github.com/${config.repository}/releases/download/${config.tag}/${config.asset}`;
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`Download indisponível (HTTP ${response.status}).`);
      const hash = createHash('sha256');
      let received = 0;
      let last = 0;
      const progress = new Transform({ transform(chunk, encoding, callback) {
        resetTimer();
        received += chunk.length;
        if (received > config.size) { callback(new Error('Pacote de sprites maior que o esperado.')); return; }
        hash.update(chunk);
        if (Date.now() - last >= 2000) { report(`Baixando sprites: ${Math.floor(received * 100 / config.size)}% (${Math.floor(received / 1024 / 1024)} MB)…`); last = Date.now(); }
        callback(null, chunk);
      } });
      await pipeline(Readable.fromWeb(response.body), progress, createWriteStream(partial), { signal: controller.signal });
      if (received !== config.size || hash.digest('hex') !== config.sha256) throw new Error('O pacote de sprites não passou na verificação de integridade.');
      await rename(partial, archive);
    } finally { clearTimeout(idleTimer); signal?.removeEventListener('abort', forwardAbort); }
    await extractSpriteArchive(archive, directory, config.files, { signal, report });
    await writeFile(marker, JSON.stringify({ sha256: config.sha256 }));
    report('Sprites instaladas. As próximas partidas podem ser jogadas sem internet.');
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(`Não foi possível preparar as sprites: ${error.message} Conecte-se à internet e abra o jogo novamente; seus saves permanecem preservados.`);
  } finally { await rm(partial, { force: true }); await rm(archive, { force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await ensureSprites({ root: fileURLToPath(new URL('..', import.meta.url)) });
}
