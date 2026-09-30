import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
const schema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
let baseline;
try {
  const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type = 'table'`;
  baseline = tables.some(table => table.name === 'Usuario') && !tables.some(table => table.name === '_prisma_migrations');
} finally { await prisma.$disconnect(); }
async function command(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args, '--schema', schema], { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Migração SQLite falhou (${code}).`)));
  });
}
if (baseline) await command(['migrate', 'resolve', '--applied', '20260930000000_sqlite_initial']);
await command(['migrate', 'deploy']);
