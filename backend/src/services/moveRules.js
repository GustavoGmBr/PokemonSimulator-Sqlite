import { getCatalogo } from './catalogo.js';
import { levelMovesFor } from './battleRules.js';

const HMS = new Set(['cut', 'fly', 'surf', 'strength', 'flash', 'rock-smash', 'waterfall']);
export const BANNED_MOVES = new Set(['self-destruct', 'explosion', 'misty-explosion', 'memento', 'healing-wish', 'lunar-dance', 'final-gambit']);

export function damagingMove(name) {
  return getCatalogo().golpes.find((move) => move.nome === name && !BANNED_MOVES.has(move.nome) && move.poder > 0 && ['physical', 'special'].includes(move.categoria));
}

export function usableMove(name) {
  const move = getCatalogo().golpes.find((entry) => entry.nome === name);
  return move && !BANNED_MOVES.has(move.nome) && (move.categoria === 'status' || move.poder > 0 && ['physical', 'special'].includes(move.categoria)) ? move : null;
}

export function naturalMoves(species, level) {
  return [...new Set(species.golpesAprendidos.filter((entry) => entry.metodo === 'level-up' && entry.nivel <= level && usableMove(entry.golpe)).map((entry) => entry.golpe))];
}

export function unlockedMoves(member, species) {
  const saved = Array.isArray(member.golpesDesbloqueados) ? member.golpesDesbloqueados : [];
  const equipped = Array.isArray(member.golpes) ? member.golpes.map((entry) => entry.nome) : [];
  return [...new Set([...saved, ...naturalMoves(species, member.nivel), ...equipped].filter((name) => usableMove(name)))];
}

export function equippedMoves(member, species) {
  const names = Array.isArray(member.golpes) ? member.golpes.map((entry) => entry.nome) : [];
  const valid = [...new Set(names.filter((name) => usableMove(name)))].slice(0, 4);
  return valid.length ? valid : levelMovesFor(species, member.nivel).map((move) => move.nome);
}

export function tmMoves(species) {
  return [...new Set(species.golpesAprendidos.filter((entry) => entry.metodo === 'machine' && !HMS.has(entry.golpe) && usableMove(entry.golpe)).map((entry) => entry.golpe))]
    .map((name) => usableMove(name)).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function tmPrice(move) {
  return Math.max(1000, Math.ceil((move.poder * 20 + 500) / 100) * 100);
}
