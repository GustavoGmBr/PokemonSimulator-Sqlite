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
let imported;
let replaceTarget;

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

test('equipes nomeadas persistem, apelidos atualizam e Pedra Brilhante converte um Pokémon', async () => {
  const localSave = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Equipe 1.3' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', localSave.id).send({ saveId: localSave.id, especieId: 1 }).expect(201);
  const starter = await db.pokemonCapturado.findFirst({ where: { saveId: localSave.id } });
  await db.pokemonCapturado.createMany({ data: [4, 7, 25, 133, 26].map((especieId, index) => ({ saveId: localSave.id, especieId: especieId + index, hpAtual: 20, nivel: 5, experiencia: 0 })) });
  const members = await db.pokemonCapturado.findMany({ where: { saveId: localSave.id }, select: { id: true } });
  const team = { nome: 'Aventureiros', pokemonIds: members.slice(0, 6).map(member => member.id) };
  await request(app).put('/api/jogador/equipes').set('X-Save-Id', localSave.id).send({ equipes: [team] }).expect(200);
  assert.deepEqual((await request(app).get('/api/jogador/equipes').set('X-Save-Id', localSave.id).expect(200)).body.data, [team]);
  await request(app).put('/api/jogador/equipes').set('X-Save-Id', localSave.id).send({ equipes: [{ ...team, pokemonIds: [starter.id] }] }).expect(400);
  await request(app).patch(`/api/jogador/pokemon/${starter.id}/apelido`).set('X-Save-Id', localSave.id).send({ apelido: 'Bulba' }).expect(200);
  assert.equal((await db.pokemonCapturado.findUnique({ where: { id: starter.id } })).apelido, 'Bulba');
  await db.itemInventario.create({ data: { saveId: localSave.id, itemId: 'shiny-stone', quantidade: 1 } });
  const before = starter.atributos;
  await request(app).post(`/api/jogador/pokemon/${starter.id}/pedra-brilhante`).set('X-Save-Id', localSave.id).send({}).expect(200);
  const transformed = await db.pokemonCapturado.findUnique({ where: { id: starter.id } });
  assert.equal(transformed.shiny, true);
  assert.ok(transformed.atributos.attack > before.attack);
  await request(app).post(`/api/jogador/pokemon/${starter.id}/pedra-brilhante`).set('X-Save-Id', localSave.id).send({}).expect(409);
  const casinoItems = (await request(app).get('/api/cassino').set('X-Save-Id', localSave.id).expect(200)).body.data.itens;
  assert.equal(casinoItems.find(item => item.itemId === 'shiny-stone').preco, 350_000);
  assert.ok(casinoItems.some(item => item.itemId === 'rare-candy'));
  assert.ok(casinoItems.some(item => item.itemId === 'exp-candy-gg'));
  const encounter = (await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', localSave.id).send({ tipo: 'selvagem', regiao: 'kanto', intervaloNivel: { minimo: 1, maximo: 1 } }).expect(201)).body.data;
  assert.ok(encounter.chancesCaptura['poke-ball'] > 0);
  await request(app).post('/api/batalhas/acao').set('X-Save-Id', localSave.id).send({ batalhaId: encounter.id, versao: encounter.versao, acao: 'fugir' }).expect(200);
  await db.pokemonCapturado.update({ where: { id: starter.id }, data: { nivel: 100 } });
  await db.save.update({ where: { id: localSave.id }, data: { moedas: 1000 } });
  const tournament = (await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', localSave.id).send({ tipo: 'torneio', torneioId: 'muito-facil' }).expect(201)).body.data;
  assert.equal(tournament.limiteNivel, 10);
  const chosen = (await request(app).post('/api/batalhas/acao').set('X-Save-Id', localSave.id).send({ batalhaId: tournament.id, versao: tournament.versao, acao: 'escolher', pokemonId: starter.id }).expect(200)).body.data;
  assert.equal(chosen.jogador.nivel, 10);
  assert.equal((await db.pokemonCapturado.findUnique({ where: { id: starter.id } })).nivel, 100);
  const archive = (await request(app).get(`/api/jogador/saves/${localSave.id}/exportar`).expect(200)).body.data;
  const importedSave = (await request(app).post('/api/jogador/saves/importar').send({ arquivo: archive }).expect(201)).body.data;
  const importedTeam = (await request(app).get('/api/jogador/equipes').set('X-Save-Id', importedSave.id).expect(200)).body.data[0];
  assert.equal(importedTeam.nome, team.nome);
  assert.equal(importedTeam.pokemonIds.length, 6);
  assert.notEqual(importedTeam.pokemonIds[0], team.pokemonIds[0]);
  await request(app).delete(`/api/jogador/saves/${importedSave.id}`).expect(200);
  await request(app).delete(`/api/jogador/saves/${localSave.id}`).expect(200);
});

test('exporta, importa como novo save e substitui outro save sem perder seu identificador', async () => {
  const starter = await db.pokemonCapturado.findFirst({ where: { saveId: first.id } });
  await db.batalha.create({ data: { saveId: first.id, estado: { jogador: { pokemonId: starter.id } } } });
  const archive = (await request(app).get(`/api/jogador/saves/${first.id}/exportar`).expect(200)).body.data;
  assert.equal(archive.format, 'pokemon-simulator-save');
  assert.equal(archive.data.save.usuarioId, undefined);
  assert.equal(archive.data.pokemon.length, 1);
  archive.exportedAt = 'x'.repeat(40_000);

  imported = (await request(app).post('/api/jogador/saves/importar').send({ arquivo: archive }).expect(201)).body.data;
  assert.notEqual(imported.id, first.id);
  assert.equal(imported.nomeTreinador, 'Red');
  const importedPokemon = await db.pokemonCapturado.findMany({ where: { saveId: imported.id } });
  assert.equal(importedPokemon.length, 1);
  assert.notEqual(importedPokemon[0].id, archive.data.pokemon[0].id);
  assert.equal(importedPokemon[0].saveId, imported.id);
  const importedBattle = await db.batalha.findUnique({ where: { saveId: imported.id } });
  assert.equal(importedBattle.estado.jogador.pokemonId, importedPokemon[0].id);

  replaceTarget = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Substituir' }).expect(201)).body.data;
  await db.save.update({ where: { id: replaceTarget.id }, data: { moedas: 987_654 } });
  const replaced = (await request(app).post('/api/jogador/saves/importar').send({ arquivo: archive, substituirSaveId: replaceTarget.id }).expect(201)).body.data;
  assert.equal(replaced.id, replaceTarget.id);
  assert.equal(replaced.nomeTreinador, 'Red');
  assert.equal(replaced.moedas, archive.data.save.moedas);
  assert.equal(await db.pokemonCapturado.count({ where: { saveId: replaceTarget.id } }), 1);
  assert.equal(await db.save.findUnique({ where: { id: imported.id } }).then(save => save.moedas), imported.moedas);

  const invalid = structuredClone(archive);
  invalid.formatVersion = 99;
  await request(app).post('/api/jogador/saves/importar').send({ arquivo: invalid, substituirSaveId: replaceTarget.id }).expect(400);
  assert.equal((await db.save.findUnique({ where: { id: replaceTarget.id } })).nomeTreinador, 'Red');
});

test('busca automática exige os oito ginásios de Kanto e cobra 25 moedas por tentativa', async () => {
  const save = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Busca' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', save.id).send({ saveId: save.id, especieId: 7 }).expect(201);
  const lockedChallenges = (await request(app).get('/api/batalhas/desafios').set('X-Save-Id', save.id).expect(200)).body.data;
  assert.equal(lockedChallenges.autoBuscaDisponivel, false);
  await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'selvagem', regiao: 'kanto', autoBusca: true }).expect(403);
  assert.equal(await db.batalha.count({ where: { saveId: save.id } }), 0);

  await db.desafioConcluido.createMany({ data: ['brock', 'misty', 'lt-surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni'].map(desafioId => ({ saveId: save.id, desafioId })) });
  const unlockedChallenges = (await request(app).get('/api/batalhas/desafios').set('X-Save-Id', save.id).expect(200)).body.data;
  assert.equal(unlockedChallenges.autoBuscaDisponivel, true);
  await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'treinador', dificuldade: 'facil', autoBusca: true }).expect(400);
  await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'selvagem', regiao: 'kanto', autoBusca: true }).expect(409);
  assert.equal(await db.batalha.count({ where: { saveId: save.id } }), 0);

  await db.save.update({ where: { id: save.id }, data: { moedas: 500 } });
  const started = (await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'selvagem', regiao: 'kanto', intervaloNivel: { minimo: 2, maximo: 58 }, autoBusca: true }).expect(201)).body.data;
  assert.equal(started.buscaAutomatica, true);
  assert.equal(started.buscaTentativas, 1);
  assert.equal(started.moedasBusca, 475);

  const next = (await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: started.id, versao: 0, acao: 'procurar-auto' }).expect(200)).body.data;
  assert.equal(next.buscaTentativas, 2);
  assert.equal(next.moedasBusca, 450);
  assert.equal((await db.save.findUnique({ where: { id: save.id } })).moedas, 450);
  await db.save.update({ where: { id: save.id }, data: { moedas: 24 } });
  await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: started.id, versao: 1, acao: 'procurar-auto' }).expect(409);
  assert.equal((await db.save.findUnique({ where: { id: save.id } })).moedas, 24);

  await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: started.id, versao: 1, acao: 'fugir' }).expect(200);
  await db.save.update({ where: { id: save.id }, data: { moedas: 300 } });
  const manual = (await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'selvagem' }).expect(201)).body.data;
  await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: manual.id, versao: 0, acao: 'procurar-auto' }).expect(409);
  assert.equal((await db.save.findUnique({ where: { id: save.id } })).moedas, 300);
  await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: manual.id, versao: 0, acao: 'fugir' }).expect(200);

  await db.desafioConcluido.create({ data: { saveId: save.id, desafioId: 'blue' } });
  await db.save.update({ where: { id: save.id }, data: { moedas: 300 } });
  const specific = (await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'selvagem', regiao: 'kanto', selvagem: { regiao: 'kanto', especieId: 95, nivel: 27 }, autoBusca: true }).expect(201)).body.data;
  assert.equal(specific.oponente.especieId, 95);
  assert.equal(specific.oponente.nivel, 27);
  const specificNext = (await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: specific.id, versao: 0, acao: 'procurar-auto' }).expect(200)).body.data;
  assert.equal(specificNext.oponente.especieId, 95);
  assert.equal(specificNext.oponente.nivel, 27);
  await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: specific.id, versao: 1, acao: 'fugir' }).expect(200);
  const speciesList = (await request(app).post('/api/batalhas/iniciar').set('X-Save-Id', save.id).send({ tipo: 'selvagem', regiao: 'kanto', intervaloNivel: { minimo: 2, maximo: 4 }, autoBusca: true, autoBuscaEspeciesIds: [95, 92] }).expect(201)).body.data;
  assert.ok([95, 92].includes(speciesList.oponente.especieId));
  const speciesListNext = (await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: speciesList.id, versao: 0, acao: 'procurar-auto' }).expect(200)).body.data;
  assert.ok([95, 92].includes(speciesListNext.oponente.especieId));
  assert.ok(speciesListNext.oponente.nivel >= 2 && speciesListNext.oponente.nivel <= 4);
  await request(app).post('/api/batalhas/acao').set('X-Save-Id', save.id).send({ batalhaId: speciesList.id, versao: 1, acao: 'fugir' }).expect(200);
  await request(app).delete(`/api/jogador/saves/${save.id}`).expect(200);
});

test('excluir um save remove seus dados e preserva os outros', async () => {
  await request(app).delete(`/api/jogador/saves/${first.id}`).expect(200);
  assert.equal(await db.pokemonCapturado.count({ where: { saveId: first.id } }), 0);
  assert.equal(await db.itemInventario.count({ where: { saveId: first.id } }), 0);
  assert.equal(await db.usuario.count({ where: { id: first.usuarioId } }), 0);
  const list = await request(app).get('/api/jogador/saves').expect(200);
  assert.deepEqual(new Set(list.body.data.map(save => save.id)), new Set([second.id, imported.id, replaceTarget.id]));
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
  await request(app).get('/assets/items/sport-ball.png').expect('Content-Type', /image/).expect(200);
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
