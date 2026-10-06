import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { HttpError } from '../lib/errors.js';
import { levelMovesFor, statsFor } from './battleRules.js';
import { naturalMoves } from './moveRules.js';
import { IV_ITEMS, perfectIvs } from './ivRules.js';
import { STATUS_CURE_ITEMS } from './itemRules.js';
import { CAPTURE_BALL_ITEMS, rollPokemonSex } from './captureBalls.js';

let cached;
export function getCatalogo() {
  if (!cached) {
    try {
      cached = JSON.parse(readFileSync(new URL('../../data/catalogo.json', import.meta.url), 'utf8'));
      const extraItems = [...IV_ITEMS, ...STATUS_CURE_ITEMS, ...CAPTURE_BALL_ITEMS.map((ball, index) => ({ id: 2400 + index, nome: ball.id, nomeExibicao: ball.name, categoria: 'captura', descricao: ball.description, precoReferencia: null, sprite: `/assets/items/${ball.id}.png`, precoLoja: ball.price }))];
      const itemsByName = new Map(cached.itens.map((item) => [item.nome, item]));
      for (const item of extraItems) itemsByName.set(item.nome, item);
      cached.itens = [...itemsByName.values()];
    }
    catch { throw new HttpError(503, 'Catalogo indisponivel. Execute npm run catalog:import no backend.'); }
  }
  return cached;
}

export function getEspecie(id) {
  const especie = getCatalogo().pokemon.find((entry) => entry.id === Number(id));
  if (!especie) throw new HttpError(404, 'Pokemon nao encontrado.');
  return especie;
}

export function resumoEspecie(especie) {
  const { id, nome, nomeExibicao, tipos, atributosBase, sprites, formasMega, formasPrimal, formasGmax, formasFusao, altura, peso, experienciaPorNivel } = especie;
  return { id, nome, nomeExibicao, tipos, atributosBase, sprites, formasMega, formasPrimal, formasGmax, formasFusao, altura, peso, experienciaPorNivel };
}

export function getDetalhesEspecie(id) {
  const especie = getEspecie(id);
  const moves = new Map(getCatalogo().golpes.map((move) => [move.nome, move]));
  return {
    ...especie,
    golpesAprendidos: especie.golpesAprendidos.map((learned) => {
      const { tipo, categoria, poder, precisao, pp, prioridade, meta, efeitoId } = moves.get(learned.golpe);
      return { ...learned, tipo, categoria, poder, precisao, pp, prioridade, meta, efeitoId };
    }),
  };
}

export function criarDadosInicial(especieId) {
  const especie = getEspecie(especieId);
  const nivel = 5;
  const ivs = perfectIvs();
  const atributos = statsFor(especie, nivel, false, ivs);
  const golpes = levelMovesFor(especie, nivel).map((move) => ({ nome: move.nome }));
  return {
    especieId, nivel, experiencia: especie.experienciaPorNivel.find((entry) => entry.nivel === nivel).experiencia,
    hpAtual: atributos.hp, atributos, ivs, golpes, sexo: rollPokemonSex(especie, randomInt), amizade: especie.felicidadeBase ?? 70, golpesDesbloqueados: naturalMoves(especie, nivel),
  };
}
