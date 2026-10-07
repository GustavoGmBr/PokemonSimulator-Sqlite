import { randomInt } from 'node:crypto';
import { createCasinoGames, publicCasinoRound } from './casinoGames.js';
import { SLOT_SYMBOLS, SLOT_WEIGHTS, SLOT_LINES, ROULETTE_ORDER, FORTUNE_SEGMENTS, PIPLUP_MULTIPLIERS, PIPLUP_CHANCES, RACERS, weightedIndex, slotPayout, rouletteResult, rouletteMultiplier } from './casinoRules.js';
export { slotPayout, rouletteMultiplier } from './casinoRules.js';
import { HttpError } from '../lib/errors.js';
import { getCatalogo, getEspecie } from './catalogo.js';
import { pokemonSaleValue } from './market.js';

export const CASINO_CHIP_COST = 5;
export const CASINO_MASTER_BALL_PRICE = 10000;
const CASINO_ITEM_PRICES = { 'shiny-stone': 350_000, 'rare-candy': 12_000, 'exp-candy-p': 1_000, 'exp-candy-m': 3_500, 'exp-candy-g': 10_000, 'exp-candy-gg': 30_000 };
const MAX_BALANCE = 2_000_000_000;

function casinoItem(itemId) {
  const item = getCatalogo().itens.find((entry) => entry.nome === itemId);
  if (!item || !['captura', 'cura', 'ivs', 'treino', 'evolucao'].includes(item.categoria)) return null;
  return { itemId, nome: item.nomeExibicao, preco: CASINO_ITEM_PRICES[itemId] ?? (itemId === 'master-ball' ? CASINO_MASTER_BALL_PRICE : Math.ceil(item.precoLoja / CASINO_CHIP_COST)), sprite: item.sprite };
}

function checkBet(save, bet) {
  if (bet > save.fichas) throw new HttpError(409, 'Fichas insuficientes.');
}

function checkBalance(value) {
  if (!Number.isSafeInteger(value) || value > MAX_BALANCE) throw new HttpError(409, 'O prêmio excede o limite da carteira. Reduza a aposta.');
}

export function createCasinoService(db, { rng = randomInt } = {}) {
  async function saveFor(tx, usuarioId) {
    const save = await tx.save.findUnique({ where: { usuarioId } });
    if (!save?.inicialEspecieId) throw new HttpError(409, 'Inicie sua jornada antes de entrar no cassino.');
    return save;
  }
  async function assertNoRound(tx, save) {
    if (await tx.cassinoRodada.findUnique({ where: { saveId: save.id } })) throw new HttpError(409, 'Termine a rodada ativa antes de fazer outra aposta ou comprar fichas.');
  }
  function ensureRoom(save, bet, maximum) {
    checkBalance(save.fichas - bet + Math.floor(bet * maximum));
  }
  async function preparePokemonWager(tx, save, pokemonId) {
    if (!pokemonId) return null;
    const [member, count, battle] = await Promise.all([
      tx.pokemonCapturado.findFirst({ where: { id: pokemonId, saveId: save.id } }),
      tx.pokemonCapturado.count({ where: { saveId: save.id } }),
      tx.batalha.findUnique({ where: { saveId: save.id }, select: { id: true } }),
    ]);
    if (!member) throw new HttpError(404, 'Pokémon apostado não encontrado.');
    if (member.favorito) throw new HttpError(409, 'Remova a marca de favorito antes de apostar este Pokémon.');
    if (count <= 1) throw new HttpError(409, 'Mantenha pelo menos um Pokémon na coleção.');
    if (battle) throw new HttpError(409, 'Encerre a batalha antes de apostar Pokémon.');
    return { pokemonId: member.id, especieId: member.especieId, nome: getEspecie(member.especieId).nomeExibicao, valorBase: pokemonSaleValue(member) };
  }
  async function resolvePokemonWager(tx, save, wager, multiplier) {
    if (!wager) return null;
    const payoutMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 0;
    const ganho = Math.floor(wager.valorBase * payoutMultiplier);
    const fichas = Math.floor(ganho / CASINO_CHIP_COST);
    return { pokemonId: wager.pokemonId, nome: wager.nome, valorBase: wager.valorBase, multiplicador: payoutMultiplier, ganho, fichas };
  }
  async function consumePokemonWager(tx, wager) {
    if (wager) await tx.pokemonCapturado.delete({ where: { id: wager.pokemonId } });
  }
  const games = createCasinoGames(db, { saveFor, checkBet, checkBalance, ensureRoom, assertNoRound, preparePokemonWager, consumePokemonWager, resolvePokemonWager, rng });
  return {
    async overview(usuarioId) {
      return db.$transaction(async tx => {
        let save = await saveFor(tx, usuarioId);
        let round = await tx.cassinoRodada.findUnique({ where: { saveId: save.id } });
        let reembolso = 0;
        if (round && (!round.estado.jogo || round.estado.jogo === 'cartas')) {
          reembolso = round.estado.aposta;
          checkBalance(save.fichas + reembolso);
          save = await tx.save.update({ where: { id: save.id }, data: { fichas: { increment: reembolso } } });
          await tx.cassinoRodada.delete({ where: { saveId: save.id } }); round = null;
        }
        return { fichas: save.fichas, moedas: save.moedas, custoFicha: CASINO_CHIP_COST, reembolso, itens: getCatalogo().itens.filter(item => ['captura', 'cura', 'ivs', 'treino', 'evolucao'].includes(item.categoria) && casinoItem(item.nome)).map(item => casinoItem(item.nome)), rodada: publicCasinoRound(round?.estado), regras: { linhas: SLOT_LINES, roleta: ROULETTE_ORDER, casasRoleta: ROULETTE_ORDER.map(numero => rouletteResult(numero)), fortune: FORTUNE_SEGMENTS, piplup: PIPLUP_MULTIPLIERS, chancesPiplup: PIPLUP_CHANCES, corredores: RACERS } };
      }, { isolationLevel: 'Serializable' });
    },
    async buyChips(usuarioId, quantidade) {
      return db.$transaction(async (tx) => {
        const save = await saveFor(tx, usuarioId);
        await assertNoRound(tx, save);
        const cost = quantidade * CASINO_CHIP_COST;
        if (save.fichas + quantidade > MAX_BALANCE) throw new HttpError(409, 'Limite de fichas excedido.');
        const paid = await tx.save.updateMany({ where: { id: save.id, moedas: { gte: cost } }, data: { moedas: { decrement: cost }, fichas: { increment: quantidade } } });
        if (paid.count !== 1) throw new HttpError(409, 'Pokédólares insuficientes.');
        return { fichas: save.fichas + quantidade, moedas: save.moedas - cost };
      }, { isolationLevel: 'Serializable' });
    },
    async buyItems(usuarioId, entries) {
      const lines = entries.map(({ itemId, quantidade }) => ({ item: casinoItem(itemId), itemId, quantidade }));
      if (lines.some(({ item }) => !item)) throw new HttpError(400, 'Item indisponível no cassino.');
      const cost = lines.reduce((sum, { item, quantidade }) => sum + item.preco * quantidade, 0);
      return db.$transaction(async (tx) => {
        const save = await saveFor(tx, usuarioId);
        checkBet(save, cost);
        for (const { itemId, quantidade } of lines) await tx.itemInventario.upsert({ where: { saveId_itemId: { saveId: save.id, itemId } }, create: { saveId: save.id, itemId, quantidade }, update: { quantidade: { increment: quantidade } } });
        await tx.save.update({ where: { id: save.id }, data: { fichas: { decrement: cost } } });
        return { custo: cost, fichas: save.fichas - cost };
      }, { isolationLevel: 'Serializable' });
    },
    async slots(usuarioId, aposta, pokemonId) {
      return db.$transaction(async (tx) => {
        const save = await saveFor(tx, usuarioId);
        checkBet(save, aposta);
        await assertNoRound(tx, save); ensureRoom(save, aposta, SLOT_LINES.length * 100);
        const pokemonWager = await preparePokemonWager(tx, save, pokemonId);
        const symbols = Array.from({ length: 9 }, () => SLOT_SYMBOLS[weightedIndex(SLOT_WEIGHTS, rng)]);
        const result = slotPayout(symbols, aposta);
        await consumePokemonWager(tx, pokemonWager);
        const pokemonMultiplier = result.linhas.reduce((sum, line) => sum + line.multiplicador, 0);
        const pokemonPremio = await resolvePokemonWager(tx, save, pokemonWager, pokemonMultiplier);
        const fichas = save.fichas - aposta + result.premio + (pokemonPremio?.fichas ?? 0);
        const moedas = save.moedas + (pokemonPremio?.ganho ?? 0);
        checkBalance(fichas); checkBalance(moedas);
        await tx.save.update({ where: { id: save.id }, data: { fichas, moedas } });
        return { simbolos: symbols, aposta, ...result, pokemonAposta: pokemonWager, pokemonPremio, fichas, moedas };
      }, { isolationLevel: 'Serializable' });
    },
    async roulette(usuarioId, bets, pokemonWager) {
      const total = bets.reduce((sum, bet) => sum + bet.valor, 0);
      return db.$transaction(async (tx) => {
        const save = await saveFor(tx, usuarioId);
        checkBet(save, total);
        await assertNoRound(tx, save); ensureRoom(save, total, 36);
        const result = rouletteResult(rng(37));
        const details = bets.map((bet) => ({ ...bet, premio: bet.valor * rouletteMultiplier(result, bet) }));
        const premio = details.reduce((sum, bet) => sum + bet.premio, 0);
        let pokemonPremio = null, pokemonStake = null;
        if (pokemonWager) {
          pokemonStake = await preparePokemonWager(tx, save, pokemonWager.pokemonId);
          const multiplier = rouletteMultiplier(result, pokemonWager);
          await consumePokemonWager(tx, pokemonStake);
          pokemonPremio = await resolvePokemonWager(tx, save, pokemonStake, multiplier);
        }
        const fichas = save.fichas - total + premio + (pokemonPremio?.fichas ?? 0), moedas = save.moedas + (pokemonPremio?.ganho ?? 0);
        checkBalance(fichas); checkBalance(moedas);
        await tx.save.update({ where: { id: save.id }, data: { fichas, moedas } });
        return { resultado: result, apostas: details, custo: total, premio, pokemonAposta: pokemonStake, pokemonPremio, fichas, moedas };
      }, { isolationLevel: 'Serializable' });
    },
    ...games,
  };
}
