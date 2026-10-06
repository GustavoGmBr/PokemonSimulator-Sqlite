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
import { CAPTURE_BALL_ITEMS } from '../src/services/captureBalls.js';
import { parseEnv } from '../src/config/env.js';

const config = { CORS_ORIGIN: 'http://localhost:5185' };
const temporary = mkdtempSync(path.join(tmpdir(), 'pokemon-api-test-'));
const database = path.join(temporary, 'test.db');
const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
let app;
let first;
let second;

before(async () => {
  writeFileSync(database, '');
  const migration = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/migrate-local.js', import.meta.url))], {
    env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  app = createApp({ db, config });
});
after(async () => {
  await db.$disconnect();
  rmSync(temporary, { recursive: true, force: true });
});

test('cria e lista saves sem conta, senha ou token', async () => {
  assert.deepEqual((await request(app).get('/api/jogador/saves').expect(200)).body.data, []);
  first = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Ash' }).expect(201)).body.data;
  second = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Misty' }).expect(201)).body.data;
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.usuarioId, second.usuarioId);
  assert.equal(first.moedas, 0);
  const list = await request(app).get('/api/jogador/saves').expect(200);
  assert.equal(list.body.data.length, 2);
  assert.equal(JSON.stringify(list.body).includes('senhaHash'), false);
  await request(app).post('/api/auth/login').send({}).expect(404);
  await request(app).post('/api/auth/register').send({}).expect(404);
});

test('saves rejeitam campos privilegiados e nomes invalidos', async () => {
  for (const body of [{ nomeTreinador: '' }, { nomeTreinador: 'Ash', moedas: 999 }, { nomeTreinador: 'Ash', senha: 'senha' }]) {
    await request(app).post('/api/jogador/saves').send(body).expect(400);
  }
});

test('jogar exige um save existente selecionado no cabecalho', async () => {
  for (const route of ['/jogador/save', '/jogador/time', '/jogador/pc', '/jogador/inventario', '/batalhas/atual', '/cassino']) {
    await request(app).get(`/api${route}`).expect(409);
    await request(app).get(`/api${route}`).set('X-Save-Id', 'inexistente').expect(404);
  }
});

test('inicial, colecao, inventario e alteracoes permanecem isolados entre saves', async () => {
  for (const especieId of [152, 252, 722, 906]) await request(app).post('/api/jogador/inicial').set('X-Save-Id', first.id).send({ saveId: first.id, especieId }).expect(400);
  assert.equal((await db.save.findUnique({ where:{id:first.id} })).inicialEspecieId, null);
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', first.id).send({ saveId: second.id, especieId: 1 }).expect(409);
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', first.id).send({ saveId: first.id, especieId: 1 }).expect(201);
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', first.id).send({ saveId: first.id, especieId: 4 }).expect(409);
  const collection = await request(app).get(`/api/jogador/pokemon?usuarioId=${second.usuarioId}`).set('X-Save-Id', first.id).expect(200);
  assert.equal(collection.body.data.length, 1);
  assert.equal(collection.body.data[0].saveId, first.id);
  assert.equal(collection.body.data[0].especieId, 1);
  assert.deepEqual((await request(app).get('/api/jogador/pokemon').set('X-Save-Id', second.id).expect(200)).body.data, []);
  const inventory = await request(app).get('/api/jogador/inventario').set('X-Save-Id', first.id).expect(200);
  assert.equal(inventory.body.data.find(item => item.itemId === 'poke-ball').quantidade, 10);
  await request(app).patch('/api/jogador/save').set('X-Save-Id', first.id).send({ nomeTreinador: 'Red' }).expect(200);
  await request(app).patch('/api/jogador/save').set('X-Save-Id', first.id).send({ nomeTreinador: 'Red', moedas: 999 }).expect(400);
  assert.equal((await request(app).get('/api/jogador/save').set('X-Save-Id', second.id).expect(200)).body.data.nomeTreinador, 'Misty');
});

test('excluir um save remove seus dados e preserva os outros', async () => {
  await request(app).delete(`/api/jogador/saves/${first.id}`).expect(200);
  assert.equal(await db.pokemonCapturado.count({ where: { saveId: first.id } }), 0);
  assert.equal(await db.itemInventario.count({ where: { saveId: first.id } }), 0);
  assert.equal(await db.usuario.count({ where: { id: first.usuarioId } }), 0);
  const list = await request(app).get('/api/jogador/saves').expect(200);
  assert.deepEqual(list.body.data.map(save => save.id), [second.id]);
  await request(app).delete(`/api/jogador/saves/${first.id}`).expect(404);
});

test('catalogo publico retorna itens, especies e sprites locais', async () => {
  assert.equal((await request(app).get('/api/catalogo/itens').expect(200)).body.data.length, 157 + CAPTURE_BALL_ITEMS.length);
  const species = await request(app).get('/api/catalogo/25').expect(200);
  assert.equal(species.body.data.nomeExibicao, 'Pikachu');
  assert.ok(species.body.data.sprites.animatedShiny);
  assert.ok(species.body.data.golpesAprendidos[0].pp > 0);
  await request(app).get('/assets/pokemon/1-front.png').expect('Content-Type', /image/).expect(200);
  await request(app).get('/assets/items/fast-ball.png').expect('Content-Type', /image/).expect(200);
  await request(app).get('/api/catalogo/not-an-id').expect(404);

  await request(app).post('/api/jogador/inicial').set('X-Save-Id', second.id).send({ saveId: second.id, especieId: 4 }).expect(201);
  await db.save.update({ where: { id: second.id }, data: { moedas: 100_000 } });
  const stock = (await request(app).get('/api/mercado/pokemon').set('X-Save-Id', second.id).expect(200)).body.data;
  const fixed = stock.pokemons[0];
  await request(app).patch(`/api/mercado/pokemon/${fixed.id}/favorito`).set('X-Save-Id', second.id).send({ favorito: true }).expect(200);
  const refreshed = (await request(app).post('/api/mercado/pokemon/atualizar').set('X-Save-Id', second.id).send({}).expect(200)).body.data;
  assert.ok(refreshed.pokemons.some(entry => entry.id === fixed.id && entry.favorito));
});

test('health distingue o processo do banco indisponivel', async () => {
  await request(app).get('/api/health').expect(200);
  await request(app).get('/api/health/ready').expect(200);
  const offline = createApp({ db: { async $queryRaw() { throw new Error('offline'); } }, config });
  await request(offline).get('/api/health').expect(200);
  await request(offline).get('/api/health/ready').expect(503);
});

test('JSON invalido, corpo grande e rota ausente retornam erros padronizados', async () => {
  await request(app).post('/api/jogador/saves').set('Content-Type', 'application/json').send('{bad').expect(400);
  await request(app).post('/api/jogador/saves').send({ value: 'x'.repeat(40_000) }).expect(413);
  await request(app).get('/api/does-not-exist').expect(404);
});

test('configuracao invalida nao expoe valores secretos', () => {
  assert.throws(() => parseEnv({ DATABASE_URL: 'private-password' }), error => {
    assert.match(error.message, /DATABASE_URL/);
    assert.equal(error.message.includes('private-password'), false);
    return true;
  });
});

test('CORS permite selecionar save e respostas locais nao sao cacheadas', async () => {
  const response = await request(app).get('/api/jogador/save').set('Origin', config.CORS_ORIGIN).set('X-Save-Id', second.id).expect(200);
  assert.equal(response.headers['access-control-allow-origin'], config.CORS_ORIGIN);
  assert.equal(response.headers['cache-control'], 'no-store');
  const preflight = await request(app).options('/api/jogador/save').set('Origin', config.CORS_ORIGIN).set('Access-Control-Request-Headers', 'X-Save-Id').expect(204);
  assert.match(preflight.headers['access-control-allow-headers'], /X-Save-Id/);
  const other = await request(app).get('/api/health').set('Origin', 'http://other.example');
  assert.notEqual(other.headers['access-control-allow-origin'], 'http://other.example');
});
