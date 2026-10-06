import { readFileSync } from 'node:fs';
import { HttpError } from '../lib/errors.js';
import { levelMovesFor, statsFor } from './battleRules.js';
import { naturalMoves } from './moveRules.js';
import { IV_ITEMS, perfectIvs } from './ivRules.js';
import { STATUS_CURE_ITEMS } from './itemRules.js';

let cached;
export function getCatalogo() {
  if (!cached) {
    try { cached = JSON.parse(readFileSync(new URL('../../data/catalogo.json', import.meta.url), 'utf8')); cached.itens.push(...IV_ITEMS, ...STATUS_CURE_ITEMS); }
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
    hpAtual: atributos.hp, atributos, ivs, golpes, golpesDesbloqueados: naturalMoves(especie, nivel),
  };
}
