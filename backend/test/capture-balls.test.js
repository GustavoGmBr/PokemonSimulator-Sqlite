import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { captureBallMultiplier, CAPTURE_BALL_ITEMS, evolvesWithMoonStone, happinessGain, rollPokemonSex } from '../src/services/captureBalls.js';

const temporary = mkdtempSync(path.join(tmpdir(), 'pokemon-capture-balls-'));
const database = path.join(temporary, 'test.db');
const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const app = createApp({ db, config: { CORS_ORIGIN: 'http://127.0.0.1:35186' } });
let save;

before(async () => {
  writeFileSync(database, '');
  const migration = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/migrate-local.js', import.meta.url))], {
    env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  save = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Bolas QA' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', save.id).send({ saveId: save.id, especieId: 4 }).expect(201);
  await db.save.update({ where: { id: save.id }, data: { moedas: 20_000 } });
});
after(async () => {
  await db.$disconnect();
  rmSync(temporary, { recursive: true, force: true });
});

test('bolas situacionais respeitam os requisitos e os limites de multiplicador', () => {
  const opponent = { nivel: 10, tipos: ['water'], status: null, species: { types: ['water'], weight: 310, height: 1.5 } };
  const player = { nivel: 40, sexo: 'male', tipos: ['fire'] };
  assert.equal(captureBallMultiplier('fast-ball', { round: 1, opponent, player }), 5);
  assert.equal(captureBallMultiplier('fast-ball', { round: 2, opponent, player }), 1);
  assert.equal(captureBallMultiplier('timer-ball', { opponent: { tipos: ['psychic'] }, player }), 3);
  assert.equal(captureBallMultiplier('timer-ball', { opponent, player }), 1);
  assert.equal(captureBallMultiplier('dusk-ball', { opponent: { tipos: ['ghost'] }, player }), 4);
  assert.equal(captureBallMultiplier('dusk-ball', { opponent: { tipos: ['dark', 'flying'] }, player }), 4);
  assert.equal(captureBallMultiplier('dusk-ball', { hour: 23, opponent, player }), 1);
  assert.equal(captureBallMultiplier('dive-ball', { opponent, player }), 3.5);
  assert.equal(captureBallMultiplier('net-ball', { opponent, player }), 3);
  assert.equal(captureBallMultiplier('nest-ball', { opponent: { tipos: ['flying'] }, player }), 3);
  assert.equal(captureBallMultiplier('repeat-ball', { opponent: { tipos: ['electric'] }, player }), 3);
  assert.equal(captureBallMultiplier('heavy-ball', { opponent, player }), 4);
  assert.equal(captureBallMultiplier('heavy-ball', { opponent: { species: { weight: 0, height: 4 } }, player }), 3);
  assert.equal(captureBallMultiplier('moon-ball', { opponent: { tipos: ['dragon'] }, player }), 3);
  assert.equal(captureBallMultiplier('level-ball', { opponent: { tipos: ['ice'] }, player }), 3);
  assert.equal(captureBallMultiplier('love-ball', { opponent: { tipos: ['fairy', 'fire'] }, player }), 3.5);
  assert.equal(captureBallMultiplier('love-ball', { opponent: { tipos: ['fire'] }, player }), 3);
  assert.equal(captureBallMultiplier('love-ball', { opponent: { tipos: ['water'] }, player }), 1);
  assert.equal(captureBallMultiplier('dream-ball', { opponent: { ...opponent, status: 'sleep' }, player }), 4);
  assert.equal(captureBallMultiplier('dream-ball', { opponent, player }), 1);
  assert.equal(captureBallMultiplier('luxury-ball', { opponent: { tipos: ['fighting'] }, player }), 3);
  assert.equal(captureBallMultiplier('friend-ball', { opponent: { tipos: ['grass'] }, player }), 3);
  assert.equal(captureBallMultiplier('sport-ball', { opponent: { tipos: ['fire'] }, player }), 3);
});

test('a busca da cadeia evolutiva identifica corretamente espécies que usam Pedra da Lua', () => {
  const family = { especieId: 29, evolucoes: [{ especieId: 30, condicoes: [{ item: null }], evolucoes: [{ especieId: 31, condicoes: [{ item: 'moon-stone' }], evolucoes: [] }] }] };
  assert.equal(evolvesWithMoonStone(family, 29), false);
  assert.equal(evolvesWithMoonStone(family, 30), true);
  assert.equal(evolvesWithMoonStone(family, 31), false);
  const clefairy = { especieId: 35, evolucoes: [{ especieId: 36, condicoes: [{ item: 'moon-stone' }], evolucoes: [] }] };
  assert.equal(evolvesWithMoonStone(clefairy, 35), true);
});

test('sexo é determinado pelo catálogo e a amizade não recebe bônus das bolas adaptadas', () => {
  assert.equal(rollPokemonSex({ proporcaoFemeas: 8 }, () => 0), 'female');
  assert.equal(rollPokemonSex({ proporcaoFemeas: 0 }, () => 0), 'male');
  assert.equal(rollPokemonSex({ proporcaoFemeas: -1 }, () => 0), null);
  assert.equal(happinessGain('luxury-ball', 100), 105);
  assert.equal(happinessGain('friend-ball', 100), 105);
  assert.equal(happinessGain('poke-ball', 100), 105);
  assert.equal(happinessGain('luxury-ball', 250), 255);
});

test('catálogo inclui as bolas especiais e compras de dez Poké Bolas dão Bola Premier', async () => {
  const headers = { 'X-Save-Id': save.id };
  const items = (await request(app).get('/api/catalogo/itens').set(headers).expect(200)).body.data;
  for (const ball of CAPTURE_BALL_ITEMS) assert.ok(items.some((item) => item.nome === ball.id), `${ball.id} no catálogo`);

  const purchase = (await request(app).post('/api/jogador/itens/carrinho').set(headers).send({ itens: [{ itemId: 'poke-ball', quantidade: 10 }] }).expect(200)).body.data;
  assert.deepEqual(purchase.bonusItens, [{ itemId: 'premier-ball', quantidade: 1 }]);
  assert.equal((await db.itemInventario.findUniqueOrThrow({ where: { saveId_itemId: { saveId: save.id, itemId: 'premier-ball' } } })).quantidade, 1);
  await request(app).post('/api/jogador/itens/carrinho').set(headers).send({ itens: [{ itemId: 'premier-ball', quantidade: 1 }] }).expect(400);
});
