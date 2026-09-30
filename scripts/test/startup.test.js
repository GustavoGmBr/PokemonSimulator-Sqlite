import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { availablePort } from '../game-ports.js';
import { writeSpriteArchive, extractSpriteArchive } from '../sprite-archive.js';
import { ensureSprites } from '../download-sprites.js';

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pokemon-sprites-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  const files = {};
  for (const name of ['1-front.png', '1-artwork.png']) {
    const content = Buffer.from(`sprite fixture ${name}`);
    fs.writeFileSync(path.join(source, name), content);
    files[name] = { size: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  }
  const archive = path.join(root, 'sprites.tar.gz');
  await writeSpriteArchive(source, archive, files);
  const bytes = fs.readFileSync(archive);
  const manifest = { repository: 'GustavoGmBr/PokemonSimulator-Sqlite', tag: 'v0.2.1', asset: 'PokemonSimulator-sprites-v0.2.1.tar.gz', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), files };
  fs.mkdirSync(path.join(root, 'backend/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'backend/data/sprite-download.json'), JSON.stringify(manifest));
  return { root, files, archive, bytes };
}

test('uma porta ocupada é ignorada sem enviar requisições ao outro sistema', async t => {
  let requests = 0;
  const server = createServer((req, res) => { requests++; res.end('outro sistema'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const occupied = server.address().port;
  const chosen = await availablePort(occupied);
  assert.ok(chosen > occupied);
  assert.equal(requests, 0);
});

test('primeiro início instala sprites; os próximos iniciam offline; arquivo faltante é recuperado', async t => {
  const { root, files, bytes } = await fixture(t);
  fs.writeFileSync(path.join(root, 'backend/pokemon.db'), 'save preservado');
  fs.writeFileSync(path.join(root, 'backend/.env'), 'config preservada');
  let downloads = 0;
  const fetchImpl = async () => { downloads++; return new Response(bytes); };
  const options = { root, fetchImpl, report: () => {} };
  await ensureSprites(options);
  assert.equal(downloads, 1);
  for (const name of Object.keys(files)) assert.ok(fs.existsSync(path.join(root, 'backend/public/pokemon', name)));
  await ensureSprites({ ...options, fetchImpl: () => { throw new Error('sem internet'); } });
  fs.unlinkSync(path.join(root, 'backend/public/pokemon/1-artwork.png'));
  await ensureSprites(options);
  assert.equal(downloads, 2);
  assert.equal(fs.readFileSync(path.join(root, 'backend/pokemon.db'), 'utf8'), 'save preservado');
  assert.equal(fs.readFileSync(path.join(root, 'backend/.env'), 'utf8'), 'config preservada');
});

test('download corrompido não instala sprites nem marca a preparação como completa', async t => {
  const { root, bytes } = await fixture(t);
  const corrupt = Buffer.from(bytes);
  corrupt[20] ^= 1;
  await assert.rejects(ensureSprites({ root, report: () => {}, fetchImpl: async () => new Response(corrupt) }), /integridade/);
  assert.equal(fs.existsSync(path.join(root, 'backend/public/pokemon/.installed.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'backend/public/pokemon/1-front.png')), false);
});

test('pacote não pode escrever fora da pasta das sprites', async t => {
  const { root, files } = await fixture(t);
  const malicious = path.join(root, 'malicious.tar.gz');
  const header = Buffer.alloc(512);
  header.write('../escape.png');
  fs.writeFileSync(malicious, gzipSync(Buffer.concat([header, Buffer.alloc(1024)])));
  await assert.rejects(extractSpriteArchive(malicious, path.join(root, 'images'), files), /Entrada inválida/);
  assert.equal(fs.existsSync(path.join(root, 'escape.png')), false);
});

test('cancelar o primeiro início interrompe a preparação das sprites', async t => {
  const { root } = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(ensureSprites({ root, signal: controller.signal, report: () => {}, fetchImpl: () => { throw new Error('não deve baixar'); } }), /abort/i);
  assert.equal(fs.existsSync(path.join(root, 'backend/public/pokemon/.installed.json')), false);
});
