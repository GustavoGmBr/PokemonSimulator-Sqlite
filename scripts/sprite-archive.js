import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash, randomUUID } from 'node:crypto';

export function spriteName(name) {
  return /^[0-9][A-Za-z0-9._-]{0,98}\.(png|gif|webp)$/.test(name);
}

export async function writeSpriteArchive(directory, archive, files) {
  async function* entries() {
    for (const [name, details] of Object.entries(files)) {
      if (!spriteName(name)) throw new Error(`Nome de sprite inválido: ${name}`);
      const header = Buffer.alloc(512);
      header.write(name, 0, 100, 'ascii');
      header.write('0000644\0', 100, 8, 'ascii');
      header.write('0000000\0', 108, 8, 'ascii');
      header.write('0000000\0', 116, 8, 'ascii');
      header.write(`${details.size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
      header.write('00000000000\0', 136, 12, 'ascii');
      header.fill(32, 148, 156);
      header.write('0', 156, 1, 'ascii');
      header.write('ustar\0', 257, 6, 'ascii');
      header.write('00', 263, 2, 'ascii');
      const checksum = header.reduce((total, byte) => total + byte, 0);
      header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
      yield header;
      for await (const chunk of createReadStream(path.join(directory, name))) yield chunk;
      if (details.size % 512) yield Buffer.alloc(512 - details.size % 512);
    }
    yield Buffer.alloc(1024);
  }
  await pipeline(Readable.from(entries()), createGzip(), createWriteStream(archive));
}

export async function extractSpriteArchive(archive, directory, files, { signal, report = () => {} } = {}) {
  await mkdir(directory, { recursive: true });
  const source = createReadStream(archive);
  const gzip = createGunzip();
  source.on('error', error => gzip.destroy(error));
  source.pipe(gzip);
  const iterator = gzip[Symbol.asyncIterator]();
  let pending = Buffer.alloc(0);
  async function read(size, optional = false) {
    const chunks = [];
    let received = 0;
    while (received < size) {
      signal?.throwIfAborted();
      if (!pending.length) {
        const item = await iterator.next();
        if (item.done) {
          if (optional && received === 0) return null;
          throw new Error('Pacote de sprites incompleto.');
        }
        pending = item.value;
      }
      const length = Math.min(size - received, pending.length);
      chunks.push(pending.subarray(0, length));
      pending = pending.subarray(length);
      received += length;
    }
    return Buffer.concat(chunks, size);
  }
  const extracted = new Set();
  const expected = Object.keys(files).length;
  let lastReport = 0;
  try {
    while (true) {
      const header = await read(512);
      if (header.every(byte => byte === 0)) {
        let tail;
        while ((tail = await read(512, true))) if (!tail.every(byte => byte === 0)) throw new Error('Dados extras no pacote de sprites.');
        break;
      }
      const name = header.subarray(0, 100).toString('ascii').split('\0')[0];
      const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
      const size = /^[0-7]+$/.test(sizeText) ? parseInt(sizeText, 8) : NaN;
      const savedChecksum = parseInt(header.subarray(148, 156).toString('ascii').trim(), 8);
      const checksum = header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte), 0);
      if (!spriteName(name) || !Object.hasOwn(files, name) || extracted.has(name) || header[156] !== 48 || !Number.isSafeInteger(size) || size > 64 * 1024 * 1024 || size !== files[name].size || checksum !== savedChecksum) {
        throw new Error(`Entrada inválida no pacote de sprites: ${name}`);
      }
      const contents = await read(size);
      if (createHash('sha256').update(contents).digest('hex') !== files[name].sha256) throw new Error(`Sprite corrompida: ${name}`);
      if (size % 512) await read(512 - size % 512);
      const target = path.join(directory, name);
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await pipeline(Readable.from([contents]), createWriteStream(temporary), { signal });
        await rename(temporary, target);
      } finally { await rm(temporary, { force: true }); }
      extracted.add(name);
      if (Date.now() - lastReport > 2000) {
        report(`Instalando sprites: ${extracted.size} de ${expected}…`);
        lastReport = Date.now();
      }
    }
    if (extracted.size !== expected) throw new Error('Faltam imagens no pacote de sprites.');
  } finally { source.destroy(); gzip.destroy(); }
}
