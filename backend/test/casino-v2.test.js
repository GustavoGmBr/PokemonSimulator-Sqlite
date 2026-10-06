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
import { createCasinoService } from '../src/services/casino.js';
import { slotPayout, makeVoltorbBoard, voltorbPayout, handScore, blackjackOutcome, rouletteResult, rouletteMultiplier, ROULETTE_ORDER, FORTUNE_SEGMENTS, raceResult } from '../src/services/casinoRules.js';

const temp = mkdtempSync(path.join(tmpdir(), 'casino-v2-')), database = path.join(temp, 'test.db'), url = `file:${database.replaceAll('\\','/')}`;
const db = new PrismaClient({ datasourceUrl: url });
const app = createApp({ db, config: { CORS_ORIGIN: 'http://127.0.0.1' } });
let save;
const service = rng => createCasinoService(db, { rng });
const user = () => save.usuarioId;
const token = round => ({ rodadaId: round.id, versao: round.versao });
const balance = async () => (await db.save.findUniqueOrThrow({ where: { id: save.id } })).fichas;
const card = value => ({ valor: value, naipe: '♠' });
async function setState(changes) {
  const round = await db.cassinoRodada.findUniqueOrThrow({ where: { saveId: save.id } });
  await db.cassinoRodada.update({ where: { saveId: save.id }, data: { estado: { ...round.estado, ...changes } } });
}
before(async () => {
  writeFileSync(database, '');
  for (const name of ['migrate-local.js', 'seed-moves.js']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${name}`, import.meta.url))], { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  save = (await request(app).post('/api/jogador/saves').send({ nomeTreinador: 'Cassino QA' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id', save.id).send({ saveId: save.id, especieId: 1 }).expect(201);
});
beforeEach(async () => { await db.cassinoRodada.deleteMany({ where: { saveId: save.id } }); await db.save.update({ where: { id: save.id }, data: { fichas: 10000, moedas: 100000 } }); });
after(async () => { await db.$disconnect(); rmSync(temp, { recursive: true, force: true }); });

test('Ditto completa trincas e as oito linhas pagam separadamente', () => {
  const grid = ['master-ball','ditto','master-ball', 'pikachu','ultra-ball','mew', 'great-ball','mewtwo','poke-ball'];
  assert.equal(slotPayout(grid, 10).premio, 1000);
  assert.equal(slotPayout(grid, 10).linhas[0].coringas, 1);
  assert.equal(slotPayout(Array(9).fill('ditto'), 10).premio, 320);
  assert.equal(slotPayout(Array(9).fill('master-ball'), 10).premio, 8000);
});

test('Voltorb soma seis cartas e aplica 1,5× só nas linhas horizontais ou verticais', () => {
  const board = makeVoltorbBoard(() => 0);
  assert.equal(board.length, 36);
  for (const [value,count] of [[0,11],[0.25,5],[0.5,9],[1.2,5],[1.5,3],[2,2],[5,1]]) assert.equal(board.filter(cell => cell === value).length, count);
  const horizontal = [0.25,0.5,1.2,1.5,2,5, ...Array(30).fill(0.5)];
  assert.deepEqual(voltorbPayout(horizontal,[0,1,2,3,4,5],100), { soma:10.45, bonusLinha:1.5, multiplicador:15.675, premio:1567 });
  assert.equal(voltorbPayout(Array(36).fill(1.2),[0,6,12,18,24,30],10).premio,108);
  assert.equal(voltorbPayout(Array(36).fill(1.2),[0,7,14,21,28,35],10).premio,72);
  assert.equal(voltorbPayout(Array(36).fill(0.25),[0,7,14,21,28,35],5).premio,7);
  assert.equal(voltorbPayout(Array(25).fill(1),[0,5,10,15,20],10).premio,100);
});

test('Voltorb oculta cartas, persiste e paga apenas na sexta escolha', async () => {
  const casino = service(() => 0);
  let round = (await casino.startVoltorb(user(),100)).rodada;
  assert.equal(round.casas.length,36); assert.equal(round.restantes,6);
  assert.equal(round.casas.every(cell => cell === null),true); assert.equal(await balance(),9900);
  await setState({ tabuleiro:[0.25,0.5,1.2,1.5,2,5,...Array(30).fill(0.5)] });
  round = (await casino.flipVoltorb(user(), { ...token(round),indice:0 })).rodada;
  assert.equal(round.casas[0],0.25);
  await assert.rejects(casino.flipVoltorb(user(), { rodadaId:round.id,versao:0,indice:1 }), /rodada mudou/);
  await assert.rejects(casino.flipVoltorb(user(), { ...token(round),indice:0 }), /já foi aberta/);
  assert.equal((await casino.overview(user())).rodada.casas.filter(cell=>cell===null).length,35);
  for (const indice of [1,2,3,4]) { round=(await casino.flipVoltorb(user(),{...token(round),indice})).rodada; assert.equal(await balance(),9900); }
  const end=await casino.flipVoltorb(user(),{...token(round),indice:5});
  assert.equal(end.premio,1567); assert.equal(end.bonusLinha,1.5); assert.equal(await balance(),11467);
  await assert.rejects(casino.flipVoltorb(user(),{...token(round),indice:5}), /rodada mudou/);
});

test('Voltorb encerra imediatamente com 0× e permite abrir a última coluna', async () => {
  const casino=service(max=>max-1);
  let round=(await casino.startVoltorb(user(),100)).rodada;
  round=(await casino.flipVoltorb(user(),{...token(round),indice:35})).rodada;
  assert.equal(round.casas[35],5); assert.equal(round.restantes,5);
  const end=await casino.flipVoltorb(user(),{...token(round),indice:0});
  assert.equal(end.resultado,'voltorb'); assert.equal(end.premio,0); assert.equal(end.multiplicador,0); assert.equal(await balance(),9900);
  assert.equal((await casino.overview(user())).rodada,null);
});

test('rodada 5×5 em andamento mantém cinco escolhas e bônus de 2×', async () => {
  const casino=service(()=>0);
  let round=(await casino.startVoltorb(user(),100)).rodada;
  await setState({tabuleiro:Array(25).fill(1)});
  round=(await casino.overview(user())).rodada;
  assert.equal(round.tamanho,5);assert.equal(round.restantes,5);
  await assert.rejects(casino.flipVoltorb(user(),{...token(round),indice:25}), /dentro do tabuleiro/);
  for (const indice of [0,5,10,15]) round=(await casino.flipVoltorb(user(),{...token(round),indice})).rodada;
  const end=await casino.flipVoltorb(user(),{...token(round),indice:20});
  assert.equal(end.bonusLinha,2);assert.equal(end.premio,1000);assert.equal(await balance(),10900);
});
test('roleta europeia tem 37 números, 18 vermelhos, 18 pretos e zero verde', () => {
  assert.equal(new Set(ROULETTE_ORDER).size,37);
  const values = Array.from({ length:37 },(_,n) => rouletteResult(n));
  assert.equal(values.filter(r => r.cor === 'vermelho').length,18); assert.equal(values.filter(r => r.cor === 'preto').length,18);
  assert.equal(rouletteMultiplier(values[0], { tipo:'paridade', paridade:'par' }),0);
  assert.equal(rouletteMultiplier(values[0], { tipo:'faixa', faixa:'baixa' }),0);
  assert.equal(rouletteMultiplier(values[0], { tipo:'numero', numero:0 }),36);
  assert.equal(rouletteMultiplier(values[36], { tipo:'duzia', duzia:3 }),3);
  assert.equal(rouletteMultiplier(values[32], { tipo:'cor', cor:'vermelho' }),2);
});
test('ases flexíveis, natural, empate, estouro e vitória do Pokejack', () => {
  assert.equal(handScore([card(1),card(1),card(9)]),21);
  assert.equal(blackjackOutcome([card(1),card(13)],[card(10),card(8)],10).premio,30);
  assert.equal(blackjackOutcome([card(1),card(13)],[card(1),card(10)],10).premio,10);
  assert.equal(blackjackOutcome([card(10),card(5),card(6)],[card(10),card(8)],10).premio,20);
  assert.equal(blackjackOutcome([card(10),card(5),card(7)],[card(10),card(8)],10).premio,0);
});
test('Pokejack natural paga 3×; mão e baralho ocultos não vazam', async () => {
  const result = await service(() => 0).startPokejack(user(),100);
  assert.equal(result.resultado,'pokejack'); assert.equal(result.premio,300); assert.equal(await balance(),10200);
  assert.equal(result.mesa.baralho,undefined);
});
test('Pokejack dobra debitando mais uma aposta e resolve como vitória normal', async () => {
  const casino = service(max => max - 1), started = await casino.startPokejack(user(),10);
  assert.ok(started.rodada); assert.equal(started.rodada.banca[1],null); assert.equal(started.rodada.baralho,undefined);
  await setState({ jogador:[card(10),card(10)], banca:[card(10),card(8)], baralho:[card(1)] });
  const result = await casino.actPokejack(user(), { ...token(started.rodada), acao:'dobrar' });
  assert.equal(result.aposta,20); assert.equal(result.premio,40); assert.equal(result.resultado,'vitoria'); assert.equal(await balance(),10020);
});
test('Pokejack não dobra depois de pedir e não altera saldo com ação inválida', async () => {
  const casino = service(max => max - 1), { rodada } = await casino.startPokejack(user(),10);
  await setState({ jogador:[card(5),card(5)], banca:[card(10),card(8)], baralho:[card(5)] });
  const next = await casino.actPokejack(user(), { ...token(rodada), acao:'pedir' });
  await assert.rejects(casino.actPokejack(user(), { ...token(next.rodada), acao:'dobrar' }), /duas cartas/);
  assert.equal(await balance(),9990);
});
test('Piplup permite saque entre saltos e paga 5× ao completar os sete', async () => {
  const casino = service(() => 0);
  let round = (await casino.startPiplup(user(),100)).rodada;
  await assert.rejects(casino.actPiplup(user(), { ...token(round), acao:'sacar' }), /ao menos um salto/);
  for (let i=0;i<2;i++) round = (await casino.actPiplup(user(), { ...token(round), acao:'pular' })).rodada;
  const result = await casino.actPiplup(user(), { ...token(round), acao:'sacar' });
  assert.equal(result.premio,110); assert.equal(await balance(),10010);
  round = (await casino.startPiplup(user(),100)).rodada;
  let end;
  for(let i=0;i<7;i++) { end=await casino.actPiplup(user(), { ...token(round), acao:'pular' }); round=end.rodada; }
  assert.equal(end.premio,500); assert.equal(await balance(),10410);
});
test('queda do Piplup perde a entrada e impede sacar a mesma rodada', async () => {
  const casino = service(max => max - 1), { rodada } = await casino.startPiplup(user(),100);
  const end = await casino.actPiplup(user(), { ...token(rodada), acao:'pular' });
  assert.equal(end.resultado,'queda'); assert.equal(await balance(),9900);
  await assert.rejects(casino.actPiplup(user(), { ...token(rodada), acao:'sacar' }), /rodada mudou/);
});
test('corrida move cinco Pokémon e paga 6× apenas ao escolhido vencedor', async () => {
  const data = raceResult(() => 0); assert.equal(data.vencedor,0); assert.equal(data.quadros.at(-1)[0],100);
  assert.ok(data.quadros.at(-1).slice(1).every(position => position < 100));
  const casino = service(() => 0);
  assert.equal((await casino.race(user(),100,0)).premio,600);
  assert.equal((await casino.race(user(),100,1)).premio,0);
  assert.equal(await balance(),10400);
});
test('Fortune usa segmentos proporcionais e paga o multiplicador sorteado', async () => {
  assert.equal(FORTUNE_SEGMENTS.reduce((sum,s) => sum+s.peso,0),100);
  const result = await service(() => 99).fortune(user(),100);
  assert.equal(result.multiplicador,10); assert.equal(result.premio,1000); assert.equal(await balance(),10900);
  const fraction = await service(() => 20).fortune(user(),5);
  assert.equal(fraction.premio,1);
});
test('rodada ativa bloqueia outras apostas; saldo insuficiente e carteira máxima são atômicos', async () => {
  const casino = service(() => 0), { rodada } = await casino.startVoltorb(user(),100);
  await assert.rejects(casino.slots(user(),5), /Termine a rodada/);
  await assert.rejects(casino.buyChips(user(),5), /Termine a rodada/);
  assert.equal(await balance(),9900);
  await casino.leaveRound(user(),token(rodada));
  await assert.rejects(casino.startPiplup(user(),10000), /insuficientes/);
  await db.save.update({ where:{ id:save.id },data:{ fichas:1_999_999_999 } });
  await assert.rejects(casino.slots(user(),5), /limite da carteira/);
  assert.equal(await balance(),1_999_999_999);
});
test('Voltorb antigo devolve a entrada uma vez antes de adotar as novas regras', async () => {
  await db.cassinoRodada.create({ data:{ saveId:save.id,estado:{ aposta:100,tabuleiro:Array(25).fill(1), abertas:[], acumulado:100, restantes:6 } } });
  const casino=service(() => 0);
  assert.equal((await casino.overview(user())).reembolso,100); assert.equal(await balance(),10100);
  assert.equal((await casino.overview(user())).reembolso,0); assert.equal(await balance(),10100);
});
test('API rejeita adulteração, índice inválido, rodada de outro save e resultado fornecido pelo cliente', async () => {
  const headers={ 'X-Save-Id':save.id };
  await request(app).post('/api/cassino/corrida').set(headers).send({ aposta:5,pokemon:5 }).expect(400);
  await request(app).post('/api/cassino/fortune').set(headers).send({ apostas:[{ valor:5,multiplicador:100 }] }).expect(400);
  await request(app).post('/api/cassino/slots').set(headers).send({ aposta:5,premio:100000 }).expect(400);
  const started=(await request(app).post('/api/cassino/voltorb').set(headers).send({ aposta:5 }).expect(200)).body.data;
  await request(app).post('/api/cassino/voltorb/virar').set(headers).send({ ...token(started.rodada),indice:36 }).expect(400);
  const other=(await request(app).post('/api/jogador/saves').send({ nomeTreinador:'Outro' }).expect(201)).body.data;
  await request(app).post('/api/jogador/inicial').set('X-Save-Id',other.id).send({ saveId:other.id,especieId:4 }).expect(201);
  await request(app).post('/api/cassino/voltorb/virar').set('X-Save-Id',other.id).send({ ...token(started.rodada),indice:0 }).expect(409);
  assert.equal(await balance(),9995);
});
