import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getEspecie } from '../src/services/catalogo.js';
import { statsFor, formFor } from '../src/services/battleRules.js';

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
// Recalcula os iniciais antigos promovidos a IVs perfeitos pela migração.
try {
  const members = await prisma.pokemonCapturado.findMany();
  for (const member of members) {
    const stats = statsFor(formFor(getEspecie(member.especieId), member.megaForma, member.gmaxForma), member.nivel, member.shiny, member.ivs);
    if (JSON.stringify(stats) === JSON.stringify(member.atributos)) continue;
    const oldMaxHp = member.atributos?.hp ?? stats.hp;
    const hpAtual = member.hpAtual === 0 ? 0 : Math.max(1, Math.min(stats.hp, member.hpAtual + stats.hp - oldMaxHp));
    await prisma.pokemonCapturado.update({ where: { id: member.id }, data: { atributos: stats, hpAtual } });
  }
} finally { await prisma.$disconnect(); }
