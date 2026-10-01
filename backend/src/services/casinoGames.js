import { randomUUID } from 'node:crypto';
import { HttpError } from '../lib/errors.js';
import { CASINO_POKEMON, FORTUNE_SEGMENTS, PIPLUP_MULTIPLIERS, PIPLUP_CHANCES, shuffle, weightedIndex, cardPayout, makeVoltorbBoard, voltorbPayout, blackjackDeck, handScore, blackjackOutcome, raceResult } from './casinoRules.js';

export function publicCasinoRound(state, finished = false) {
  if (!state) return null;
  const base = { id: state.id, versao: state.versao, jogo: state.jogo, aposta: state.aposta };
  if (state.jogo === 'cartas') return { ...base, apostas: state.apostas, casas: state.tabuleiro.map((card, i) => finished || state.abertas.includes(i) ? card : null), abertas: state.abertas };
  if (state.jogo === 'voltorb') {
    const payout = voltorbPayout(state.tabuleiro, state.abertas, state.aposta);
    return { ...base, casas: state.tabuleiro.map((value, i) => finished || state.abertas.includes(i) ? value : null), abertas: state.abertas, restantes: 5 - state.abertas.length, acumulado: payout.premio, ...payout };
  }
  if (state.jogo === 'pokejack') return { ...base, jogador: state.jogador, banca: finished ? state.banca : [state.banca[0], null], totalJogador: handScore(state.jogador), totalBanca: finished ? handScore(state.banca) : null, podeDobrar: !finished && state.jogador.length === 2 };
  return { ...base, passos: state.passos, multiplicador: state.passos ? PIPLUP_MULTIPLIERS[state.passos - 1] : 0, proximaChance: PIPLUP_CHANCES[state.passos] ?? null, acumulado: state.passos ? Math.floor(state.aposta * PIPLUP_MULTIPLIERS[state.passos - 1]) : 0 };
}

export function createCasinoGames(db, { saveFor, checkBet, checkBalance, ensureRoom, assertNoRound, rng }) {
  const transaction = fn => db.$transaction(fn, { isolationLevel: 'Serializable' });
  function initial(jogo, aposta, extra) { return { jogo, aposta, id: randomUUID(), versao: 0, ...extra }; }
  async function begin(tx, save, state) {
    await tx.save.update({ where: { id: save.id }, data: { fichas: { decrement: state.aposta } } });
    await tx.cassinoRodada.create({ data: { saveId: save.id, estado: state } });
    return { rodada: publicCasinoRound(state), fichas: save.fichas - state.aposta };
  }
  async function current(tx, save, jogo, request) {
    const round = await tx.cassinoRodada.findUnique({ where: { saveId: save.id } });
    const state = round?.estado;
    if (!state || (jogo && state.jogo !== jogo) || state.id !== request.rodadaId || state.versao !== request.versao) throw new HttpError(409, 'A rodada mudou. Atualize o cassino antes de jogar novamente.');
    return structuredClone(state);
  }
  async function persist(tx, save, state, extra = {}) {
    state.versao++;
    await tx.cassinoRodada.update({ where: { saveId: save.id }, data: { estado: state } });
    return { rodada: publicCasinoRound(state), fichas: save.fichas, ...extra };
  }
  async function finish(tx, save, state, result) {
    checkBalance(save.fichas + result.premio);
    await tx.save.update({ where: { id: save.id }, data: { fichas: { increment: result.premio } } });
    await tx.cassinoRodada.delete({ where: { saveId: save.id } });
    return { ...result, rodada: null, mesa: publicCasinoRound(state, true), aposta: state.aposta, fichas: save.fichas + result.premio };
  }
  async function settleBlackjack(tx, save, state) {
    if (handScore(state.jogador) <= 21) while (handScore(state.banca) < 17) state.banca.push(state.baralho.pop());
    return finish(tx, save, state, blackjackOutcome(state.jogador, state.banca, state.aposta));
  }
  return {
    async cards(usuarioId, apostas) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId), cost = apostas.reduce((sum, bet) => sum + bet.valor, 0);
        await assertNoRound(tx, save); checkBet(save, cost); ensureRoom(save, cost, 24);
        return begin(tx, save, initial('cartas', cost, { apostas, abertas: [], tabuleiro: shuffle(CASINO_POKEMON.flatMap(pokemon => Array.from({ length: 6 }, (_, i) => ({ pokemon, numero: i + 1 }))), rng) }));
      });
    },
    async flipCard(usuarioId, request) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId), state = await current(tx, save, 'cartas', request);
        const carta = state.tabuleiro[request.indice]; state.abertas.push(request.indice);
        const apostas = state.apostas.map(bet => ({ ...bet, premio: cardPayout(carta, bet) }));
        return finish(tx, save, state, { resultado: 'concluida', carta, escolhida: request.indice, apostas, premio: apostas.reduce((sum, bet) => sum + bet.premio, 0) });
      });
    },
    async startVoltorb(usuarioId, aposta) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId); await assertNoRound(tx, save); checkBet(save, aposta); ensureRoom(save, aposta, 28);
        return begin(tx, save, initial('voltorb', aposta, { tabuleiro: makeVoltorbBoard(rng), abertas: [] }));
      });
    },
    async flipVoltorb(usuarioId, request) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId), state = await current(tx, save, 'voltorb', request);
        if (state.abertas.includes(request.indice)) throw new HttpError(409, 'Esta carta já foi aberta.');
        state.abertas.push(request.indice);
        if (state.abertas.length === 5) return finish(tx, save, state, { resultado: 'concluida', ...voltorbPayout(state.tabuleiro, state.abertas, state.aposta) });
        return persist(tx, save, state);
      });
    },
    async startPokejack(usuarioId, aposta) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId); await assertNoRound(tx, save); checkBet(save, aposta); ensureRoom(save, aposta, 4);
        const baralho = blackjackDeck(rng), state = initial('pokejack', aposta, { baralho, jogador: [baralho.pop(), baralho.pop()], banca: [baralho.pop(), baralho.pop()] });
        await begin(tx, save, state);
        if (handScore(state.jogador) === 21 || handScore(state.banca) === 21) return finish(tx, { ...save, fichas: save.fichas - aposta }, state, blackjackOutcome(state.jogador, state.banca, aposta));
        return { rodada: publicCasinoRound(state), fichas: save.fichas - aposta };
      });
    },
    async actPokejack(usuarioId, request) {
      return transaction(async tx => {
        let save = await saveFor(tx, usuarioId);
        const state = await current(tx, save, 'pokejack', request);
        if (request.acao === 'dobrar') {
          if (state.jogador.length !== 2) throw new HttpError(409, 'Só é possível dobrar com as duas cartas iniciais.');
          checkBet(save, state.aposta); ensureRoom(save, state.aposta, 4);
          await tx.save.update({ where: { id: save.id }, data: { fichas: { decrement: state.aposta } } });
          save = { ...save, fichas: save.fichas - state.aposta }; state.aposta *= 2;
          state.jogador.push(state.baralho.pop());
          return settleBlackjack(tx, save, state);
        }
        if (request.acao === 'pedir') {
          state.jogador.push(state.baralho.pop());
          if (handScore(state.jogador) < 21) return persist(tx, save, state);
        }
        return settleBlackjack(tx, save, state);
      });
    },
    async race(usuarioId, aposta, pokemon) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId); await assertNoRound(tx, save); checkBet(save, aposta); ensureRoom(save, aposta, 4);
        const race = raceResult(rng), premio = race.vencedor === pokemon ? aposta * 4 : 0;
        await tx.save.update({ where: { id: save.id }, data: { fichas: save.fichas - aposta + premio } });
        return { ...race, aposta, escolhido: pokemon, premio, fichas: save.fichas - aposta + premio };
      });
    },
    async fortune(usuarioId, apostas) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId), cost = apostas.reduce((sum, bet) => sum + bet.valor, 0);
        await assertNoRound(tx, save); checkBet(save, cost); ensureRoom(save, cost, 10);
        const indice = weightedIndex(FORTUNE_SEGMENTS.map(segment => segment.peso), rng), multiplicador = FORTUNE_SEGMENTS[indice].multiplicador;
        const details = apostas.map(bet => ({ ...bet, premio: bet.multiplicador === multiplicador ? Math.floor(bet.valor * multiplicador) : 0 }));
        const premio = details.reduce((sum, bet) => sum + bet.premio, 0);
        await tx.save.update({ where: { id: save.id }, data: { fichas: save.fichas - cost + premio } });
        return { indice, multiplicador, apostas: details, custo: cost, premio, fichas: save.fichas - cost + premio };
      });
    },
    async startPiplup(usuarioId, aposta) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId); await assertNoRound(tx, save); checkBet(save, aposta); ensureRoom(save, aposta, 5);
        return begin(tx, save, initial('piplup', aposta, { passos: 0 }));
      });
    },
    async actPiplup(usuarioId, request) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId), state = await current(tx, save, 'piplup', request);
        if (request.acao === 'sacar') {
          if (!state.passos) throw new HttpError(409, 'Complete ao menos um salto antes de sacar.');
          return finish(tx, save, state, { resultado: 'saque', premio: Math.floor(state.aposta * PIPLUP_MULTIPLIERS[state.passos - 1]) });
        }
        if (rng(100) >= PIPLUP_CHANCES[state.passos]) return finish(tx, save, state, { resultado: 'queda', premio: 0 });
        state.passos++;
        if (state.passos === 7) return finish(tx, save, state, { resultado: 'vitoria', premio: state.aposta * 5 });
        return persist(tx, save, state);
      });
    },
    async leaveRound(usuarioId, request) {
      return transaction(async tx => {
        const save = await saveFor(tx, usuarioId), state = await current(tx, save, null, request);
        return finish(tx, save, state, { resultado: 'desistencia', premio: 0 });
      });
    },
  };
}
