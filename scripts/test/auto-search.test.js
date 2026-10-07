import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPriorityAutoSearchEncounter } from '../../frontend/src/lib/auto-search.js';
import { IV_STATS, perfectIvs } from '../../backend/src/services/ivRules.js';

const ordinaryIvs = Object.fromEntries(Object.keys(IV_STATS).map(stat => [stat, 15]));

test('busca automática pausa por Shiny ou por 4 estrelas, independentemente', () => {
  assert.equal(isPriorityAutoSearchEncounter({ shiny: true, ivs: ordinaryIvs }), true, 'Shiny sem 4 estrelas pausa');
  assert.equal(isPriorityAutoSearchEncounter({ shiny: false, ivs: perfectIvs() }), true, '4 estrelas sem Shiny pausa');
  assert.equal(isPriorityAutoSearchEncounter({ shiny: true, ivs: perfectIvs() }), true, 'Shiny de 4 estrelas pausa');
  assert.equal(isPriorityAutoSearchEncounter({ shiny: false, ivs: ordinaryIvs }), false, 'Pokémon comum continua a busca');
});
