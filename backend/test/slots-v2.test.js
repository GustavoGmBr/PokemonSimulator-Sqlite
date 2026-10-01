import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_LINES, SLOT_MULTIPLIERS, SLOT_SYMBOLS, SLOT_WEIGHTS, slotPayout, weightedIndex } from '../src/services/casinoRules.js';
import { casinoWagerSchema, raceSchema, rouletteSchema } from '../src/validators/casino.js';

test('caça-níqueis paga trincas nas três colunas verticais', () => {
  const grid = ['pikachu', 'blank', 'blank', 'pikachu', 'blank', 'blank', 'pikachu', 'blank', 'blank'];
  const result = slotPayout(grid, 100);
  assert.deepEqual(result.linhas.map(({ linha }) => linha), [4]);
  assert.equal(result.linhas[0].premio, 500);
});

test('Ditto substitui um símbolo para completar trincas e trinca de Ditto paga 5×', () => {
  const grid = ['poke-ball', 'ditto', 'poke-ball', 'blank', 'blank', 'blank', 'blank', 'blank', 'blank'];
  const result = slotPayout(grid, 100);
  assert.deepEqual(result.linhas.map(({ linha }) => linha), [1]);
  assert.equal(result.linhas[0].simbolo, 'poke-ball');
  assert.equal(result.linhas[0].coringas, 1);
  assert.equal(result.linhas[0].premio, 50);
  assert.equal(slotPayout(Array(9).fill('ditto'), 100).linhas[0].premio, 500);
  assert.equal(slotPayout(['ditto','poke-ball','great-ball',...Array(6).fill('blank')], 100).linhas.length, 0);
});

test('APIs aceitam aposta sem fichas quando existe um Pokémon em jogo', () => {
  const stake = { pokemonId: 'pokemon-123' };
  assert.equal(casinoWagerSchema.safeParse({ aposta: 0, pokemonAposta: stake }).success, true);
  assert.equal(casinoWagerSchema.safeParse({ aposta: 0 }).success, false);
  assert.equal(raceSchema.safeParse({ aposta: 0, pokemon: 2, pokemonAposta: stake }).success, true);
  assert.equal(rouletteSchema.safeParse({ apostas: [], pokemonAposta: { tipo: 'numero', numero: 10, pokemonId: stake.pokemonId } }).success, true);
});

test('oito linhas horizontais, verticais e diagonais são avaliadas', () => {
  assert.equal(SLOT_LINES.length, 8);
  const result = slotPayout(Array(9).fill('mew'), 10);
  assert.equal(result.linhas.length, 8);
  assert.equal(result.premio, 8 * 50 * 10);
});

test('o símbolo vazio tem peso de 35% e a tabela de prêmios soma 100%', () => {
  assert.deepEqual(SLOT_SYMBOLS.filter((symbol) => symbol !== 'blank').sort(), Object.keys(SLOT_MULTIPLIERS).sort());
  assert.equal(SLOT_SYMBOLS.includes('ditto'), true);
  assert.equal(SLOT_SYMBOLS.includes('magikarp'), false);
  assert.equal(SLOT_SYMBOLS.includes('bar'), false);
  assert.equal(SLOT_WEIGHTS.length, SLOT_SYMBOLS.length);
  assert.equal(SLOT_WEIGHTS.reduce((sum, weight) => sum + weight, 0), 100);
  assert.equal(SLOT_WEIGHTS[SLOT_SYMBOLS.indexOf('blank')], 35);
  assert.equal(Array.from({length:100},(_,ticket)=>SLOT_SYMBOLS[weightedIndex(SLOT_WEIGHTS,()=>ticket)]).filter(symbol=>symbol==='blank').length,35);
  for (const [symbol, multiplier] of Object.entries(SLOT_MULTIPLIERS)) {
    const result = slotPayout(Array(9).fill(symbol), 100);
    assert.equal(result.linhas[0].multiplicador, multiplier, symbol);
    assert.equal(result.linhas[0].premio, Math.floor(100 * multiplier), symbol);
  }
});
