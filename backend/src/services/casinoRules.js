import { randomInt } from 'node:crypto';

export const SLOT_SYMBOLS = ['mew', 'mewtwo', 'master-ball', 'pikachu', 'ultra-ball', 'great-ball', 'poke-ball', 'ditto'];
export const SLOT_WEIGHTS = [2, 4, 2, 11, 16, 21, 27, 17];
export const SLOT_MULTIPLIERS = { 'poke-ball': 0.5, 'great-ball': 1.5, 'ultra-ball': 3, pikachu: 5, ditto: 4, mewtwo: 30, mew: 50, 'master-ball': 100 };
// Grid positions are read left-to-right, top-to-bottom. Every horizontal,
// vertical, and diagonal trio is an active line.
export const SLOT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [6, 4, 2]];
export const ROULETTE_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_MASCOTS = { vermelhoImpar: { nome: 'Charmander', especieId: 4 }, pretoImpar: { nome: 'Squirtle', especieId: 7 }, vermelhoPar: { nome: 'Bulbasaur', especieId: 1 }, pretoPar: { nome: 'Pikachu', especieId: 25 }, verde: { nome: 'Mew', especieId: 151 } };
export const FORTUNE_SEGMENTS = [
  { multiplicador: 0, peso: 20, cor: '#444a59' },
  { multiplicador: 0.25, peso: 18, cor: '#886b99' },
  { multiplicador: 0.5, peso: 18, cor: '#497d94' },
  { multiplicador: 1, peso: 20, cor: '#387f68' },
  { multiplicador: 2, peso: 16, cor: '#b08740' },
  { multiplicador: 5, peso: 6, cor: '#be6550' },
  { multiplicador: 10, peso: 2, cor: '#b94672' },
];
export const PIPLUP_MULTIPLIERS = [1, 1.1, 1.5, 2, 2.5, 3.5, 5];
export const PIPLUP_CHANCES = [90, 85, 80, 80, 75, 70, 65];
export const RACERS = [
  { id: 25, nome: 'Pikachu' }, { id: 77, nome: 'Ponyta' }, { id: 84, nome: 'Doduo' },
  { id: 133, nome: 'Eevee' }, { id: 393, nome: 'Piplup' },
];

export function weightedIndex(weights, rng = randomInt) {
  let ticket = rng(weights.reduce((sum, weight) => sum + weight, 0));
  for (const [index, weight] of weights.entries()) { ticket -= weight; if (ticket < 0) return index; }
  throw new Error('Sorteio fora do intervalo.');
}
export function shuffle(values, rng = randomInt) {
  const deck = [...values];
  for (let i = deck.length - 1; i > 0; i--) { const j = rng(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
export function slotPayout(grid, bet) {
  const wins = [];
  for (const [index, positions] of SLOT_LINES.entries()) {
    const symbols = positions.map(position => grid[position]);
    const regular = symbols.filter(symbol => symbol !== 'ditto');
    const wildcards = symbols.length - regular.length;
    const symbol = regular[0] ?? 'ditto';
    const matching = regular.every(value => value === symbol);
    const multiplier = wildcards === 3 ? 4 : wildcards === 2 ? 1 : matching ? SLOT_MULTIPLIERS[symbol] ?? 0 : 0;
    if (multiplier) wins.push({ linha: index + 1, posicoes: positions, simbolo: wildcards >= 2 ? 'ditto' : symbol, multiplicador: multiplier, premio: Math.floor(bet * multiplier), coringas: wildcards });
  }
  return { premio: wins.reduce((sum, win) => sum + win.premio, 0), linhas: wins };
}
export function rouletteResult(numero) {
  const cor = numero === 0 ? 'verde' : RED.has(numero) ? 'vermelho' : 'preto';
  const mascotKey = numero === 0 ? 'verde' : `${cor}${numero % 2 ? 'Impar' : 'Par'}`;
  return { numero, cor, pokemon: ROULETTE_MASCOTS[mascotKey].nome, especieId: ROULETTE_MASCOTS[mascotKey].especieId };
}
export function rouletteMultiplier(result, bet) {
  if (bet.tipo === 'numero') return result.numero === bet.numero ? 36 : 0;
  if (bet.tipo === 'paridade') return result.numero > 0 && (result.numero % 2 === 0 ? 'par' : 'impar') === bet.paridade ? 2 : 0;
  if (bet.tipo === 'faixa') return result.numero > 0 && (result.numero <= 18 ? 'baixa' : 'alta') === bet.faixa ? 2 : 0;
  if (bet.tipo === 'duzia') return result.numero > 0 && Math.ceil(result.numero / 12) === bet.duzia ? 3 : 0;
  if (bet.tipo === 'pokemon') return bet.pokemon === result.pokemon ? 4 : 0;
  if (bet.tipo === 'exata') return bet.pokemon === result.pokemon && bet.cor === result.cor ? 12 : 0;
  return bet.cor === result.cor ? (bet.cor === 'verde' ? 36 : 2) : 0;
}
export function makeVoltorbBoard(rng = randomInt) {
  return shuffle([...Array(6).fill(0), ...Array(10).fill(0.25), ...Array(9).fill(0.5), ...Array(5).fill(1.2), ...Array(3).fill(1.5), 2, 2, 5], rng);
}
export function voltorbPayout(board, opened, bet) {
  const size = Math.sqrt(board.length);
  const sumUnits = opened.reduce((total, index) => total + Math.round(board[index] * 100), 0);
  const line = new Set(opened).size === size && opened.length === size && (opened.every(index => Math.floor(index / size) === Math.floor(opened[0] / size)) || opened.every(index => index % size === opened[0] % size));
  // Preserve the payout of 5×5 rounds started before this update.
  const bonusLinha = line ? size === 5 ? 2 : 1.5 : 1;
  const multiplicador = sumUnits * bonusLinha / 100;
  return { soma: sumUnits / 100, bonusLinha, multiplicador, premio: Math.floor(bet * sumUnits * bonusLinha / 100) };
}
export function blackjackDeck(rng = randomInt) {
  return shuffle(['♠', '♥', '♦', '♣'].flatMap(naipe => Array.from({ length: 13 }, (_, index) => ({ valor: index + 1, naipe }))), rng);
}
export function handScore(cards) {
  let total = cards.reduce((sum, card) => sum + (card.valor === 1 ? 11 : Math.min(10, card.valor)), 0);
  let aces = cards.filter(card => card.valor === 1).length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
export function blackjackOutcome(player, dealer, bet) {
  const p = handScore(player), d = handScore(dealer);
  const natural = player.length === 2 && p === 21, dealerNatural = dealer.length === 2 && d === 21;
  const resultado = p > 21 ? 'derrota' : dealerNatural ? (natural ? 'empate' : 'derrota') : natural ? 'pokejack'
    : d > 21 || p > d ? 'vitoria' : p === d ? 'empate' : 'derrota';
  const multiplicador = { derrota: 0, empate: 1, vitoria: 2, pokejack: 3 }[resultado];
  return { resultado, multiplicador, premio: bet * multiplicador };
}
export function raceResult(rng = randomInt) {
  const frames = [Array(5).fill(0)];
  let winner = -1;
  while (winner < 0) {
    const before = frames.at(-1), steps = RACERS.map(() => 1 + rng(9));
    const next = before.map((position, i) => position + steps[i]);
    const crossings = next.map((position, i) => position >= 100 ? { i, time: (100 - before[i]) / steps[i] } : null).filter(Boolean).sort((a, b) => a.time - b.time);
    if (crossings.length) {
      const tied = crossings.filter(entry => entry.time === crossings[0].time);
      winner = tied[rng(tied.length)].i;
      frames.push(next.map((position, i) => i === winner ? 100 : Math.min(99, before[i] + steps[i] * crossings[0].time)));
    } else frames.push(next);
  }
  return { vencedor: winner, quadros: frames };
}
