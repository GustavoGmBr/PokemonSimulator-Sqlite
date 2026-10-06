import { randomUUID } from 'node:crypto';
import { HttpError } from '../lib/errors.js';

export const SAVE_ARCHIVE_FORMAT = 'pokemon-simulator-save';
export const SAVE_ARCHIVE_VERSION = 1;

const SAVE_FIELDS = ['nomeTreinador', 'moedas', 'fichas', 'vitorias', 'derrotas', 'iniciadoEm', 'inicialEspecieId', 'criadoEm', 'atualizadoEm', 'kitEntregue'];
const POKEMON_FIELDS = ['id', 'especieId', 'apelido', 'nivel', 'experiencia', 'hpAtual', 'shiny', 'bolaCaptura', 'sexo', 'amizade', 'investimentoItens', 'favorito', 'megaForma', 'gmaxForma', 'atributos', 'ivs', 'golpes', 'golpesDesbloqueados', 'posicaoTime', 'capturadoEm'];
const EVENT_FIELDS = ['tipo', 'especieId', 'regiao', 'dificuldade', 'torneioId', 'resultado', 'descricao', 'shiny', 'criadoEm'];

function fail(message) { throw new HttpError(400, message); }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function dateOrNull(value, field) {
  if (value == null) return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) fail(`Data inválida no arquivo de save (${field}).`);
  return result;
}
function copyFields(value, fields) {
  const result = {};
  for (const field of fields) if (Object.hasOwn(value, field)) result[field] = value[field];
  return result;
}
function cleanRows(value, name, max, fields, dateFields = []) {
  if (!Array.isArray(value) || value.length > max || value.some((row) => !isRecord(row))) fail(`A seção ${name} do arquivo de save é inválida.`);
  return value.map((row) => {
    const result = copyFields(row, fields);
    for (const field of dateFields) if (Object.hasOwn(result, field)) result[field] = dateOrNull(result[field], `${name}.${field}`);
    return result;
  });
}
function cleanSingle(value, name, fields) {
  if (value == null) return null;
  if (!isRecord(value)) fail(`A seção ${name} do arquivo de save é inválida.`);
  return copyFields(value, fields);
}
function validateSave(value) {
  if (!isRecord(value) || typeof value.nomeTreinador !== 'string' || value.nomeTreinador.trim().length < 2 || value.nomeTreinador.length > 30) fail('O arquivo não contém um treinador válido.');
  for (const field of ['moedas', 'fichas', 'vitorias', 'derrotas']) {
    if (!Number.isSafeInteger(value[field] ?? 0) || (value[field] ?? 0) < 0) fail(`Valor inválido no save (${field}).`);
  }
  if (value.inicialEspecieId != null && !Number.isInteger(value.inicialEspecieId)) fail('Pokémon inicial inválido no arquivo.');
  const result = copyFields(value, SAVE_FIELDS);
  result.nomeTreinador = value.nomeTreinador.trim();
  result.iniciadoEm = dateOrNull(value.iniciadoEm, 'iniciadoEm');
  result.criadoEm = dateOrNull(value.criadoEm, 'criadoEm') ?? new Date();
  result.atualizadoEm = new Date();
  return result;
}
function remap(value, ids) {
  if (typeof value === 'string') return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((entry) => remap(entry, ids));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, remap(entry, ids)]));
  return value;
}

export function normalizeSaveArchive(archive) {
  if (!isRecord(archive) || archive.format !== SAVE_ARCHIVE_FORMAT || archive.formatVersion !== SAVE_ARCHIVE_VERSION || !isRecord(archive.data)) {
    fail('Formato de arquivo de save desconhecido ou versão incompatível.');
  }
  const data = archive.data;
  const save = validateSave(data.save);
  const pokemonRows = cleanRows(data.pokemon, 'Pokémon', 10000, POKEMON_FIELDS, ['capturadoEm']);
  const inventory = cleanRows(data.inventory, 'inventário', 2000, ['itemId', 'quantidade']);
  const battles = cleanRows(data.battles, 'batalhas', 1, ['versao', 'estado', 'criadoEm', 'atualizadoEm'], ['criadoEm', 'atualizadoEm']);
  const challenges = cleanRows(data.challenges, 'desafios', 1000, ['desafioId', 'vencidoEm'], ['vencidoEm']);
  const registeredSpecies = cleanRows(data.registeredSpecies, 'Pokédex', 2000, ['especieId']);
  const events = cleanRows(data.events, 'histórico', 100000, EVENT_FIELDS, ['criadoEm']);
  const claimedMissions = cleanRows(data.claimedMissions, 'missões resgatadas', 100000, ['periodo', 'indice', 'criadoEm'], ['criadoEm']);
  const casinoRound = cleanSingle(data.casinoRound, 'rodada do cassino', ['estado', 'criadoEm']);
  if (casinoRound && Object.hasOwn(casinoRound, 'criadoEm')) casinoRound.criadoEm = dateOrNull(casinoRound.criadoEm, 'cassinoRodada.criadoEm');
  const marketStock = cleanSingle(data.marketStock, 'estoque do mercado', ['periodo', 'estado']);
  for (const item of inventory) if (typeof item.itemId !== 'string' || !item.itemId || !Number.isInteger(item.quantidade) || item.quantidade < 0) fail('O inventário do arquivo de save é inválido.');
  for (const pokemon of pokemonRows) {
    if (!Number.isInteger(pokemon.especieId) || pokemon.especieId < 1 || pokemon.especieId > 1025 || !Number.isInteger(pokemon.nivel) || pokemon.nivel < 1 || pokemon.nivel > 100 || !Number.isInteger(pokemon.hpAtual) || pokemon.hpAtual < 0) fail('A coleção de Pokémon no arquivo de save é inválida.');
  }
  if (battles.some((battle) => !isRecord(battle.estado))) fail('O estado da batalha no arquivo de save é inválido.');
  if (challenges.some((challenge) => typeof challenge.desafioId !== 'string' || !challenge.desafioId)) fail('Os desafios no arquivo de save são inválidos.');
  if (registeredSpecies.some((entry) => !Number.isInteger(entry.especieId) || entry.especieId < 1 || entry.especieId > 1025)) fail('A Pokédex no arquivo de save é inválida.');
  if (events.some((entry) => typeof entry.tipo !== 'string' || typeof entry.descricao !== 'string')) fail('O histórico no arquivo de save é inválido.');
  if (claimedMissions.some((entry) => !Number.isInteger(entry.periodo) || entry.periodo < 0 || !Number.isInteger(entry.indice) || entry.indice < 0)) fail('As missões resgatadas no arquivo de save são inválidas.');
  if (casinoRound && !isRecord(casinoRound.estado)) fail('A rodada do cassino no arquivo de save é inválida.');
  if (marketStock && (!Number.isInteger(marketStock.periodo) || !isRecord(marketStock.estado))) fail('O estoque no arquivo de save é inválido.');
  return { save, pokemon: pokemonRows, inventory, battles, challenges, registeredSpecies, events, claimedMissions, casinoRound, marketStock };
}

export function createSaveArchiveData(save) {
  const { usuarioId, ...saveData } = save;
  return {
    format: SAVE_ARCHIVE_FORMAT,
    formatVersion: SAVE_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      save: saveData,
      pokemon: save.pokemons,
      inventory: save.inventario,
      battles: save.batalhas,
      challenges: save.desafios,
      registeredSpecies: save.especiesRegistradas,
      events: save.eventos,
      claimedMissions: save.missoesResgatadas,
      casinoRound: save.cassinoRodada,
      marketStock: save.lojaPokemonEstoque,
    },
  };
}

export function createSaveArchiveService(db) {
  async function clearSave(tx, saveId) {
    await tx.batalha.deleteMany({ where: { saveId } });
    await tx.cassinoRodada.deleteMany({ where: { saveId } });
    await tx.lojaPokemonEstoque.deleteMany({ where: { saveId } });
    await tx.missaoResgatada.deleteMany({ where: { saveId } });
    await tx.batalhaEvento.deleteMany({ where: { saveId } });
    await tx.desafioConcluido.deleteMany({ where: { saveId } });
    await tx.especieRegistrada.deleteMany({ where: { saveId } });
    await tx.itemInventario.deleteMany({ where: { saveId } });
    await tx.pokemonCapturado.deleteMany({ where: { saveId } });
  }

  async function restore(tx, saveId, data) {
    const idMap = new Map();
    for (let index = 0; index < data.pokemon.length; index += 1) {
      const row = data.pokemon[index];
      const { id: sourceId, ...pokemon } = row;
      const created = await tx.pokemonCapturado.create({ data: { ...pokemon, saveId } });
      if (sourceId) idMap.set(sourceId, created.id);
    }
    if (data.inventory.length) await tx.itemInventario.createMany({ data: data.inventory.map((row) => ({ ...row, saveId })) });
    if (data.challenges.length) await tx.desafioConcluido.createMany({ data: data.challenges.map((row) => ({ ...row, saveId })) });
    if (data.registeredSpecies.length) await tx.especieRegistrada.createMany({ data: data.registeredSpecies.map((row) => ({ ...row, saveId })) });
    if (data.events.length) await tx.batalhaEvento.createMany({ data: data.events.map((row) => ({ ...row, saveId })) });
    if (data.claimedMissions.length) await tx.missaoResgatada.createMany({ data: data.claimedMissions.map((row) => ({ ...row, saveId })) });
    if (data.battles.length) {
      const battle = data.battles[0];
      await tx.batalha.create({ data: { ...battle, estado: remap(battle.estado, idMap), saveId } });
    }
    if (data.casinoRound) await tx.cassinoRodada.create({ data: { ...data.casinoRound, estado: remap(data.casinoRound.estado, idMap), saveId } });
    if (data.marketStock) await tx.lojaPokemonEstoque.create({ data: { ...data.marketStock, saveId } });
  }

  return {
    async export(saveId) {
      const save = await db.save.findUnique({ where: { id: saveId }, include: {
        pokemons: true, inventario: true, batalhas: true, desafios: true, especiesRegistradas: true,
        eventos: true, missoesResgatadas: true, cassinoRodada: true, lojaPokemonEstoque: true,
      } });
      if (!save) throw new HttpError(404, 'Save não encontrado.');
      return createSaveArchiveData(save);
    },
    async import(archive, replaceSaveId = null) {
      const data = normalizeSaveArchive(archive);
      return db.$transaction(async (tx) => {
        let saveId = replaceSaveId;
        if (saveId) {
          const existing = await tx.save.findUnique({ where: { id: saveId }, select: { id: true } });
          if (!existing) throw new HttpError(404, 'O save que você quer substituir não foi encontrado. Atualize a lista e tente novamente.');
          await clearSave(tx, saveId);
          await tx.save.update({ where: { id: saveId }, data: data.save });
        } else {
          const owner = await tx.usuario.create({
            data: { login: `local_${randomUUID()}`, senhaHash: 'local-save', save: { create: data.save } },
            include: { save: { select: { id: true } } },
          });
          saveId = owner.save.id;
        }
        await restore(tx, saveId, data);
        return tx.save.findUnique({ where: { id: saveId } });
      }, { isolationLevel: 'Serializable', timeout: 30_000 });
    },
  };
}
