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
import { REGIONS } from '../src/services/battleRules.js';
import { MISSION_COMPLETION_REWARD } from '../src/services/journey.js';

const temporary = mkdtempSync(path.join(tmpdir(), 'pokemon-mission-bonus-'));
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
  save = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Missões QA' }).expect(201)).body.data;
});
after(async () => { await db.$disconnect(); rmSync(temporary, { recursive: true, force: true }); });

test('concluir as dez missões credita o bônus uma única vez antes do reset', async () => {
  const headers = { 'X-Save-Id': save.id };
  const missionSet = (await request(app).get('/api/jogador/missoes').set(headers).expect(200)).body.data;
  const events = [];
  for (const mission of missionSet.missoes) {
    if (mission.tipo === 'capturar') {
      const region = REGIONS.find(entry => entry.id === mission.regiao);
      for (let index = 0; index < mission.alvo; index++) events.push({ saveId: save.id, tipo: mission.tipo, regiao: mission.regiao, especieId: region.minSpecies + index, descricao: 'Captura de missão' });
    } else {
      for (let index = 0; index < mission.alvo; index++) events.push({
        saveId: save.id, tipo: mission.tipo, regiao: mission.regiao ?? null,
        dificuldade: mission.dificuldade ?? null, torneioId: mission.torneioId ?? null, descricao: 'Objetivo de missão concluído',
      });
    }
  }
  await db.batalhaEvento.createMany({ data: events });
  const complete = (await request(app).get('/api/jogador/missoes').set(headers).expect(200)).body.data;
  assert.equal(complete.todasConcluidas, true);
  assert.equal(complete.bonusResgatado, false);
  assert.deepEqual(complete.recompensaCompleta, MISSION_COMPLETION_REWARD);

  const mission = complete.missoes[0];
  const claimed = (await request(app).post(`/api/jogador/missoes/${mission.indice}/resgatar`).set(headers).send({ periodo: complete.periodo }).expect(200)).body.data;
  assert.deepEqual(claimed.bonusCompleto, MISSION_COMPLETION_REWARD);
  assert.equal(claimed.todasConcluidas, true);

  const balances = await db.save.findUniqueOrThrow({ where: { id: save.id } });
  assert.equal(balances.moedas, mission.recompensa.moedas + MISSION_COMPLETION_REWARD.moedas);
  assert.equal(balances.fichas, mission.recompensa.fichas + MISSION_COMPLETION_REWARD.fichas);
  assert.equal((await db.itemInventario.findUniqueOrThrow({ where: { saveId_itemId: { saveId: save.id, itemId: 'rare-candy' } } })).quantidade, 1);

  const another = complete.missoes[1];
  const secondClaim = (await request(app).post(`/api/jogador/missoes/${another.indice}/resgatar`).set(headers).send({ periodo: complete.periodo }).expect(200)).body.data;
  assert.equal(secondClaim.bonusCompleto, null);
  assert.equal(await db.missaoResgatada.count({ where: { saveId: save.id, periodo: complete.periodo, indice: -1 } }), 1);
  const updated = (await request(app).get('/api/jogador/missoes').set(headers).expect(200)).body.data;
  assert.equal(updated.bonusResgatado, true);
});
