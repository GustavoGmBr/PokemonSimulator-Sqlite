import { ivQuality } from './ivs.js';

export function isPriorityAutoSearchEncounter(opponent) {
  return Boolean(opponent && (opponent.shiny || ivQuality(opponent.ivs).stars === 4));
}
