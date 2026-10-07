import { HttpError } from '../lib/errors.js';
import { criarDadosInicial } from './catalogo.js';
import { randomUUID } from 'node:crypto';

export function createJogadorService(db) {
  return {
    listSaves() {
      return db.save.findMany({ orderBy: { atualizadoEm: 'desc' } });
    },
    async createSave({ nomeTreinador }) {
      const localOwner = await db.usuario.create({
        data: {
          login: `local_${randomUUID()}`,
          senhaHash: 'local-save',
          save: { create: { nomeTreinador, iniciadoEm: new Date() } },
        },
        include: { save: true },
      });
      return localOwner.save;
    },
    async deleteSave(saveId) {
      const save = await db.save.findUnique({ where: { id: saveId }, select: { usuarioId: true } });
      if (!save) throw new HttpError(404, 'Save não encontrado.');
      await db.usuario.delete({ where: { id: save.usuarioId } });
      return { id: saveId };
    },
    async getSave(usuarioId) {
      const save = await db.save.findUnique({ where: { usuarioId } });
      return save;
    },
    async escolherInicial(usuarioId, { saveId, especieId }) {
      if (![1, 4, 7].includes(especieId)) throw new HttpError(400, 'Escolha Bulbasaur, Charmander ou Squirtle como inicial.');
      const pokemon = criarDadosInicial(especieId);
      return db.$transaction(async (tx) => {
        // A atualizacao condicional bloqueia escolhas duplicadas e pedidos de saves antigos.
        const claimed = await tx.save.updateMany({
          where: { id: saveId, usuarioId, iniciadoEm: { not: null }, inicialEspecieId: null },
          data: { inicialEspecieId: especieId, kitEntregue: true },
        });
        if (claimed.count !== 1) throw new HttpError(409, 'Inicial ja escolhido ou save alterado. Carregue seu save novamente.');
        await tx.pokemonCapturado.create({ data: { ...pokemon, saveId } });
        for (const [itemId, quantidade] of [['poke-ball', 10], ['potion', 5]]) await tx.itemInventario.create({ data: { saveId, itemId, quantidade } });
        await tx.especieRegistrada.upsert({ where: { saveId_especieId: { saveId, especieId } }, create: { saveId, especieId }, update: {} });
        return tx.save.findUnique({ where: { id: saveId } });
      }, { isolationLevel: 'Serializable', timeout: 15_000 });
    },
    updateSave(usuarioId, data) {
      return db.save.update({ where: { usuarioId }, data: { nomeTreinador: data.nomeTreinador } });
    },
    getTime(usuarioId) {
      return db.pokemonCapturado.findMany({
        where: { save: { usuarioId } }, orderBy: [{ especieId: 'asc' }, { capturadoEm: 'asc' }],
      });
    },
    getPc(usuarioId) {
      return db.pokemonCapturado.findMany({
        where: { save: { usuarioId }, posicaoTime: null }, orderBy: { capturadoEm: 'asc' },
      });
    },
    getColecao(usuarioId) {
      return db.pokemonCapturado.findMany({
        where: { save: { usuarioId } }, orderBy: [{ especieId: 'asc' }, { capturadoEm: 'asc' }],
      });
    },
    async setFavorito(usuarioId, pokemonId, favorito) {
      const updated = await db.pokemonCapturado.updateMany({
        where: { id: pokemonId, save: { usuarioId } }, data: { favorito },
      });
      if (updated.count !== 1) throw new HttpError(404, 'Pokémon não encontrado na sua coleção.');
      return db.pokemonCapturado.findUnique({ where: { id: pokemonId } });
    },
    async renamePokemon(usuarioId, pokemonId, apelido) {
      const updated = await db.pokemonCapturado.updateMany({ where: { id: pokemonId, save: { usuarioId } }, data: { apelido: apelido?.trim() || null } });
      if (updated.count !== 1) throw new HttpError(404, 'Pokémon não encontrado na sua coleção.');
      return db.pokemonCapturado.findUnique({ where: { id: pokemonId } });
    },
    async getTeams(usuarioId) {
      const save = await db.save.findUnique({ where: { usuarioId }, select: { equipes: true } });
      try { return JSON.parse(save?.equipes ?? '[]'); } catch { return []; }
    },
    async setTeams(usuarioId, teams) {
      return db.$transaction(async tx => {
        const save = await tx.save.findUnique({ where: { usuarioId }, select: { id: true } });
        if (!save) throw new HttpError(404, 'Save não encontrado.');
        const ids = [...new Set(teams.flatMap(team => team.pokemonIds))];
        const owned = await tx.pokemonCapturado.findMany({ where: { saveId: save.id, id: { in: ids } }, select: { id: true } });
        if (owned.length !== ids.length) throw new HttpError(400, 'Uma equipe contém Pokémon que não pertencem a este save.');
        const normalized = teams.map(team => ({ nome: team.nome.trim(), pokemonIds: team.pokemonIds }));
        await tx.save.update({ where: { id: save.id }, data: { equipes: JSON.stringify(normalized) } });
        return normalized;
      }, { isolationLevel: 'Serializable' });
    },
    getInventario(usuarioId) {
      return db.itemInventario.findMany({ where: { save: { usuarioId }, itemId: { notIn: ['ether', 'elixir'] } }, orderBy: { itemId: 'asc' } });
    },
    async getDex(usuarioId) {
      const save = await db.save.findUnique({ where: { usuarioId }, select: { id: true } });
      if (!save) return [];
      const [registered, owned] = await Promise.all([
        db.especieRegistrada.findMany({ where: { saveId: save.id }, select: { especieId: true } }),
        db.pokemonCapturado.findMany({ where: { saveId: save.id }, select: { especieId: true } }),
      ]);
      return [...new Set([...registered, ...owned].map((entry) => entry.especieId))];
    },
  };
}
