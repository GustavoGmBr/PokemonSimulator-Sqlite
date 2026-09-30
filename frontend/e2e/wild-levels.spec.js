import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/src/app.js';
import { GYMS, ELITE, CHAMPION } from '../../backend/src/services/battleRules.js';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const { PrismaClient } = requireBackend('@prisma/client');
let temporary, db, server, origin, save;

test.beforeAll(async () => {
  temporary = mkdtempSync(path.join(tmpdir(), 'pokemon-wild-ui-'));
  const database = path.join(temporary, 'test.db');
  writeFileSync(database, '');
  const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
  for (const script of ['migrate-local.js', 'seed-moves.js']) {
    const prepared = spawnSync(process.execPath, [fileURLToPath(new URL(`../../backend/scripts/${script}`, import.meta.url))], {
      env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', windowsHide: true,
    });
    expect(prepared.status, prepared.stderr || prepared.stdout).toBe(0);
  }
  db = new PrismaClient({ datasourceUrl: databaseUrl });
  process.env.POKEMON_SIMULATOR_PORTABLE = '1';
  const app = createApp({ db, config: { CORS_ORIGIN: 'http://127.0.0.1' } });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  async function post(route, data, headers = {}) {
    const response = await fetch(`${origin}/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
    expect(response.ok).toBe(true);
    return (await response.json()).data;
  }
  save = await post('/jogador/saves', { nomeTreinador: 'Intervalos UI' });
  await post('/jogador/inicial', { saveId: save.id, especieId: 1 }, { 'X-Save-Id': save.id });
  await db.desafioConcluido.createMany({ data: [...GYMS, ...ELITE, CHAMPION].map(entry => ({ saveId: save.id, desafioId: entry.id })) });
});
test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.$disconnect();
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

test('intervalo de todas segue Johto e permanece nas buscas e após recarregar', async ({ page }, testInfo) => {
  await page.addInitScript(saveId => localStorage.setItem('pokemon-simulator-local-save', JSON.stringify({ state: { saveId, usuario: { login: 'Intervalos UI' } }, version: 0 })), save.id);
  await page.goto(`${origin}/selvagens`);
  await expect(page.getByLabel('Nível máximo', { exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: 'Todas as gerações liberadas', exact: true }).click();
  await expect(page.getByText('Níveis baseados em Johto', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Nível máximo', { exact: true })).toHaveValue('10');
  await page.getByLabel('Nível mínimo', { exact: true }).fill('8');
  await page.getByLabel('Nível máximo', { exact: true }).fill('11');
  await expect(page.getByRole('button', { name: 'Procurar Pokémon', exact: true })).toBeDisabled();
  await page.getByLabel('Nível máximo', { exact: true }).fill('9');
  await expect(page.getByRole('button', { name: 'Procurar Pokémon', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('wild-level-range.png'), fullPage: true });
  await page.getByRole('button', { name: 'Procurar Pokémon', exact: true }).click();
  await expect(page.getByText(/Intervalo escolhido: Nv\. 8–9/)).toBeVisible();
  await page.getByRole('button', { name: 'Procurar outro Pokémon', exact: true }).click();
  await expect(page.getByText(/Intervalo escolhido: Nv\. 8–9/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Intervalo escolhido: Nv\. 8–9/)).toBeVisible();
  await page.getByRole('button', { name: 'Fugir', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Você fugiu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Procurar novo Pokémon', exact: true }).click();
  await expect(page.getByText(/Intervalo escolhido: Nv\. 8–9/)).toBeVisible();
  const active = await fetch(`${origin}/api/batalhas/atual`, { headers: { 'X-Save-Id': save.id } }).then(response => response.json());
  expect(active.data.intervaloNivel).toEqual({ minimo: 8, maximo: 9 });
  expect(active.data.oponente.nivel).toBeGreaterThanOrEqual(8);
  expect(active.data.oponente.nivel).toBeLessThanOrEqual(9);
});
