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
import { REGIONS, GYMS, ELITE, CHAMPION, JOHTO_GYMS, wildLevelSettings } from '../src/services/battleRules.js';

const temporary = mkdtempSync(path.join(tmpdir(), 'pokemon-wild-levels-'));
const database = path.join(temporary, 'test.db');
const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const app = createApp({ db, config: { CORS_ORIGIN: 'http://127.0.0.1:35185' } });
let save;
const fullKanto = [...GYMS, ...ELITE, CHAMPION].map(entry => entry.id);

before(async () => {
  writeFileSync(database, '');
  for (const script of ['migrate-local.js', 'seed-moves.js']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${script}`, import.meta.url))], {
      env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  save = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Intervalos QA' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', save.id).send({ saveId: save.id, especieId: 1 }).expect(201);
});
after(async () => { await db.$disconnect(); rmSync(temporary, { recursive: true, force: true }); });

async function progress(completed) {
  await db.desafioConcluido.deleteMany({ where: { saveId: save.id } });
  if (completed.length) await db.desafioConcluido.createMany({ data: completed.map(desafioId => ({ saveId: save.id, desafioId })) });
}
async function start(body, status = 201) {
  return (await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'selvagem', ...body }).expect(status)).body.data;
}
async function act(battle, acao) {
  return (await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: battle.id, versao: battle.versao, acao }).expect(200)).body.data;
}

test('todas segue a última etapa liberada, inclusive as duas campanhas de Unova', () => {
  assert.equal(wildLevelSettings([], 'todas').regiao, 'kanto');
  assert.equal(wildLevelSettings([], 'johto'), null);
  assert.equal(wildLevelSettings(fullKanto, 'kanto').maximo, 100);
  assert.deepEqual(wildLevelSettings(fullKanto, 'todas'), { regiao: 'johto', nome: 'Johto', geracao: 2, minimo: 1, maximo: 10 });
  const completed = [];
  for (const region of REGIONS) {
    assert.equal(wildLevelSettings(completed, 'todas').regiao, region.id);
    completed.push(...region.gyms.map(entry => entry.id), ...region.elite.map(entry => entry.id), region.champion.id);
  }
  assert.equal(wildLevelSettings(completed, 'todas').maximo, 100);
});

test('metadados usam progresso de Johto em todas e mantêm o limite de Kanto separado', async () => {
  await progress([...fullKanto, ...JOHTO_GYMS.slice(0, 3).map(entry => entry.id)]);
  const response = await request(app).get('/api/batalhas/desafios').set('X-Save-Id', save.id).expect(200);
  assert.equal(response.body.data.niveisTodasGeracoes.regiao, 'johto');
  assert.equal(response.body.data.niveisTodasGeracoes.maximo, 28);
  assert.equal(response.body.data.regioes.find(entry => entry.id === 'kanto').niveisSelvagens.maximo, 100);
  assert.equal(response.body.data.regioes.find(entry => entry.id === 'hoenn').niveisSelvagens, null);
  await start({ regiao: 'todas', intervaloNivel: { minimo: 20, maximo: 29 } }, 403);
});

test('intervalo escolhido é respeitado, persistido e mantido ao procurar outro Pokémon', async () => {
  await progress(fullKanto);
  let battle = await start({ regiao: 'todas', intervaloNivel: { minimo: 8, maximo: 10 } });
  for (let attempt = 0; attempt < 12; attempt++) {
    assert.ok(battle.oponente.nivel >= 8 && battle.oponente.nivel <= 10);
    assert.deepEqual(battle.intervaloNivel, { minimo: 8, maximo: 10 });
    assert.equal(battle.regiaoNiveis, 'johto');
    const persisted = (await request(app).get('/api/batalhas/atual').set('X-Save-Id', save.id).expect(200)).body.data;
    assert.deepEqual(persisted.intervaloNivel, battle.intervaloNivel);
    battle = await act(battle, 'procurar');
  }
  await act(battle, 'fugir');
  await start({ regiao: 'todas', intervaloNivel: { minimo: 70, maximo: 75 } }, 403);
  battle = await start({ regiao: 'kanto', intervaloNivel: { minimo: 70, maximo: 75 } });
  assert.ok(battle.oponente.nivel >= 70 && battle.oponente.nivel <= 75);
  await act(battle, 'fugir');
  battle = await start({ regiao: 'johto', intervaloNivel: { minimo: 1, maximo: 1 } });
  assert.equal(battle.oponente.nivel, 1);
  assert.equal((await act(battle, 'procurar')).oponente.nivel, 1);
  await act({ ...battle, versao: battle.versao + 1 }, 'fugir');
});

test('intervalos inválidos e níveis bloqueados não criam batalha', async () => {
  await progress([]);
  for (const intervaloNivel of [{ minimo: 0, maximo: 10 }, { minimo: 9, maximo: 8 }, { minimo: 1.5, maximo: 10 }, { minimo: '2', maximo: 10 }, { minimo: 2, maximo: 101 }]) {
    await start({ regiao: 'kanto', intervaloNivel }, 400);
  }
  await start({ regiao: 'kanto', intervaloNivel: { minimo: 2, maximo: 11 } }, 403);
  await start({ regiao: 'johto', intervaloNivel: { minimo: 2, maximo: 10 } }, 403);
  await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'treinador', dificuldade: 'facil', intervaloNivel: { minimo: 1, maximo: 10 } }).expect(400);
  assert.equal(await db.batalha.count({ where: { saveId: save.id } }), 0);
});

test('encontros antigos sem intervalo adotam os níveis da última geração na nova busca', async () => {
  await progress(fullKanto);
  const battle = await start({ regiao: 'todas' });
  const stored = await db.batalha.findUnique({ where: { id: battle.id } });
  delete stored.estado.intervaloNivel;
  delete stored.estado.regiaoNiveis;
  await db.batalha.update({ where: { id: battle.id }, data: { estado: stored.estado } });
  const rerolled = await act(battle, 'procurar');
  assert.deepEqual(rerolled.intervaloNivel, { minimo: 2, maximo: 10 });
  assert.equal(rerolled.regiaoNiveis, 'johto');
  await act(rerolled, 'fugir');
});

test('escolha de espécie e nível após o campeão continua disponível', async () => {
  await progress(fullKanto);
  const selvagem = { regiao: 'kanto', especieId: 1, nivel: 100 };
  await start({ regiao: 'kanto', selvagem, intervaloNivel: { minimo: 1, maximo: 10 } }, 400);
  const battle = await start({ regiao: 'kanto', selvagem });
  assert.equal(battle.oponente.especieId, 1);
  assert.equal(battle.oponente.nivel, 100);
  await act(battle, 'fugir');
});
