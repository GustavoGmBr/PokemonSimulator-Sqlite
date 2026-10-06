import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveArchiveData, normalizeSaveArchive, SAVE_ARCHIVE_FORMAT, SAVE_ARCHIVE_VERSION } from '../../backend/src/services/saveArchive.js';

function archive(overrides = {}) {
  return {
    format: SAVE_ARCHIVE_FORMAT,
    formatVersion: SAVE_ARCHIVE_VERSION,
    data: {
      save: { nomeTreinador: 'Misty', moedas: 120, fichas: 30, vitorias: 4, derrotas: 1, iniciadoEm: '2026-01-01T00:00:00.000Z', usuarioId: 'untrusted', campoExtra: true },
      pokemon: [{ id: 'source-pokemon', especieId: 7, nivel: 5, hpAtual: 20, capturadoEm: '2026-01-01T00:00:00.000Z', saveId: 'foreign-save' }],
      inventory: [{ itemId: 'potion', quantidade: 2 }],
      battles: [{ versao: 2, estado: { jogador: [{ pokemonId: 'source-pokemon' }] } }],
      challenges: [], registeredSpecies: [{ especieId: 7 }], events: [], claimedMissions: [], casinoRound: null, marketStock: null,
      ...overrides,
    },
  };
}

test('accepts a save archive and strips fields that could target another save', () => {
  const result = normalizeSaveArchive(archive());
  assert.equal(result.save.nomeTreinador, 'Misty');
  assert.equal(result.save.usuarioId, undefined);
  assert.equal(result.pokemon[0].saveId, undefined);
  assert.equal(result.pokemon[0].id, 'source-pokemon');
  assert.ok(result.pokemon[0].capturadoEm instanceof Date);
  assert.equal(result.battles[0].estado.jogador[0].pokemonId, 'source-pokemon');
});

test('rejects unsupported save format versions', () => {
  assert.throws(() => normalizeSaveArchive({ ...archive(), formatVersion: 99 }), /versão incompatível/);
});

test('rejects invalid currency and inventory quantities', () => {
  assert.throws(() => normalizeSaveArchive(archive({ save: { nomeTreinador: 'Misty', moedas: -1 } })), /Valor inválido/);
  assert.throws(() => normalizeSaveArchive(archive({ inventory: [{ itemId: 'potion', quantidade: -2 }] })), /inventário/);
});

test('exports a portable archive without linking it to the original account', () => {
  const exported = createSaveArchiveData({
    id: 'save-1', usuarioId: 'owner-1', nomeTreinador: 'Ash',
    pokemons: [], inventario: [], batalhas: [], desafios: [], especiesRegistradas: [], eventos: [],
    missoesResgatadas: [], cassinoRodada: null, lojaPokemonEstoque: null,
  });
  assert.equal(exported.format, SAVE_ARCHIVE_FORMAT);
  assert.equal(exported.data.save.usuarioId, undefined);
  assert.equal(exported.data.pokemon.length, 0);
});
