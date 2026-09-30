import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const workspace = fileURLToPath(new URL('..', import.meta.url));
export const gameVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
export const workspaceId = createHash('sha256')
  .update(process.platform === 'win32' ? workspace.toLowerCase() : workspace)
  .digest('hex');
