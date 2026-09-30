import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/src/app.js';
import { perfectIvs, IV_ITEMS } from '../../backend/src/services/ivRules.js';
import { getEspecie } from '../../backend/src/services/catalogo.js';
import { statsFor } from '../../backend/src/services/battleRules.js';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const { PrismaClient } = requireBackend('@prisma/client');
let temporary, db, server, origin, save;
test.beforeAll(async () => {
  temporary = mkdtempSync(path.join(tmpdir(), 'pokemon-iv-ui-'));
  const database = path.join(temporary, 'test.db'); writeFileSync(database, '');
  const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
  for (const script of ['migrate-local.js', 'seed-moves.js']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../../backend/scripts/${script}`, import.meta.url))], { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', windowsHide: true });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  }
  db = new PrismaClient({ datasourceUrl: databaseUrl });
  process.env.POKEMON_SIMULATOR_PORTABLE = '1';
  server = createApp({ db, config: { CORS_ORIGIN: 'http://127.0.0.1' } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  async function post(route, body, headers = {}) {
    const response = await fetch(`${origin}/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    expect(response.ok).toBe(true); return (await response.json()).data;
  }
  save = await post('/jogador/saves', { nomeTreinador: 'IVs UI' });
  await post('/jogador/inicial', { saveId: save.id, especieId: 1 }, { 'X-Save-Id': save.id });
  for (const [index, total] of [90, 120, 150, 151].entries()) {
    let remainder = total;
    const ivs = Object.fromEntries(Object.keys(perfectIvs()).map(stat => { const value = Math.min(31, remainder); remainder -= value; return [stat, value]; }));
    const species = getEspecie(index + 2), stats = statsFor(species, 20, false, ivs);
    await db.pokemonCapturado.create({ data: { saveId: save.id, especieId: species.id, apelido: `Exemplar ${total}`, nivel: 20, ivs, atributos: stats, hpAtual: stats.hp, bolaCaptura: 'poke-ball', experiencia: species.experienciaPorNivel.find(entry => entry.nivel === 20).experiencia } });
  }
  await db.itemInventario.create({ data: { saveId: save.id, itemId: 'iv-speed', quantidade: 1 } });
});
test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.$disconnect();
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

test('mostra IVs, filtra estrelas e porcentagens e melhora de duas para três estrelas', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(saveId => localStorage.setItem('pokemon-simulator-local-save', JSON.stringify({ state: { saveId, usuario: { login: 'IVs UI' } }, version: 0 })), save.id);
  await page.goto(`${origin}/menu`);
  await expect(page.locator('.party-entry')).toHaveCount(5);
  const perfect = page.locator('.party-entry').filter({ has: page.getByRole('button', { name: 'Ver informações de Bulbasaur', exact: true }) });
  await expect(perfect.locator('.iv-total')).toContainText('186 | 186');
  await expect(perfect.locator('.iv-total')).toContainText('100,0%');
  await expect(perfect.locator('.iv-perfect')).toHaveCount(1);
  await expect(perfect.locator('.iv-grid')).toContainText('HP: 31 | 31');
  await page.getByLabel('Filtrar meus Pokémon por estrelas IV').selectOption('4');
  await expect(page.locator('.party-entry')).toHaveCount(1);
  await page.getByLabel('Filtrar meus Pokémon por estrelas IV').selectOption('1');
  await expect(page.locator('.party-entry')).toHaveCount(1);
  await expect(page.locator('.party-entry')).toContainText('Exemplar 120');
  await page.getByLabel('Filtrar meus Pokémon por estrelas IV').selectOption('');
  await page.getByLabel('Porcentagem mínima de IVs').fill('80');
  await page.getByLabel('Porcentagem máxima de IVs').fill('99');
  await expect(page.locator('.party-entry')).toHaveCount(2);
  await page.getByLabel('Porcentagem mínima de IVs').fill('');
  await page.getByLabel('Porcentagem máxima de IVs').fill('');
  await page.getByRole('button', { name: 'Ver informações de Exemplar 150', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.iv-total')).toContainText('150 | 186');
  await expect(dialog.locator('.iv-grid')).toContainText('Velocidade: 0 | 31');
  await dialog.getByRole('button', { name: /Essência de Velocidade ×1/ }).click();
  await expect(dialog.locator('.iv-total')).toContainText('151 | 186');
  await expect(dialog.locator('.iv-value-bonus')).toContainText('+50%');
  await expect(dialog.getByRole('button', { name: /Essência de Velocidade ×0/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Fechar detalhes' }).click();
  await page.getByLabel('Filtrar meus Pokémon por estrelas IV').selectOption('3');
  await expect(page.locator('.party-entry')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('ivs-collection.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto(`${origin}/loja`);
  await page.getByRole('button', { name: /^IVs 6/ }).click();
  for (const item of IV_ITEMS) await expect(page.getByRole('heading', { name: item.nomeExibicao, exact: true })).toBeVisible();
  await page.goto(`${origin}/selvagens`);
  await page.getByRole('button', { name: 'Procurar Pokémon', exact: true }).click();
  await expect(page.locator('.battle-foe .iv-stars')).toBeVisible();
  expect(errors).toEqual([]);
});
