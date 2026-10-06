import { randomInt, randomUUID } from 'node:crypto';
import { HttpError } from '../lib/errors.js';
import { getCatalogo, getEspecie } from './catalogo.js';
import { ivQuality, rollIvs } from './ivRules.js';
import { REGIONS, legendaryUnlocked, regionUnlocked, shinyRolls, statsFor } from './battleRules.js';
import { generationForSpecies } from './itemRules.js';
import { levelMovesFor } from './battleRules.js';
import { naturalMoves } from './moveRules.js';

const ballPrices = { 'poke-ball': 200, 'great-ball': 600, 'ultra-ball': 1200 };
const SHOP_REFRESH_MS = 60 * 60 * 1000;
const SHOP_SIZE = 12;
const SHOP_SHINY_DENOMINATOR = 4086;
const SHOP_REFRESH_PRICE = 3_000;

function rollShopShiny(rng, rolls) {
  for (let attempt = 0; attempt < rolls; attempt++) if (rng(SHOP_SHINY_DENOMINATOR) === 0) return true;
  return false;
}

export function pokemonSaleValue(member) {
  const species = getEspecie(member.especieId);
  const ball = member.bolaCaptura ?? 'poke-ball';
  const ballValue = ball === 'master-ball' ? member.nivel * 20 : (ballPrices[ball] ?? ballPrices['poke-ball']) / 2 + member.nivel * 10;
  const investments = Math.max(0, member.investimentoItens ?? 0);
  const legendaryMultiplier = species.lendario || species.mitico ? 3 : 1;
  const shinyMultiplier = member.shiny ? 10 : 1;
  return Math.floor((ballValue + investments) * legendaryMultiplier * shinyMultiplier * ivQuality(member.ivs).valueMultiplier);
}

export function createMarketService(db, { rng = randomInt, now = Date.now } = {}) {
  function makeStock(completed, hasCharm, period, size = SHOP_SIZE, excludedSpecies = []) {
    const catalog = getCatalogo();
    const excluded = new Set(excludedSpecies);
    const available = catalog.pokemon.filter(species => !excluded.has(species.id) && legendaryUnlocked(species, completed));
    const list = [];
    while (list.length < size && available.length) {
      const species = available.splice(rng(available.length), 1)[0];
      const generation = generationForSpecies(species.id);
      const region = REGIONS.find(entry => entry.geracao === generation && species.id >= entry.minSpecies && species.id <= entry.maxSpecies);
      const unlocked = region ? regionUnlocked(region.id, completed) : false;
      const shiny = rollShopShiny(rng, shinyRolls(completed, generation, hasCharm));
      let ivs;
      do { ivs = rollIvs(rng); } while (ivQuality(ivs).stars < 2);
      const stars = ivQuality(ivs).stars;
      let price = 10_000 * (unlocked ? 1 : 2) * (shiny ? 5 : 1) * (stars === 4 ? 2 : stars === 3 ? 1.5 : 1);
      price = Math.floor(price);
      const level = 1;
      const atributos = statsFor(species, level, shiny, ivs);
      list.push({ id: randomUUID(), especieId: species.id, nome: species.nomeExibicao, geracao: generation, geracaoDesbloqueada: unlocked, nivel: level, shiny, ivs, estrelas: stars, preco: price, disponivel: true, experiencia: species.experienciaPorNivel.find(entry => entry.nivel === level)?.experiencia ?? 0, hpAtual: atributos.hp, atributos, golpes: levelMovesFor(species, level).map(move => ({ nome: move.nome })), golpesDesbloqueados: naturalMoves(species, level) });
    }
    return { periodo: period, pokemons: list };
  }

  async function stockFor(tx, save) {
    const period = Math.floor(now() / SHOP_REFRESH_MS);
    const challenges = await tx.desafioConcluido.findMany({ where: { saveId: save.id }, select: { desafioId: true } });
    const completed = challenges.map(entry => entry.desafioId);
    const charm = await tx.itemInventario.findUnique({ where: { saveId_itemId: { saveId: save.id, itemId: 'shiny-charm' } }, select: { quantidade: true } });
    let record = await tx.lojaPokemonEstoque.findUnique({ where: { saveId: save.id } });
    if (!record || record.periodo !== period) {
      const favorites = (record?.estado?.pokemons ?? []).filter(entry => entry.favorito && entry.disponivel);
      const replenished = makeStock(completed, charm?.quantidade > 0, period, Math.max(0, SHOP_SIZE - favorites.length), favorites.map(entry => entry.especieId));
      const estado = { pokemons: [...favorites, ...replenished.pokemons] };
      record = await tx.lojaPokemonEstoque.upsert({ where: { saveId: save.id }, create: { saveId: save.id, periodo: period, estado }, update: { periodo: period, estado } });
    } else if (record.estado.pokemons.length < SHOP_SIZE) {
      const existing = record.estado.pokemons;
      const missing = SHOP_SIZE - existing.length;
      const extra = makeStock(completed, charm?.quantidade > 0, period, missing, existing.map(entry => entry.especieId));
      const estado = { ...record.estado, pokemons: [...existing, ...extra.pokemons] };
      record = await tx.lojaPokemonEstoque.update({ where: { saveId: save.id }, data: { estado } });
    }
    return { record, completed, hasCharm: charm?.quantidade > 0, renovaEm: new Date((period + 1) * SHOP_REFRESH_MS).toISOString(), restanteMs: (period + 1) * SHOP_REFRESH_MS - now() };
  }

  return {
    async pokemon(usuarioId) {
      return db.$transaction(async tx => {
        const save = await tx.save.findUnique({ where: { usuarioId } });
        if (!save?.inicialEspecieId) throw new HttpError(409, 'Inicie sua jornada antes de usar o Mercado Pokémon.');
        const { record, renovaEm, restanteMs } = await stockFor(tx, save);
        return { moedas: save.moedas, pokemons: record.estado.pokemons.map(({ golpes, golpesDesbloqueados, experiencia, atributos, hpAtual, ...entry }) => entry), renovaEm, restanteMs };
      }, { isolationLevel: 'Serializable' });
    },
    async buyPokemon(usuarioId, stockId) {
      return db.$transaction(async tx => {
        const save = await tx.save.findUnique({ where: { usuarioId } });
        if (!save?.inicialEspecieId) throw new HttpError(409, 'Inicie sua jornada antes de usar o Mercado Pokémon.');
        const { record } = await stockFor(tx, save);
        const pokemon = record.estado.pokemons.find(entry => entry.id === stockId);
        if (!pokemon) throw new HttpError(404, 'Este Pokémon não está mais no estoque. Atualize o mercado.');
        if (!pokemon.disponivel) throw new HttpError(409, 'Este Pokémon já foi comprado.');
        if (save.moedas < pokemon.preco) throw new HttpError(409, 'Pokédólares insuficientes.');
        const estado = structuredClone(record.estado);
        const item = estado.pokemons.find(entry => entry.id === stockId);
        item.disponivel = false;
        item.favorito = false;
        const charged = await tx.save.updateMany({ where: { id: save.id, moedas: { gte: pokemon.preco } }, data: { moedas: { decrement: pokemon.preco } } });
        if (charged.count !== 1) throw new HttpError(409, 'Pokédólares insuficientes.');
        await tx.lojaPokemonEstoque.update({ where: { saveId: save.id }, data: { estado } });
        const { golpes, golpesDesbloqueados, experiencia, atributos, hpAtual } = pokemon;
        const owned = await tx.pokemonCapturado.create({ data: { saveId: save.id, especieId: pokemon.especieId, nivel: pokemon.nivel, experiencia, hpAtual, shiny: pokemon.shiny, bolaCaptura: 'poke-ball', ivs: pokemon.ivs, atributos, golpes, golpesDesbloqueados } });
        return { pokemon: owned, preco: pokemon.preco, moedas: save.moedas - pokemon.preco };
      }, { isolationLevel: 'Serializable', timeout: 20_000 });
    },
    async refreshPokemon(usuarioId) {
      return db.$transaction(async tx => {
        const save = await tx.save.findUnique({ where: { usuarioId } });
        if (!save?.inicialEspecieId) throw new HttpError(409, 'Inicie sua jornada antes de usar o Mercado Pokémon.');
        const { record, completed, hasCharm } = await stockFor(tx, save);
        const charged = await tx.save.updateMany({ where: { id: save.id, moedas: { gte: SHOP_REFRESH_PRICE } }, data: { moedas: { decrement: SHOP_REFRESH_PRICE } } });
        if (charged.count !== 1) throw new HttpError(409, 'São necessários 3.000 Pokédólares para atualizar o estoque.');
        const favorites = record.estado.pokemons.filter(entry => entry.favorito && entry.disponivel);
        const replenished = makeStock(completed, hasCharm, record.periodo, Math.max(0, SHOP_SIZE - favorites.length), favorites.map(entry => entry.especieId));
        const estado = { pokemons: [...favorites, ...replenished.pokemons] };
        await tx.lojaPokemonEstoque.update({ where: { saveId: save.id }, data: { estado } });
        return { moedas: save.moedas - SHOP_REFRESH_PRICE, pokemons: estado.pokemons.map(({ golpes, golpesDesbloqueados, experiencia, atributos, hpAtual, ...entry }) => entry), custo: SHOP_REFRESH_PRICE };
      }, { isolationLevel: 'Serializable', timeout: 20_000 });
    },
    async favoritePokemon(usuarioId, stockId, favorito) {
      return db.$transaction(async tx => {
        const save = await tx.save.findUnique({ where: { usuarioId } });
        if (!save?.inicialEspecieId) throw new HttpError(409, 'Inicie sua jornada antes de usar o Mercado Pokémon.');
        const { record } = await stockFor(tx, save);
        const estado = structuredClone(record.estado);
        const pokemon = estado.pokemons.find(entry => entry.id === stockId);
        if (!pokemon) throw new HttpError(404, 'Este Pokémon não está mais no estoque. Atualize o mercado.');
        if (!pokemon.disponivel) throw new HttpError(409, 'Um Pokémon comprado não pode ser fixado no estoque.');
        pokemon.favorito = favorito;
        await tx.lojaPokemonEstoque.update({ where: { saveId: save.id }, data: { estado } });
        return { favorito, pokemonId: stockId };
      }, { isolationLevel: 'Serializable', timeout: 20_000 });
    },
    async values(usuarioId) {
      const members = await db.pokemonCapturado.findMany({ where: { save: { usuarioId } } });
      return members.map((member) => ({ pokemonId: member.id, valor: pokemonSaleValue(member), bolaCaptura: member.bolaCaptura ?? 'poke-ball', investimentoItens: member.investimentoItens }));
    },
    async sell(usuarioId, pokemonIds) {
      return db.$transaction(async (tx) => {
        const save = await tx.save.findUnique({ where: { usuarioId }, select: { id: true } });
        if (!save) throw new HttpError(404, 'Save não encontrado.');
        const [members, total, battle] = await Promise.all([
          tx.pokemonCapturado.findMany({ where: { saveId: save.id, id: { in: pokemonIds } } }),
          tx.pokemonCapturado.count({ where: { saveId: save.id } }),
          tx.batalha.findUnique({ where: { saveId: save.id }, select: { id: true } }),
        ]);
        if (members.length !== pokemonIds.length) throw new HttpError(404, 'Um ou mais Pokémon não pertencem à sua coleção.');
        if (members.some((member) => member.favorito)) throw new HttpError(409, 'Remova a marca de favorito antes de vender este Pokémon.');
        if (total <= members.length) throw new HttpError(409, 'Mantenha pelo menos um Pokémon na coleção.');
        if (battle) throw new HttpError(409, 'Encerre a batalha atual antes de vender Pokémon.');
        const moedasGanhas = members.reduce((sum, member) => sum + pokemonSaleValue(member), 0);
        await tx.pokemonCapturado.deleteMany({ where: { saveId: save.id, id: { in: pokemonIds } } });
        const updated = await tx.save.update({ where: { id: save.id }, data: { moedas: { increment: moedasGanhas } } });
        return { vendidos: members.length, moedasGanhas, moedas: updated.moedas };
      }, { isolationLevel: 'Serializable', timeout: 20_000 });
    },
  };
}
