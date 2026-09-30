import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { IV_ITEMS, normalizeIvs, perfectIvs, rollIvs, ivQuality } from '../src/services/ivRules.js';
import { statsFor } from '../src/services/battleRules.js';
import { getEspecie } from '../src/services/catalogo.js';
import { pokemonSaleValue } from '../src/services/market.js';
import { rollTournament } from '../src/services/tournaments.js';
import { generateMissions } from '../src/services/journey.js';

const temporary = mkdtempSync(path.join(tmpdir(), 'pokemon-ivs-'));
const database = path.join(temporary, 'test.db');
const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const app = createApp({ db, config: { CORS_ORIGIN: 'http://127.0.0.1' } });
let save, starter, caught;
const totalIvs = total => {
  const ivs = {};
  for (const stat of Object.keys(perfectIvs())) { ivs[stat] = Math.min(31, total); total -= ivs[stat]; }
  return ivs;
};
function prepare(script) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${script}`, import.meta.url))], { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
before(async () => {
  writeFileSync(database, ''); prepare('migrate-local.js'); prepare('seed-moves.js');
  save = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'IV QA' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', save.id).send({ saveId: save.id, especieId: 1 }).expect(201);
  starter = (await db.pokemonCapturado.findMany({ where: { saveId: save.id } }))[0];
  await db.save.update({ where: { id: save.id }, data: { moedas: 100_000, fichas: 100_000 } });
});
after(async () => { await db.$disconnect(); rmSync(temporary, { recursive: true, force: true }); });
const headers = () => ({ 'X-Save-Id': save.id });
async function act(battle, acao, extra = {}) {
  return (await request(app).post('/api/batalhas/acao').set(headers()).send({ batalhaId: battle.id, versao: battle.versao, acao, ...extra }).expect(200)).body.data;
}

test('estrelas respeitam todas as fronteiras, inclusive 185 e 186', () => {
  for (const [total, stars] of [[0,0], [90,0], [91,1], [120,1], [121,2], [150,2], [151,3], [185,3], [186,4]]) {
    const quality = ivQuality(totalIvs(total));
    assert.equal(quality.total, total); assert.equal(quality.stars, stars); assert.equal(quality.percentage, total / 186 * 100);
  }
  assert.deepEqual(rollIvs(max => max - 1), perfectIvs());
  assert.equal(ivQuality(rollIvs(() => 0)).total, 0);
  assert.equal(normalizeIvs({ hp: 99 }).hp, 31);
});
test('inicial é perfeito e os IVs alteram atributos de combate', () => {
  assert.deepEqual(starter.ivs, perfectIvs());
  assert.deepEqual(starter.atributos, statsFor(getEspecie(1), 5, false, perfectIvs()));
  assert.equal(statsFor(getEspecie(1), 100, false, perfectIvs()).hp - statsFor(getEspecie(1), 100, false, totalIvs(0)).hp, 31);
});
test('encontro mantém IVs após recarregar e captura preserva os mesmos valores', async () => {
  let battle = (await request(app).post('/api/batalhas/iniciar').set(headers()).send({ tipo: 'selvagem', regiao: 'kanto', intervaloNivel: { minimo: 5, maximo: 5 } }).expect(201)).body.data;
  assert.equal(Object.keys(battle.oponente.ivs).length, 6);
  for (const value of Object.values(battle.oponente.ivs)) assert.ok(Number.isInteger(value) && value >= 0 && value <= 31);
  const foeIvs = battle.oponente.ivs;
  const reloaded = (await request(app).get('/api/batalhas/atual').set(headers()).expect(200)).body.data;
  assert.deepEqual(reloaded.oponente.ivs, foeIvs);
  battle = await act(battle, 'escolher', { pokemonIds: [starter.id] });
  assert.deepEqual(battle.jogador.ivs, perfectIvs());
  await db.itemInventario.create({ data: { saveId: save.id, itemId: 'master-ball', quantidade: 1 } });
  const result = await act(battle, 'capturar', { itemId: 'master-ball' });
  assert.equal(result.resultado, 'captura');
  caught = await db.pokemonCapturado.findFirst({ where: { saveId: save.id, bolaCaptura: 'master-ball' } });
  assert.deepEqual(caught.ivs, foeIvs);
  assert.deepEqual(caught.atributos, statsFor(getEspecie(caught.especieId), caught.nivel, caught.shiny, foeIvs));
});
test('seis essências são compráveis nas duas lojas e presentes nas recompensas', async () => {
  const catalog = (await request(app).get('/api/catalogo/itens').expect(200)).body.data;
  const casino = (await request(app).get('/api/cassino').set(headers()).expect(200)).body.data;
  for (const item of IV_ITEMS) {
    assert.ok(catalog.some(entry => entry.nome === item.nome)); assert.ok(casino.itens.some(entry => entry.itemId === item.nome));
    await request(app).post('/api/jogador/itens/comprar').set(headers()).send({ itemId: item.nome }).expect(200);
    await request(app).post('/api/cassino/itens').set(headers()).send({ itens: [{ itemId: item.nome, quantidade: 1 }] }).expect(200);
  }
  const rewards = generateMissions(save, [], 100).flatMap(entry => entry.recompensa.itens);
  for (const item of IV_ITEMS) assert.ok(rewards.some(entry => entry.itemId === item.nome));
  for (const tier of ['muito-facil', 'facil', 'intermediario', 'dificil', 'muito-dificil', 'copa-prime']) assert.ok(rollTournament(tier).recompensa.itens.some(entry => entry.itemId.startsWith('iv-') && entry.quantidade > 0));
});
test('essências aumentam só o IV correspondente e não gastam em 31, em batalha ou Pokémon de outro save', async () => {
  await db.pokemonCapturado.update({ where: { id: caught.id }, data: { nivel: 100, ivs: normalizeIvs(), atributos: statsFor(getEspecie(caught.especieId), 100, caught.shiny), hpAtual: 0 } });
  for (const item of IV_ITEMS) {
    const updated = (await request(app).post(`/api/jogador/pokemon/${caught.id}/iv`).set(headers()).send({ itemId: item.nome }).expect(200)).body.data;
    assert.equal(updated.ivs[item.stat], 16); assert.equal(updated.hpAtual, 0);
    assert.deepEqual(updated.atributos, statsFor(getEspecie(caught.especieId), 100, caught.shiny, updated.ivs));
  }
  const count = await db.itemInventario.findUnique({ where: { saveId_itemId: { saveId: save.id, itemId: 'iv-hp' } } });
  await request(app).post(`/api/jogador/pokemon/${starter.id}/iv`).set(headers()).send({ itemId: 'iv-hp' }).expect(409);
  await request(app).post(`/api/jogador/pokemon/${caught.id}/iv`).set(headers()).send({ itemId: 'iv-hp', quantidade: 100 }).expect(400);
  const other = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Outro' }).expect(201)).body.data;
  await request(app).post(`/api/jogador/pokemon/${caught.id}/iv`).set('X-Save-Id', other.id).send({ itemId: 'iv-hp' }).expect(404);
  let battle = (await request(app).post('/api/batalhas/iniciar').set(headers()).send({ tipo: 'selvagem', regiao: 'kanto' }).expect(201)).body.data;
  await request(app).post(`/api/jogador/pokemon/${caught.id}/iv`).set(headers()).send({ itemId: 'iv-hp' }).expect(409);
  await act(battle, 'fugir');
  assert.equal((await db.itemInventario.findUnique({ where: { saveId_itemId: { saveId: save.id, itemId: 'iv-hp' } } })).quantidade, count.quantidade);
});
test('bônus de venda é de 50% para 3 estrelas e 100% para 4', async () => {
  const member = { especieId: 25, nivel: 20, bolaCaptura: 'great-ball', investimentoItens: 0 };
  assert.equal(pokemonSaleValue({ ...member, ivs: totalIvs(150) }), 500);
  assert.equal(pokemonSaleValue({ ...member, ivs: totalIvs(151) }), 750);
  assert.equal(pokemonSaleValue({ ...member, ivs: totalIvs(185) }), 750);
  assert.equal(pokemonSaleValue({ ...member, ivs: perfectIvs() }), 1000);
  await db.pokemonCapturado.update({ where: { id: caught.id }, data: { ivs: totalIvs(151) } });
  const expected = pokemonSaleValue(await db.pokemonCapturado.findUnique({ where: { id: caught.id } }));
  const result = (await request(app).post('/api/jogador/pokemon/vender').set(headers()).send({ pokemonIds: [caught.id] }).expect(200)).body.data;
  assert.equal(result.moedasGanhas, expected);
});

test('recompensa de missão entrega essência uma única vez', async () => {
  const list = (await request(app).get('/api/jogador/missoes').set(headers()).expect(200)).body.data;
  const mission = list.missoes[0];
  const essence = mission.recompensa.itens.find(item => item.itemId.startsWith('iv-'));
  const before = (await db.itemInventario.findUnique({ where: { saveId_itemId: { saveId: save.id, itemId: essence.itemId } } }))?.quantidade ?? 0;
  await db.batalhaEvento.createMany({ data: Array.from({ length: mission.alvo }, (_, index) => ({ saveId: save.id, tipo: 'capturar', especieId: index + 1, regiao: mission.regiao, descricao: 'Missão IV QA' })) });
  await request(app).post('/api/jogador/missoes/0/resgatar').set(headers()).send({ periodo: list.periodo }).expect(200);
  await request(app).post('/api/jogador/missoes/0/resgatar').set(headers()).send({ periodo: list.periodo }).expect(409);
  assert.equal((await db.itemInventario.findUnique({ where: { saveId_itemId: { saveId: save.id, itemId: essence.itemId } } })).quantidade, before + 1);
});

test('evolução e doces conservam IVs e os recalculam nos atributos', async () => {
  await db.pokemonCapturado.update({ where: { id: starter.id }, data: { nivel: 16, experiencia: getEspecie(1).experienciaPorNivel.find(entry => entry.nivel === 16).experiencia } });
  const evolved = (await request(app).post(`/api/jogador/pokemon/${starter.id}/evoluir`).set(headers()).send({ alvo: 2 }).expect(200)).body.data;
  assert.deepEqual(evolved.ivs, perfectIvs()); assert.deepEqual(evolved.atributos, statsFor(getEspecie(2), 16, false, perfectIvs()));
  await db.itemInventario.create({ data: { saveId: save.id, itemId: 'rare-candy', quantidade: 1 } });
  const raised = (await request(app).post(`/api/jogador/pokemon/${starter.id}/doce-raro`).set(headers()).expect(200)).body.data;
  assert.equal(raised.nivel, 17); assert.deepEqual(raised.ivs, perfectIvs());
  assert.deepEqual(raised.atributos, statsFor(getEspecie(2), 17, false, perfectIvs()));
});

test('migra banco anterior, preserva saves e dá IVs perfeitos ao inicial já evoluído', async () => {
  const legacyFile = path.join(temporary, 'legacy.db'); writeFileSync(legacyFile, '');
  const legacyUrl = `file:${legacyFile.replaceAll('\\', '/')}`;
  const legacy = new PrismaClient({ datasourceUrl: legacyUrl });
  const sql = readFileSync(new URL('../prisma/migrations/20260930000000_sqlite_initial/migration.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').filter(entry => entry.trim())) await legacy.$executeRawUnsafe(statement);
  await legacy.$executeRawUnsafe(`INSERT INTO Usuario (id, login, senhaHash, atualizadoEm) VALUES ('old-owner', 'local-old', 'local-save', CURRENT_TIMESTAMP)`);
  await legacy.$executeRawUnsafe(`INSERT INTO Save (id, usuarioId, nomeTreinador, moedas, fichas, inicialEspecieId, iniciadoEm, atualizadoEm) VALUES ('old-save', 'old-owner', 'Jogador antigo', 12345, 321, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
  const stats = statsFor(getEspecie(2), 30);
  await legacy.$executeRawUnsafe(`INSERT INTO PokemonCapturado (id, saveId, especieId, nivel, hpAtual, atributos, capturadoEm) VALUES ('old-starter', 'old-save', 2, 30, 0, ?, '2026-09-29 10:00:00')`, JSON.stringify(stats));
  await legacy.$executeRawUnsafe(`INSERT INTO PokemonCapturado (id, saveId, especieId, nivel, hpAtual, atributos, bolaCaptura, capturadoEm) VALUES ('old-caught', 'old-save', 2, 30, ?, ?, 'poke-ball', '2026-09-29 11:00:00')`, stats.hp - 5, JSON.stringify(stats));
  await legacy.$disconnect();
  for (let attempt = 0; attempt < 2; attempt++) {
    const migrated = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/migrate-local.js', import.meta.url))], { env: { ...process.env, DATABASE_URL: legacyUrl }, encoding: 'utf8', windowsHide: true });
    assert.equal(migrated.status, 0, migrated.stderr || migrated.stdout);
    const oldSave = await legacy.save.findUnique({ where: { id: 'old-save' } });
    assert.equal(oldSave.moedas, 12345); assert.equal(oldSave.fichas, 321);
    const oldStarter = await legacy.pokemonCapturado.findUnique({ where: { id: 'old-starter' } });
    assert.deepEqual(oldStarter.ivs, perfectIvs()); assert.equal(oldStarter.hpAtual, 0);
    assert.deepEqual(oldStarter.atributos, statsFor(getEspecie(2), 30, false, perfectIvs()));
    const oldCaught = await legacy.pokemonCapturado.findUnique({ where: { id: 'old-caught' } });
    assert.deepEqual(oldCaught.ivs, normalizeIvs()); assert.deepEqual(oldCaught.atributos, stats); assert.equal(oldCaught.hpAtual, stats.hp - 5);
    await legacy.$disconnect();
  }
});
