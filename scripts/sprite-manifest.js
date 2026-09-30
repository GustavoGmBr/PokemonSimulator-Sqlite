import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const directory = path.join(root, 'backend/public/pokemon');
const baselinePath = path.join(root, 'backend/data/sprite-baseline.json');
const current = {};
for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  current[entry.name] = createHash('sha256').update(fs.readFileSync(path.join(directory, entry.name))).digest('hex');
}
if (!fs.existsSync(baselinePath)) fs.writeFileSync(baselinePath, `${JSON.stringify(current)}\n`);
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
process.stdout.write(JSON.stringify(Object.keys(current).filter(name => baseline[name] !== current[name]).map(name => `backend/public/pokemon/${name}`)));
