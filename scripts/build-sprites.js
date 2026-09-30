import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeSpriteArchive } from './sprite-archive.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const directory = path.join(root, 'backend/public/pokemon');
const manifestPath = path.join(root, 'backend/data/sprite-download.json');
const files = {};
for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isFile() || entry.name.startsWith('.')) continue;
  const contents = fs.readFileSync(path.join(directory, entry.name));
  files[entry.name] = { size: contents.length, sha256: createHash('sha256').update(contents).digest('hex') };
}
if (!files['1-front.png'] || !files['1-artwork.png']) throw new Error('Sprites locais incompletas.');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : null;
const unchanged = previous && JSON.stringify(previous.files) === JSON.stringify(files);
const tag = unchanged ? previous.tag : `v${version}`;
const asset = unchanged ? previous.asset : `PokemonSimulator-sprites-${tag}.tar.gz`;
const output = path.join(root, 'dist/releases', tag);
fs.mkdirSync(output, { recursive: true });
const archive = path.join(output, asset);
if (unchanged && (tag !== `v${version}` || fs.existsSync(archive))) {
  console.log(`Sprites inalteradas: usando o pacote ${tag}.`);
} else {
  console.log(`Compactando ${Object.keys(files).length} sprites em pacote separado…`);
  await writeSpriteArchive(directory, `${archive}.tmp`, files);
  fs.renameSync(`${archive}.tmp`, archive);
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  fs.writeFileSync(`${archive}.sha256`, `${sha256}  ${asset}\n`);
  const { repository } = JSON.parse(fs.readFileSync(path.join(root, 'release-config.json')));
  fs.writeFileSync(manifestPath, `${JSON.stringify({ repository, tag, asset, size: fs.statSync(archive).size, sha256, files })}\n`);
  console.log(`Pacote de sprites pronto: ${(fs.statSync(archive).size / 1024 / 1024).toFixed(1)} MB.`);
}
