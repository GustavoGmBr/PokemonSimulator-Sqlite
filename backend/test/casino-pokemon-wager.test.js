import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { createCasinoService, CASINO_CHIP_COST } from '../src/services/casino.js';
import { pokemonSaleValue } from '../src/services/market.js';

const temp = mkdtempSync(path.join(tmpdir(), 'pokemon-casino-wager-'));
const database = path.join(temp, 'test.db');
const url = `file:${database.replaceAll('\\', '/')}`;
const db = new PrismaClient({ datasourceUrl: url });
const app = createApp({ db, config: { CORS_ORIGIN: 'http://127.0.0.1' } });
let save, starter;
const user = () => save.usuarioId;
const service = rng => createCasinoService(db, { rng });

before(async () => {
  writeFileSync(database, '');
  for (const name of ['migrate-local.js', 'seed-moves.js']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${name}`, import.meta.url))], { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  save = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Aposta Pokémon' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', save.id).send({ saveId: save.id, especieId: 1 }).expect(201);
  starter = await db.pokemonCapturado.findFirstOrThrow({ where: { saveId: save.id } });
});

beforeEach(async () => {
  await db.cassinoRodada.deleteMany({ where: { saveId: save.id } });
  await db.pokemonCapturado.deleteMany({ where: { saveId: save.id, especieId: 25 } });
  await db.save.update({ where: { id: save.id }, data: { fichas: 100_000, moedas: 100_000 } });
});

after(async () => {
  await db.$disconnect();
  rmSync(temp, { recursive: true, force: true });
});

async function addWagerPokemon() {
  return db.pokemonCapturado.create({ data: {
    saveId: save.id, especieId: 25, nivel: 20, experiencia: 0, hpAtual: 40,
    bolaCaptura: 'poke-ball', ivs: starter.ivs, atributos: starter.atributos,
    golpes: [], golpesDesbloqueados: [],
  } });
}

async function assertPokemonPrize(result, value, multiplier) {
  const gain = Math.floor(value * multiplier);
  assert.equal(result.pokemonPremio.ganho, gain);
  assert.equal(result.pokemonPremio.fichas, Math.floor(gain / CASINO_CHIP_COST));
  const balance = await db.save.findUniqueOrThrow({ where: { id: save.id } });
  assert.equal(balance.moedas, result.moedas);
  assert.equal(balance.fichas, result.fichas);
}

test('caça-níqueis converte o multiplicador das linhas para ₽ e fichas', async () => {
  const pokemon = await addWagerPokemon(), value = pokemonSaleValue(pokemon);
  const result = await service(() => 0).slots(user(), 10, pokemon.id);
  assert.equal(result.simbolos.every(symbol => symbol === 'mew'), true);
  await assertPokemonPrize(result, value, 400);
  assert.equal(await db.pokemonCapturado.findUnique({ where: { id: pokemon.id } }), null);
});

test('caça-níqueis aceita apostar somente o Pokémon, sem gastar fichas', async () => {
  const pokemon = await addWagerPokemon(), value = pokemonSaleValue(pokemon), initialChips = 100_000;
  const result = await service(() => 0).slots(user(), 0, pokemon.id);
  await assertPokemonPrize(result, value, 400);
  assert.equal(result.aposta, 0);
  assert.equal(result.fichas, initialChips + result.pokemonPremio.fichas);
});

test('roleta converte o palpite vencedor de Pokémon para ₽ e fichas', async () => {
  const pokemon = await addWagerPokemon(), value = pokemonSaleValue(pokemon);
  const result = await service(max => max === 37 ? 32 : 0).roulette(user(), [], { pokemonId: pokemon.id, tipo: 'numero', numero: 32 });
  await assertPokemonPrize(result, value, 36);
});

test('Voltorb encerra e perde o Pokémon apostado ao revelar uma bomba', async () => {
  const pokemon = await addWagerPokemon();
  const casino = service(max => max - 1);
  const { rodada } = await casino.startVoltorb(user(), 0, pokemon.id);
  assert.equal(await db.pokemonCapturado.findUnique({ where: { id: pokemon.id } }), null);
  const result = await casino.flipVoltorb(user(), { rodadaId: rodada.id, versao: rodada.versao, indice: 0 });
  assert.equal(result.resultado, 'voltorb');
  await assertPokemonPrize(result, pokemonSaleValue(pokemon), 0);
});

test('Pokejack paga o valor e as fichas equivalentes quando a mão empata', async () => {
  const pokemon = await addWagerPokemon(), value = pokemonSaleValue(pokemon), casino = service(max => max - 1);
  const { rodada } = await casino.startPokejack(user(), 0, pokemon.id);
  const result = await casino.actPokejack(user(), { rodadaId: rodada.id, versao: rodada.versao, acao: 'parar' });
  assert.equal(result.resultado, 'empate');
  await assertPokemonPrize(result, value, 1);
});

test('Pokémon Race credita ambos os prêmios ao acertar o vencedor', async () => {
  const pokemon = await addWagerPokemon(), value = pokemonSaleValue(pokemon);
  const result = await service(max => max - 1).race(user(), 0, 4, pokemon.id);
  assert.equal(result.vencedor, 4);
  await assertPokemonPrize(result, value, 4);
});

test('Wheel of Fortune usa o multiplicador sorteado no prêmio Pokémon', async () => {
  const pokemon = await addWagerPokemon(), value = pokemonSaleValue(pokemon);
  const result = await service(max => max - 1).fortune(user(), 0, pokemon.id);
  assert.equal(result.multiplicador, 10);
  await assertPokemonPrize(result, value, 10);
});

test('Pula Piplup mantém e liquida a aposta Pokémon ao sacar', async () => {
  const pokemon = await addWagerPokemon(), value = pokemonSaleValue(pokemon), casino = service(() => 0);
  const { rodada } = await casino.startPiplup(user(), 0, pokemon.id);
  const stepped = await casino.actPiplup(user(), { rodadaId: rodada.id, versao: rodada.versao, acao: 'pular' });
  const result = await casino.actPiplup(user(), { rodadaId: rodada.id, versao: stepped.rodada.versao, acao: 'sacar' });
  assert.equal(result.resultado, 'saque');
  await assertPokemonPrize(result, value, 1);
});
