import { normalizeIvs } from './ivRules.js';
import { randomInt } from 'node:crypto';
import { HttpError } from '../lib/errors.js';
import { getCatalogo, getEspecie } from './catalogo.js';
import { REGIONS, GYMS, regionUnlocked, legendaryUnlocked, catchCharmMultiplier, challengesWithStatus, charmMilestones, completedGenerationsAfterFirst, luckyEggMultiplier, amuletCoinMultiplier, damage, drainPercentForMove, effectiveness, formFor, healAtTurnEnd, healByDrain, healByMove, healByStrengthSap, leechSeedTurn, levelMovesFor, makeCombatant, rollShiny, rollWild, rollTrainer, shinyRolls, statsFor, wildLevelCap, wildLevelSettings } from './battleRules.js';
import { generationForSpecies, HEALING_ITEMS, healCombatant } from './itemRules.js';
import { equippedMoves, naturalMoves, unlockedMoves } from './moveRules.js';
import { TOURNAMENTS, rollTournament } from './tournaments.js';
import { CAPTURE_BALL_IDS, baseFriendship, captureBallMultiplier, happinessGain } from './captureBalls.js';

const BASE_CAPTURE_MULTIPLIER = { 'poke-ball': 1, 'great-ball': 1.5, 'ultra-ball': 2, 'master-ball': Infinity };
const AUTO_SEARCH_COST = 25;
function displayName(name) { return name.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function createBattleService(db) {
  const catalogMoves = new Map(getCatalogo().golpes.map(move => [move.nome, move]));
  function battleMove(move) {
    const source = catalogMoves.get(move.nome) ?? {};
    return { ...move, alvo: source.alvo, chanceEfeito: source.chanceEfeito, meta: source.meta, alteracoesAtributos: source.alteracoesAtributos ?? [] };
  }
  function wildRange(completed, regionId, requested) {
    const settings = wildLevelSettings(completed, regionId);
    if (!settings) throw new HttpError(403, 'Região ainda bloqueada.');
    const range = requested ?? { minimo: 2, maximo: settings.maximo };
    if (!Number.isInteger(range.minimo) || !Number.isInteger(range.maximo) || range.minimo < settings.minimo || range.minimo > range.maximo || range.maximo > settings.maximo) {
      throw new HttpError(403, `O intervalo disponível em ${settings.nome} é de ${settings.minimo} a ${settings.maximo}. Conclua os desafios desta região para liberar níveis maiores.`);
    }
    return { intervaloNivel: { minimo: range.minimo, maximo: range.maximo }, regiaoNiveis: settings.regiao };
  }
  async function movesFor(tx, speciesId, level) {
    const names = levelMovesFor(getEspecie(speciesId), level).map((move) => move.nome);
    const moves = names.map(name => catalogMoves.get(name)).filter(Boolean);
    if (moves.length !== names.length) throw new HttpError(503, 'Um ou mais golpes não estão definidos no catálogo local.');
    return moves.map(battleMove);
  }
  async function playerMovesFor(_tx, member) {
    const names = equippedMoves(member, getEspecie(member.especieId));
    return names.map(name => catalogMoves.get(name)).filter(Boolean).map(battleMove);
  }
  async function progress(tx, saveId) {
    return (await tx.desafioConcluido.findMany({ where: { saveId }, select: { desafioId: true } })).map((entry) => entry.desafioId);
  }
  function log(state, message) { state.logs = [...state.logs.slice(-24), message]; }
  function battleSpeed(combatant) {
    const stage = Math.max(-6, Math.min(6, combatant.statStages?.speed ?? 0));
    const multiplier = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
    return combatant.stats.speed * multiplier * (combatant.status === 'paralysis' ? .5 : 1);
  }
  function normalizeBattleState(state) {
    state.weather ??= null;
    state.weatherTurns ??= 0;
    state.grassyTerrainTurns ??= 0;
    for (const combatant of [state.jogador, state.oponente, ...(state.reservas ?? []), ...(state.fila ?? [])]) {
      if (!combatant) continue;
      combatant.statStages ??= {};
      combatant.status ??= null;
      combatant.statusTurns ??= 0;
      combatant.confusionTurns ??= 0;
      combatant.protegido ??= false;
    }
    return state;
  }
  const CURE_MOVES = new Set(['aromatherapy', 'heal-bell', 'jungle-healing', 'purify']);
  const PROTECT_MOVES = new Set(['protect', 'detect', 'king-s-shield', 'spiky-shield', 'baneful-bunker']);
  function statusCureMove(move) { return CURE_MOVES.has(move.nome); }
  function cureWithMove(combatant, move) { if (statusCureMove(move)) combatant.status = null; }
  function applyRecoveryMove(state, user, target, move) {
    if (move.nome === 'rest') {
      const recovered = user.maxHp - user.hp;
      user.hp = user.maxHp;
      user.status = 'sleep'; user.statusTurns = 2; user.toxic = false; user.toxicTurns = 0;
      return { healed: recovered, text: 'curou suas condições e adormeceu por 2 turnos' };
    }
    if (move.nome === 'wish') {
      state.wish = { lado: user === state.jogador ? 'jogador' : 'oponente', turnos: 2, quantidade: Math.ceil(user.maxHp / 2) };
      return { healed: 0, text: 'fez um pedido de cura para o próximo turno' };
    }
    if (move.nome === 'pain-split') {
      const shared = Math.floor((user.hp + target.hp) / 2);
      const before = user.hp;
      user.hp = Math.min(user.maxHp, shared);
      target.hp = Math.min(target.maxHp, shared);
      return { healed: user.hp - before, text: 'dividiu os HP atuais entre os dois Pokémon' };
    }
    if (move.nome === 'strength-sap') return { healed: healByStrengthSap(user, target), text: `drenou o Ataque de ${target.nome}` };
    if (move.nome === 'stockpile') {
      user.stockpile = Math.min(3, (user.stockpile ?? 0) + 1);
      for (const stat of ['defense', 'special-defense']) user.statStages[stat] = Math.min(6, (user.statStages[stat] ?? 0) + 1);
      return { healed: 0, text: `acumulou energia (${user.stockpile}/3)` };
    }
    if (move.nome === 'swallow') {
      const stored = user.stockpile ?? 0;
      const healed = stored ? healByMove(user, move, { weather: state.weather, stockpile: stored }) : 0;
      user.stockpile = 0;
      for (const stat of ['defense', 'special-defense']) user.statStages[stat] = Math.max(-6, (user.statStages[stat] ?? 0) - stored);
      return { healed, text: stored ? `consumiu ${stored} acúmulo(s)` : 'falhou por não ter energia acumulada' };
    }
    if (move.nome === 'aqua-ring') { user.aquaRing = true; return { healed: 0, text: 'ficou envolto por um anel de água' }; }
    if (move.nome === 'roost' && user.tipos.includes('flying')) {
      user.roostedTypes ??= [...user.tipos];
      user.tipos = user.tipos.filter(type => type !== 'flying'); user.roosted = true;
      return { healed: 0, text: 'perdeu o tipo Voador até o fim do turno' };
    }
    if (['sunny-day', 'rain-dance', 'sandstorm', 'hail', 'snowscape'].includes(move.nome)) {
      state.weather = move.nome; state.weatherTurns = 5;
      return { healed: 0, text: `o clima mudou para ${displayName(move.nome)}` };
    }
    if (move.nome === 'grassy-terrain') { state.grassyTerrainTurns = 5; return { healed: 0, text: 'o campo ficou coberto por Grassy Terrain' }; }
    return { healed: 0, text: '' };
  }
  function applyStatChanges(target, move, chance = null) {
    const changes = move.alteracoesAtributos ?? [];
    if (!changes.length) return '';
    const odds = chance ?? (move.categoria === 'status' ? 100 : 0);
    if (odds < 100 && randomInt(100) >= odds) return '';
    const applied = [];
    for (const { atributo, mudanca } of changes) {
      if (!['attack', 'defense', 'special-attack', 'special-defense', 'speed', 'accuracy', 'evasion'].includes(atributo)) continue;
      const old = target.statStages[atributo] ?? 0;
      const next = Math.max(-6, Math.min(6, old + mudanca));
      if (next === old) continue;
      target.statStages[atributo] = next;
      const label = { attack: 'Ataque', defense: 'Defesa', 'special-attack': 'Ataque especial', 'special-defense': 'Defesa especial', speed: 'Velocidade', accuracy: 'Precisão', evasion: 'Esquiva' }[atributo];
      applied.push(`${label} ${next > old ? 'subiu' : 'caiu'}`);
    }
    return applied.join(' e ');
  }
  function applyMoveAilment(state, attacker, target, move) {
    const ailment = move.meta?.ailment?.name;
    if (!ailment || ailment === 'none') return '';
    const odds = move.meta?.ailment_chance > 0 ? move.meta.ailment_chance : move.categoria === 'status' ? 100 : move.chanceEfeito ?? 0;
    if (odds < 100 && randomInt(100) >= odds) return '';
    if (ailment === 'confusion') {
      if (target.confusionTurns > 0) return '';
      target.confusionTurns = 1 + randomInt(4);
      return `${target.nome} ficou confuso`;
    }
    if (ailment === 'yawn') { target.yawnTurns = 1; return `${target.nome} ficou sonolento`; }
    if (ailment === 'leech-seed') { target.leechSeededBy = attacker === state.jogador ? 'jogador' : 'oponente'; return `${target.nome} foi semeado`; }
    if (ailment === 'nightmare') { if (target.status !== 'sleep') return ''; target.nightmare = true; return `${target.nome} está preso em um pesadelo`; }
    if (ailment === 'disable') { target.disabledMove = target.lastMoveName ?? target.ataques.at(-1)?.nome; target.disableTurns = 4; return `${target.nome} teve um golpe bloqueado`; }
    if (ailment === 'protect') { attacker.protegido = true; return `${attacker.nome} se protegeu`; }
    if (ailment === 'perish-song') { target.perishTurns = 3; return `${target.nome} ouviu o Canto Mortal`; }
    if (ailment === 'infatuation') { target.infatuated = true; return `${target.nome} ficou apaixonado`; }
    if (ailment === 'torment') { target.tormented = true; return `${target.nome} foi atormentado`; }
    if (ailment === 'ingrain') { attacker.ingrained = true; return `${attacker.nome} criou raízes`; }
    if (ailment === 'no-type-immunity') { target.noTypeImmunity = true; return `${target.nome} ficou exposto`; }
    if (ailment === 'embargo') { target.embargoed = true; return `${target.nome} não pode usar itens`; }
    if (ailment === 'heal-block') { target.healBlocked = true; return `${target.nome} não pode se curar`; }
    if (ailment === 'tar-shot') { target.tarShot = true; return `${target.nome} foi coberto de piche`; }
    const status = ailment;
    if (target.status) return '';
    const immunities = {
      burn: target.tipos.includes('fire'),
      poison: target.tipos.some(type => ['poison', 'steel'].includes(type)),
      paralysis: target.tipos.includes('electric'),
      freeze: target.tipos.includes('ice'),
    };
    if (immunities[status]) return '';
    target.status = status;
    target.statusTurns = status === 'sleep' ? 1 + randomInt(3) : 0;
    if (move.nome === 'toxic') target.toxic = true;
    return `${target.nome} recebeu ${({ burn: 'queimadura', poison: 'envenenamento', paralysis: 'paralisia', sleep: 'sono', freeze: 'congelamento' })[status] ?? status}`;
  }
  function canAct(state, combatant, move) {
    if (combatant.disabledMove === move.nome && combatant.disableTurns > 0) { log(state, `${combatant.nome} não pode usar ${displayName(move.nome)}.`); return false; }
    if (combatant.tormented && combatant.lastMoveName === move.nome) { log(state, `${combatant.nome} não pode repetir esse golpe por causa do tormento.`); return false; }
    if (combatant.healBlocked && (move.meta?.healing ?? 0) > 0) { log(state, `${combatant.nome} está impedido de se curar.`); return false; }
    if (combatant.infatuated && randomInt(2) === 0) { log(state, `${combatant.nome} está apaixonado e não conseguiu agir.`); return false; }
    if (combatant.status === 'sleep') {
      combatant.statusTurns -= 1;
      if (combatant.statusTurns <= 0) { combatant.status = null; log(state, `${combatant.nome} acordou, mas perdeu este turno.`); }
      else log(state, `${combatant.nome} está dormindo e não pode agir.`);
      return false;
    }
    if (combatant.status === 'freeze') {
      if (randomInt(100) < 20) { combatant.status = null; log(state, `${combatant.nome} descongelou.`); }
      else { log(state, `${combatant.nome} está congelado e não pode agir.`); return false; }
    }
    if (combatant.status === 'paralysis' && randomInt(100) < 25) { log(state, `${combatant.nome} está paralisado e não conseguiu agir.`); return false; }
    if (combatant.confusionTurns > 0) {
      combatant.confusionTurns -= 1;
      if (randomInt(3) === 0) {
        const damage = Math.max(1, Math.floor(combatant.maxHp / 8));
        combatant.hp = Math.max(0, combatant.hp - damage);
        log(state, `${combatant.nome} se confundiu e causou ${damage} de dano em si mesmo.`);
        return false;
      }
      if (!combatant.confusionTurns) log(state, `${combatant.nome} saiu da confusão.`);
    }
    return true;
  }
  function endTurn(state) {
    const grassyTerrain = state.grassyTerrainTurns > 0;
    for (const combatant of [state.jogador, state.oponente]) {
      if (!combatant || combatant.hp <= 0) continue;
      if (combatant.status === 'poison' || combatant.status === 'burn') {
        combatant.toxicTurns = combatant.status === 'poison' && combatant.toxicTurns ? combatant.toxicTurns + 1 : combatant.toxic ? 1 : 0;
        const amount = Math.max(1, Math.floor(combatant.maxHp * (combatant.status === 'burn' ? 1 / 16 : combatant.toxic ? combatant.toxicTurns / 16 : 1 / 8)));
        combatant.hp = Math.max(0, combatant.hp - amount);
        log(state, `${combatant.nome} perdeu ${amount} HP por ${combatant.status === 'poison' ? 'envenenamento' : 'queimadura'}.`);
      }
      if (combatant.yawnTurns > 0 && --combatant.yawnTurns === 0 && !combatant.status) { combatant.status = 'sleep'; combatant.statusTurns = 1 + randomInt(3); log(state, `${combatant.nome} adormeceu.`); }
      if (combatant.perishTurns > 0 && --combatant.perishTurns === 0) { combatant.hp = 0; log(state, `${combatant.nome} desmaiou após o Canto Mortal.`); }
      if (combatant.leechSeededBy) {
        const recipient = combatant.leechSeededBy === 'jogador' ? state.jogador : state.oponente;
        const { damage, healed } = leechSeedTurn(combatant, recipient);
        log(state, `${combatant.nome} perdeu ${damage} HP para as sementes${healed ? `; ${recipient.nome} recuperou ${healed} HP` : ''}.`);
      }
      for (const { source, healed } of healAtTurnEnd(combatant, { aquaRing: combatant.aquaRing, ingrained: combatant.ingrained, grassyTerrain }))
        log(state, `${combatant.nome} recuperou ${healed} HP com ${displayName(source)}.`);
      if (combatant.status === 'sleep' && combatant.nightmare) { const amount = Math.max(1, Math.floor(combatant.maxHp / 4)); combatant.hp = Math.max(0, combatant.hp - amount); log(state, `${combatant.nome} perdeu ${amount} HP no pesadelo.`); }
      if (combatant.disableTurns > 0 && --combatant.disableTurns === 0) combatant.disabledMove = null;
      if (combatant.perishTurns) log(state, `Canto Mortal: ${combatant.nome} desmaiará em ${combatant.perishTurns} turno(s).`);
      combatant.protegido = false;
      if (combatant.roosted) {
        combatant.tipos = combatant.roostedTypes; combatant.roostedTypes = null; combatant.roosted = false;
      }
    }
    if (state.wish) {
      state.wish.turnos -= 1;
      if (state.wish.turnos <= 0) {
        const target = state.wish.lado === 'jogador' ? state.jogador : state.oponente;
        const healed = target?.hp > 0 ? Math.min(state.wish.quantidade, target.maxHp - target.hp) : 0;
        if (healed) target.hp += healed;
        if (target) log(state, healed ? `${target.nome} recuperou ${healed} HP com Wish.` : 'Wish não encontrou um Pokémon ativo para curar.');
        state.wish = null;
      }
    }
    if (state.weatherTurns > 0 && --state.weatherTurns === 0) state.weather = null;
    if (state.grassyTerrainTurns > 0) state.grassyTerrainTurns -= 1;
  }
  function attack(state, attacker, defender, move) {
    if (!canAct(state, attacker, move)) return;
    attacker.lastMoveName = move.nome;
    if (attacker !== defender && defender.protegido) { log(state, `${defender.nome} bloqueou ${displayName(move.nome)}.`); return; }
    if (move.categoria === 'status') {
      const hitChance = Math.max(1, Math.min(100, move.precisao ?? 100));
      if (move.precisao != null && randomInt(100) >= hitChance) { log(state, `${attacker.nome} usou ${displayName(move.nome)}, mas errou.`); return; }
      const target = move.alvo?.startsWith('user') || move.nome === 'heal-pulse' ? attacker : defender;
      const special = applyRecoveryMove(state, attacker, target, move);
      const healed = special.healed || healByMove(attacker, move, { weather: state.weather, stockpile: attacker.stockpile });
      const stages = move.nome === 'stockpile' ? '' : applyStatChanges(target, move);
      const ailment = applyMoveAilment(state, attacker, target, move);
      cureWithMove(attacker, move);
      if (PROTECT_MOVES.has(move.nome)) attacker.protegido = true;
      const effects = [healed ? `recuperou ${healed} HP` : '', special.text, stages, ailment, statusCureMove(move) ? 'removeu condições de status' : ''].filter(Boolean);
      log(state, `${attacker.nome} usou ${displayName(move.nome)}${effects.length ? `: ${effects.join('; ')}.` : ', mas não teve efeito.'}`);
      return;
    }
    if (defender.protegido) { log(state, `${defender.nome} bloqueou ${displayName(move.nome)}.`); return; }
    if (move.nome === 'dream-eater' && defender.status !== 'sleep') { log(state, `${attacker.nome} tentou usar Dream Eater, mas ${defender.nome} não está dormindo.`); return; }
    const result = damage(attacker, defender, move);
    if (!result.acerto) { log(state, `${attacker.nome} usou ${displayName(move.nome)}, mas errou.`); return; }
    defender.hp = Math.max(0, defender.hp - result.dano);
    const healing = healByDrain(attacker, result.dano, drainPercentForMove(move));
    const ailment = applyMoveAilment(state, attacker, defender, move);
    const statChance = move.meta?.stat_chance > 0 ? move.meta.stat_chance : move.chanceEfeito ?? 0;
    const stages = applyStatChanges(move.alvo?.startsWith('user') ? attacker : defender, move, statChance);
    log(state, `${attacker.nome} usou ${displayName(move.nome)} e causou ${result.dano} de dano.${result.critico ? ' Acerto crítico!' : ''}${result.efetividade > 1 ? ' Super eficaz!' : result.efetividade < 1 ? ' Pouco eficaz.' : ''}${healing ? ` Recuperou ${healing} HP.` : ''}${ailment ? ` ${ailment}` : ''}${stages ? ` ${stages}` : ''}`);
  }
  function aiMove(enemy, player) {
    const best = enemy.ataques.map((move) => {
      if (move.categoria !== 'status') return { move, score: move.poder * (enemy.tipos.includes(move.tipo) ? 1.5 : 1) * effectiveness(move.tipo, player.tipos) * (move.precisao ?? 100) / 100 };
      let score = .05;
      if ((move.meta?.healing ?? 0) > 0 && enemy.hp < enemy.maxHp * .7) score = 30;
      if (move.meta?.ailment?.name && move.meta.ailment.name !== 'none' && !player.status && move.meta.ailment.name !== 'confusion' && !player.confusionTurns) score = Math.max(score, 15);
      if (move.meta?.ailment?.name === 'confusion' && !player.confusionTurns) score = Math.max(score, 8);
      if (move.alvo?.startsWith('user') && move.alteracoesAtributos?.some(change => change.mudanca > 0) && (enemy.statStages?.attack ?? 0) < 3) score = Math.max(score, 5);
      if (!move.alvo?.startsWith('user') && move.alteracoesAtributos?.some(change => change.mudanca < 0) && Object.values(player.statStages ?? {}).some(stage => stage > 0)) score = Math.max(score, 4);
      return { move, score };
    });
    best.sort((a, b) => b.score - a.score);
    return best[Math.min(randomInt(Math.min(2, best.length)), best.length - 1)].move;
  }
  async function resolveTurnEnd(tx, saveId, state) {
    endTurn(state);
    if (state.oponente?.hp === 0 && !state.resultado) {
      await recordWildDefeat(tx, saveId, state);
      afterFaint(state);
      if (state.tipo === 'torneio' && !state.jogador && !state.resultado) await loadTournamentRound(tx, state);
    }
    if (state.jogador?.hp === 0 && !state.aguardandoReviver && !state.resultado) {
      state.aguardandoReviver = true;
      log(state, `${state.jogador.nome} desmaiou. ${state.reservas?.length ? 'Escolha outro Pokémon ou use um Reviver.' : 'Use um Reviver ou aceite a derrota.'}`);
    }
  }
  async function opponentTurn(tx, saveId, state) {
    const move = aiMove(state.oponente, state.jogador);
    attack(state, state.oponente, state.jogador, move);
    await resolveTurnEnd(tx, saveId, state);
  }
  function afterFaint(state) {
    const fallen = state.oponente;
    const base = getEspecie(fallen.especieId).experienciaBase ?? 50;
    const earned = Math.max(1, Math.floor(base * fallen.nivel / 7 * (state.tipo === 'desafio' ? 1.5 : 1)));
    state.xpGanho += earned;
    state.xpPorPokemon[state.jogador.pokemonId] = (state.xpPorPokemon[state.jogador.pokemonId] ?? 0) + earned;
    if (state.tipo !== 'torneio') state.moedasGanhas = (state.moedasGanhas ?? 0) + fallen.nivel * 10;
    if (state.fila.length) {
      state.oponente = state.fila.shift();
      log(state, `${state.oponente.nome} entrou em batalha.`);
    } else if (state.tipo === 'torneio' && state.torneio.rodada < 8) {
      state.torneio.rodada++;
      state.jogador = null;
      state.reservas = [];
      state.aguardandoReviver = false;
      log(state, `Rodada ${state.torneio.rodada - 1} vencida! Seu Pokémon recuperou o HP. Escolha quem enfrentará o próximo treinador.`);
    } else { state.resultado = 'vitoria'; log(state, state.tipo === 'torneio' ? 'Você venceu o torneio!' : 'Você venceu a batalha!'); }
  }
  async function recordWildDefeat(tx, saveId, state) {
    if (state.tipo !== 'selvagem') return;
    await tx.batalhaEvento.create({ data: { saveId, tipo: 'derrotar', especieId: state.oponente.especieId, regiao: state.regiaoEncontro, shiny: state.oponente.shiny, descricao: `${state.oponente.nome} selvagem derrotado` } });
  }
  async function loadTournamentRound(tx, state) {
    const trainer = state.torneio.treinadores[state.torneio.rodada - 1];
    const opponents = [];
    for (const { id, nivel } of trainer.pokemon) opponents.push(makeCombatant(id, nivel, false, await movesFor(tx, id, nivel)));
    state.treinador = trainer.nome;
    state.totalOponentes = opponents.length;
    state.oponente = opponents.shift();
    state.fila = opponents;
    log(state, `${trainer.nome} desafiou você! ${state.oponente.nome} entrou em batalha.`);
  }
  async function finish(tx, save, state, action) {
    const inventory = await tx.itemInventario.findMany({ where: { saveId: save.id, quantidade: { gt: 0 } }, select: { itemId: true } });
    const owned = new Set(inventory.map((entry) => entry.itemId));
    if (state.resultado === 'vitoria' && state.tipo === 'desafio') await tx.desafioConcluido.upsert({ where: { saveId_desafioId: { saveId: save.id, desafioId: state.desafioId } }, create: { saveId: save.id, desafioId: state.desafioId }, update: {} });
    const completed = await progress(tx, save.id);
    const eggMultiplier = owned.has('lucky-egg') ? luckyEggMultiplier(completed) : 1;
    const coinMultiplier = owned.has('amulet-coin') ? amuletCoinMultiplier(completed) : 1;
    if (state.resultado === 'vitoria') {
      state.moedasGanhas = Math.floor((['treinador', 'torneio'].includes(state.tipo) ? state.recompensa.moedas : state.moedasGanhas ?? state.oponente.nivel * 10) * coinMultiplier);
      await tx.save.update({ where: { id: save.id }, data: { vitorias: { increment: 1 }, moedas: { increment: state.moedasGanhas } } });
      if (['treinador', 'torneio'].includes(state.tipo)) {
        state.itensGanhos = state.recompensa.itens;
        for (const item of state.itensGanhos) await tx.itemInventario.upsert({ where: { saveId_itemId: { saveId: save.id, itemId: item.itemId } }, create: { saveId: save.id, ...item }, update: { quantidade: { increment: item.quantidade } } });
      }
    } else if (state.resultado === 'derrota') await tx.save.update({ where: { id: save.id }, data: { derrotas: { increment: 1 } } });
    if (state.resultado === 'captura') {
      const foe = state.oponente;
      state.xpGanho += Math.max(1, Math.floor((getEspecie(foe.especieId).experienciaBase ?? 50) * foe.nivel / 7));
      const species = getEspecie(foe.especieId);
      await tx.pokemonCapturado.create({ data: { saveId: save.id, especieId: foe.especieId, nivel: foe.nivel, experiencia: species.experienciaPorNivel.find((entry) => entry.nivel === foe.nivel).experiencia, hpAtual: foe.maxHp, shiny: foe.shiny, bolaCaptura: action.itemId, sexo: foe.sexo, amizade: baseFriendship(species), ivs: normalizeIvs(foe.ivs), atributos: foe.stats, golpes: foe.ataques.map((move) => ({ nome: move.nome })), golpesDesbloqueados: naturalMoves(species, foe.nivel) } });
      await tx.especieRegistrada.upsert({ where: { saveId_especieId: { saveId: save.id, especieId: foe.especieId } }, create: { saveId: save.id, especieId: foe.especieId }, update: {} });
      await tx.batalhaEvento.create({ data: { saveId: save.id, tipo: 'capturar', especieId: foe.especieId, regiao: state.regiaoEncontro, shiny: foe.shiny, descricao: `${foe.nome}${foe.shiny ? ' shiny' : ''} capturado` } });
    }
    if (state.resultado === 'vitoria' && state.tipo === 'treinador') await tx.batalhaEvento.create({ data: { saveId: save.id, tipo: 'vencer_treinador', dificuldade: state.dificuldade, descricao: `${state.treinador} derrotado no modo ${state.dificuldade}` } });
    if (state.resultado === 'vitoria' && state.tipo === 'torneio') await tx.batalhaEvento.create({ data: { saveId: save.id, tipo: 'vencer_torneio', torneioId: state.torneio.id, descricao: `Torneio ${state.torneio.nome} vencido` } });
    await tx.batalhaEvento.create({ data: { saveId: save.id, tipo: 'batalha', especieId: state.oponente.especieId, regiao: state.regiaoEncontro ?? state.regiao, dificuldade: state.dificuldade, torneioId: state.torneio?.id, resultado: state.resultado, shiny: state.oponente.shiny, descricao: `${state.tipo === 'selvagem' ? state.oponente.nome : state.treinador ?? 'Batalha'} · ${state.resultado}` } });
    if (state.resultado === 'captura' && state.jogador) state.xpPorPokemon[state.jogador.pokemonId] = (state.xpPorPokemon[state.jogador.pokemonId] ?? 0) + state.xpGanho;
    for (const combatant of [state.jogador, ...(state.reservas ?? [])].filter((entry) => entry?.pokemonId)) {
      const member = await tx.pokemonCapturado.findFirst({ where: { id: combatant.pokemonId, saveId: save.id }, select: { amizade: true, bolaCaptura: true } });
      if (member) await tx.pokemonCapturado.update({ where: { id: combatant.pokemonId }, data: { amizade: happinessGain(member.bolaCaptura, member.amizade) } });
    }
    const xpEntries = Object.entries(state.xpPorPokemon ?? {});
    state.xpGanho = Math.floor(state.xpGanho * eggMultiplier);
    for (const [pokemonId, baseXp] of xpEntries) {
      const member = await tx.pokemonCapturado.findFirst({ where: { id: pokemonId, saveId: save.id } });
      if (!member) continue;
      const earnedXp = Math.floor(baseXp * eggMultiplier);
      const species = getEspecie(member.especieId);
      const maxXp = species.experienciaPorNivel.at(-1).experiencia;
      const experience = Math.min(maxXp, member.experiencia + earnedXp);
      const level = [...species.experienciaPorNivel].reverse().find((entry) => entry.experiencia <= experience)?.nivel ?? member.nivel;
      const stats = statsFor(formFor(species, member.megaForma, member.gmaxForma), level, member.shiny, member.ivs);
      await tx.pokemonCapturado.update({ where: { id: member.id }, data: { experiencia: experience, nivel: level, atributos: stats, hpAtual: stats.hp, golpesDesbloqueados: [...new Set([...unlockedMoves(member, species), ...naturalMoves(species, level)])] } });
      if (state.jogador?.pokemonId === member.id) state.novoNivel = level;
    }
    await tx.batalha.delete({ where: { id: action.batalhaId } });
    return { id: action.batalhaId, versao: action.versao + 1, ...state };
  }
  return {
    async challenges(usuarioId) {
      const save = await db.save.findUnique({ where: { usuarioId } });
      if (!save) throw new HttpError(404, 'Save nao encontrado.');
      const beaten = await progress(db, save.id);
      return { lideres: challengesWithStatus(beaten), torneios: TOURNAMENTS, autoBuscaDisponivel: GYMS.every((gym) => beaten.includes(gym.id)),
        regioes: REGIONS.map((region) => ({ id: region.id, nome: region.nome, geracao: region.geracao, especieInicial: region.minSpecies, especieFinal: region.maxSpecies, campeaoId: region.champion.id, challengeLabel: region.challengeLabel ?? 'Ginásios', eliteLabel: region.eliteLabel ?? 'Elite dos 4',
          desbloqueada: regionUnlocked(region.id, beaten), concluida: beaten.includes(region.champion.id), escolhaSelvagem: beaten.includes(region.champion.id), nivelMaximoSelvagem: wildLevelCap(beaten, region.id), niveisSelvagens: wildLevelSettings(beaten, region.id), marcosCharm: charmMilestones(beaten, region.geracao) })),
        niveisTodasGeracoes: wildLevelSettings(beaten, 'todas'),
        nivelMaximoSelvagem: wildLevelCap(beaten), marcosCharm: charmMilestones(beaten),
        geracoesDesbloqueadas: [...new Set(REGIONS.filter((region) => regionUnlocked(region.id, beaten)).map((region) => region.geracao))], geracoesImplementadas: [...new Set(REGIONS.map((region) => region.geracao))] };
    },
    async current(usuarioId) {
      const save = await db.save.findUnique({ where: { usuarioId } });
      if (!save) return null;
      const active = await db.batalha.findUnique({ where: { saveId: save.id } });
      return active ? { id: active.id, versao: active.versao, ...normalizeBattleState(structuredClone(active.estado)) } : null;
    },
    async start(usuarioId, { tipo, desafioId, dificuldade, torneioId, regiao, selvagem, intervaloNivel, autoBusca = false }) {
      return db.$transaction(async (tx) => {
        const save = await tx.save.findUnique({ where: { usuarioId } });
        if (!save?.inicialEspecieId) throw new HttpError(409, 'Escolha seu inicial antes de batalhar.');
        if (await tx.batalha.findUnique({ where: { saveId: save.id } })) throw new HttpError(409, 'Uma batalha ja esta em andamento.');
        const completed = await progress(tx, save.id);
        if (autoBusca && !GYMS.every((gym) => completed.includes(gym.id))) throw new HttpError(403, 'A busca automática é liberada após vencer os oito Ginásios de Kanto.');
        const inventory = await tx.itemInventario.findMany({ where: { saveId: save.id, quantidade: { gt: 0 } }, select: { itemId: true } });
        const owned = new Set(inventory.map((entry) => entry.itemId));
        const leader = tipo === 'desafio' ? challengesWithStatus(completed).find((entry) => entry.id === desafioId) : null;
        if (tipo === 'desafio' && !leader) throw new HttpError(404, 'Lider nao encontrado.');
        if (leader && !leader.desbloqueado) throw new HttpError(403, 'Desafio ainda bloqueado.');
        const requestedRegion = regiao ?? selvagem?.regiao ?? 'kanto';
        const wildRegion = REGIONS.find((entry) => entry.id === requestedRegion);
        if (tipo === 'selvagem' && (requestedRegion !== 'todas' && (!wildRegion || !regionUnlocked(wildRegion.id, completed)) || requestedRegion === 'todas' && selvagem)) throw new HttpError(403, 'Região ainda bloqueada ou escolha personalizada indisponível para todas as gerações.');
        if (selvagem && !completed.includes(wildRegion.champion.id)) throw new HttpError(403, `Derrote o campeão de ${wildRegion.nome} para escolher espécie e nível selvagem.`);
        if (selvagem && (selvagem.regiao !== wildRegion.id || selvagem.especieId < wildRegion.minSpecies || selvagem.especieId > wildRegion.maxSpecies)) throw new HttpError(404, 'Espécie indisponível nesta região.');
        const wildLevels = tipo === 'selvagem' && !selvagem ? wildRange(completed, requestedRegion, intervaloNivel) : null;
        let autoSearchCoins = null;
        if (autoBusca) {
          const paid = await tx.save.updateMany({ where: { id: save.id, moedas: { gte: AUTO_SEARCH_COST } }, data: { moedas: { decrement: AUTO_SEARCH_COST } } });
          if (paid.count !== 1) throw new HttpError(409, `Você precisa de pelo menos ${AUTO_SEARCH_COST} moedas para cada tentativa da busca automática.`);
          autoSearchCoins = save.moedas - AUTO_SEARCH_COST;
        }
        const trainer = tipo === 'treinador' ? rollTrainer(dificuldade) : null;
        const tournament = tipo === 'torneio' ? rollTournament(torneioId) : null;
        if (tipo === 'torneio' && !tournament) throw new HttpError(404, 'Torneio não encontrado.');
        const opponents = [];
        const wild = tipo === 'selvagem' ? (selvagem ? getEspecie(selvagem.especieId) : rollWild(getCatalogo(), randomInt, completed, requestedRegion)) : null;
        if (wild && !legendaryUnlocked(wild, completed)) throw new HttpError(403, 'Derrote a Elite dos 4 desta região para encontrar este Pokémon lendário ou mítico.');
        const encounterRegion = requestedRegion === 'todas' ? REGIONS.filter((entry) => wild.id >= entry.minSpecies && wild.id <= entry.maxSpecies && regionUnlocked(entry.id, completed)).at(-1) : wildRegion;
        const lineup = leader ? leader.pokemon.map((id) => ({ id, nivel: leader.nivel })) : trainer ? trainer.pokemon : tournament ? tournament.treinadores[0].pokemon : [{ id: wild.id, nivel: selvagem?.nivel ?? randomInt(wildLevels.intervaloNivel.minimo, wildLevels.intervaloNivel.maximo + 1) }];
        for (const { id, nivel: enemyLevel } of lineup) {
          opponents.push(makeCombatant(id, enemyLevel, tournament ? false : rollShiny(randomInt, shinyRolls(completed, generationForSpecies(id), owned.has('shiny-charm'))), await movesFor(tx, id, enemyLevel)));
        }
        if (tournament) {
          const paid = await tx.save.updateMany({ where: { id: save.id, moedas: { gte: tournament.entrada } }, data: { moedas: { decrement: tournament.entrada } } });
          if (paid.count !== 1) throw new HttpError(409, 'Pokédólares insuficientes para entrar no torneio.');
        }
        const state = { tipo, regiao: tipo === 'selvagem' ? requestedRegion : leader?.regiao ?? null, regiaoEncontro: tipo === 'selvagem' ? encounterRegion.id : null, desafioId: leader?.id ?? null, treinador: leader?.nome ?? trainer?.nome ?? tournament?.treinadores[0].nome ?? null, dificuldade: trainer?.dificuldade ?? null, recompensa: trainer?.recompensa ?? tournament?.recompensa ?? null, torneio: tournament ? { id: tournament.id, nome: tournament.nome, entrada: tournament.entrada, rodada: 1, treinadores: tournament.treinadores } : null, xpPorPokemon: {}, itensGanhos: [], limiteNivel: leader?.nivel ?? null, totalOponentes: opponents.length, jogador: null, reservas: [], oponente: opponents.shift(), fila: opponents, rodada: 1, xpGanho: 0, moedasGanhas: 0, resultado: null, aguardandoReviver: false, ...(autoBusca ? { buscaAutomatica: true, buscaTentativas: 1, moedasBusca: autoSearchCoins, ...(selvagem ? { buscaAutomaticaEspecieId: selvagem.especieId, buscaAutomaticaNivel: selvagem.nivel } : {}) } : {}), logs: [leader ? `${leader.nome} desafiou você!` : trainer ? `${trainer.nome} desafiou você!` : tournament ? `Torneio ${tournament.nome}: rodada 1 de 8 contra ${tournament.treinadores[0].nome}.` : 'Um Pokémon selvagem apareceu! Escolha quem vai enfrentá-lo.'] };
        if (wildLevels) Object.assign(state, wildLevels);
        if (tipo === 'selvagem' && state.oponente.shiny) await tx.batalhaEvento.create({ data: { saveId: save.id, tipo: 'shiny_encontrado', especieId: wild.id, regiao: encounterRegion.id, shiny: true, descricao: `${state.oponente.nome} shiny encontrado` } });
        if (!save.kitEntregue) {
          await tx.save.update({ where: { id: save.id }, data: { kitEntregue: true } });
          for (const [itemId, quantidade] of [['poke-ball', 10], ['potion', 5]]) await tx.itemInventario.upsert({ where: { saveId_itemId: { saveId: save.id, itemId } }, create: { saveId: save.id, itemId, quantidade }, update: { quantidade: { increment: quantidade } } });
        }
        const battle = await tx.batalha.create({ data: { saveId: save.id, estado: state } });
        return { id: battle.id, versao: battle.versao, ...state };
      }, { isolationLevel: 'Serializable', timeout: 20_000 });
    },
    async act(usuarioId, action) {
      return db.$transaction(async (tx) => {
        const save = await tx.save.findUnique({ where: { usuarioId } });
        if (!save) throw new HttpError(404, 'Save nao encontrado.');
        const battle = await tx.batalha.findUnique({ where: { saveId: save.id } });
        if (!battle || battle.id !== action.batalhaId || battle.versao !== action.versao) throw new HttpError(409, 'A batalha mudou. Recarregue seu estado.');
        const state = normalizeBattleState(structuredClone(battle.estado));
        if (state.resultado) throw new HttpError(409, 'Esta batalha ja terminou.');
        if (action.acao === 'abandonar') {
          if (state.tipo !== 'torneio') throw new HttpError(400, 'Só é possível abandonar um torneio.');
          state.resultado = 'desistencia'; log(state, 'Você abandonou o torneio. A inscrição não é devolvida.');
        } else if (action.acao === 'escolher') {
          if (state.jogador) throw new HttpError(409, 'Pokémon desta batalha já escolhido.');
          const ids = action.pokemonIds ?? [action.pokemonId];
          if (ids.length > state.totalOponentes || new Set(ids).size !== ids.length) throw new HttpError(400, `Escolha até ${state.totalOponentes} Pokémon diferentes.`);
          const members = await tx.pokemonCapturado.findMany({ where: { id: { in: ids }, saveId: save.id } });
          if (members.length !== ids.length) throw new HttpError(404, 'Pokémon não encontrado na sua coleção.');
          const combatants = [];
          for (const id of ids) {
            const member = members.find((entry) => entry.id === id);
            const level = state.limiteNivel ? Math.min(member.nivel, state.limiteNivel) : member.nivel;
            combatants.push({ ...makeCombatant(member.especieId, level, member.shiny, await playerMovesFor(tx, member), member.id, member.apelido, member.megaForma, member.gmaxForma, member.ivs), sexo: member.sexo });
          }
          state.jogador = combatants.shift();
          state.reservas = combatants;
          log(state, `${state.jogador.nome} entrou em batalha!`);
        } else if (action.acao === 'trocar') {
          if (!state.jogador) throw new HttpError(409, 'Escolha sua equipe primeiro.');
          if (state.jogador.ingrained) throw new HttpError(409, 'Este Pokémon criou raízes com Ingrain e não pode ser trocado.');
          const index = (state.reservas ?? []).findIndex((member) => member.pokemonId === action.pokemonId);
          if (index < 0) throw new HttpError(404, 'Pokémon não está entre as reservas.');
          const [next] = state.reservas.splice(index, 1);
          if (state.jogador.hp > 0) state.reservas.push(state.jogador);
          const freeSwitch = state.aguardandoReviver;
          state.jogador = next;
          state.aguardandoReviver = false;
          log(state, `${next.nome} entrou em batalha!`);
          if (!freeSwitch) await opponentTurn(tx, save.id, state);
        } else if (action.acao === 'procurar' || action.acao === 'procurar-auto') {
          if (state.tipo !== 'selvagem' || state.jogador) throw new HttpError(409, 'A nova busca só está disponível antes de escolher o Pokémon para um encontro selvagem.');
          if (action.acao === 'procurar-auto') {
            if (!state.buscaAutomatica) throw new HttpError(409, 'Inicie uma busca automática antes de fazer novas tentativas pagas.');
            const completed = await progress(tx, save.id);
            if (!GYMS.every((gym) => completed.includes(gym.id))) throw new HttpError(403, 'A busca automática é liberada após vencer os oito Ginásios de Kanto.');
            const paid = await tx.save.updateMany({ where: { id: save.id, moedas: { gte: AUTO_SEARCH_COST } }, data: { moedas: { decrement: AUTO_SEARCH_COST } } });
            if (paid.count !== 1) throw new HttpError(409, `Saldo insuficiente. A busca automática custa ${AUTO_SEARCH_COST} moedas por tentativa.`);
            state.moedasBusca = save.moedas - AUTO_SEARCH_COST;
            state.buscaTentativas += 1;
          }
          const completed = await progress(tx, save.id);
          const owned = new Set((await tx.itemInventario.findMany({ where: { saveId: save.id, quantidade: { gt: 0 } }, select: { itemId: true } })).map((item) => item.itemId));
          let wild = state.buscaAutomaticaEspecieId ? getEspecie(state.buscaAutomaticaEspecieId) : rollWild(getCatalogo(), randomInt, completed, state.regiao);
          for (let attempt = 0; !state.buscaAutomaticaEspecieId && wild.id === state.oponente.especieId && attempt < 20; attempt++) wild = rollWild(getCatalogo(), randomInt, completed, state.regiao);
          if (!state.buscaAutomaticaEspecieId && wild.id === state.oponente.especieId) {
            const alternatives = getCatalogo().pokemon.filter((species) => species.id !== state.oponente.especieId && legendaryUnlocked(species, completed) && REGIONS.some((region) => species.id >= region.minSpecies && species.id <= region.maxSpecies && regionUnlocked(region.id, completed) && (state.regiao === 'todas' || state.regiao === region.id)));
            wild = alternatives[randomInt(alternatives.length)];
          }
          const encounterRegion = REGIONS.find((region) => wild.id >= region.minSpecies && wild.id <= region.maxSpecies);
          const wildLevels = state.buscaAutomaticaEspecieId ? null : wildRange(completed, state.regiao, state.intervaloNivel);
          const level = state.buscaAutomaticaEspecieId ? state.buscaAutomaticaNivel : randomInt(wildLevels.intervaloNivel.minimo, wildLevels.intervaloNivel.maximo + 1);
          if (wildLevels) Object.assign(state, wildLevels);
          state.oponente = makeCombatant(wild.id, level, rollShiny(randomInt, shinyRolls(completed, generationForSpecies(wild.id), owned.has('shiny-charm'))), await movesFor(tx, wild.id, level));
          state.regiaoEncontro = encounterRegion.id;
          state.logs = [`Outro Pokémon selvagem apareceu: ${state.oponente.nome}! Escolha quem vai enfrentá-lo ou continue procurando.`];
          if (state.oponente.shiny) await tx.batalhaEvento.create({ data: { saveId: save.id, tipo: 'shiny_encontrado', especieId: wild.id, regiao: encounterRegion.id, shiny: true, descricao: `${state.oponente.nome} shiny encontrado` } });
        } else if (action.acao === 'fugir') {
          if (state.tipo !== 'selvagem') throw new HttpError(400, 'Nao e possivel fugir de um desafio.');
          state.resultado = 'fuga'; log(state, 'Você fugiu da batalha.');
        } else if (!state.jogador) {
          throw new HttpError(409, 'Escolha um Pokémon antes de agir.');
        } else if (action.acao === 'desistir') {
          if (!state.aguardandoReviver) throw new HttpError(400, 'Só é possível aceitar a derrota após seu Pokémon desmaiar.');
          state.resultado = 'derrota'; log(state, 'Você perdeu a batalha.');
        } else if (action.acao === 'usar-item') {
          const item = HEALING_ITEMS[action.itemId];
          if (!item) throw new HttpError(400, 'Item de cura inválido.');
          const missing = state.jogador.maxHp - state.jogador.hp;
          const curesCurrentStatus = item.cureAll ? Boolean(state.jogador.status) : item.cure?.includes(state.jogador.status) ?? false;
          if (item.revive ? state.jogador.hp !== 0 : state.jogador.hp === 0 || missing === 0 && !curesCurrentStatus) throw new HttpError(409, 'Este item não pode ser usado agora.');
          const used = await tx.itemInventario.updateMany({ where: { saveId: save.id, itemId: action.itemId, quantidade: { gt: 0 } }, data: { quantidade: { decrement: 1 } } });
          if (used.count !== 1) throw new HttpError(409, 'Item de cura indisponível.');
          const previousStatus = state.jogador.status;
          const healed = healCombatant(state.jogador, action.itemId);
          const cured = previousStatus && !state.jogador.status;
          log(state, `${state.jogador.nome} ${healed ? `recuperou ${healed} HP` : cured ? `teve ${previousStatus} curado` : 'foi reanimado'} com ${displayName(action.itemId)}.`);
          if (state.aguardandoReviver) state.aguardandoReviver = false;
          else await opponentTurn(tx, save.id, state);
        } else if (action.acao === 'capturar') {
          if (state.aguardandoReviver) throw new HttpError(409, 'Reviva seu Pokémon antes de capturar.');
          if (state.tipo !== 'selvagem') throw new HttpError(400, 'Nao e possivel capturar o Pokemon do treinador.');
          if (!CAPTURE_BALL_IDS.has(action.itemId)) throw new HttpError(400, 'Poké Bola inválida.');
          const item = await tx.itemInventario.updateMany({ where: { saveId: save.id, itemId: action.itemId, quantidade: { gt: 0 } }, data: { quantidade: { decrement: 1 } } });
          if (item.count !== 1) throw new HttpError(409, 'Poké Bola indisponivel.');
          const species = getEspecie(state.oponente.especieId);
          const charm = await tx.itemInventario.findUnique({ where: { saveId_itemId: { saveId: save.id, itemId: 'catching-charm' } } });
          const completed = charm?.quantidade > 0 ? await progress(tx, save.id) : [];
          const multiplier = catchCharmMultiplier(completed, generationForSpecies(species.id), charm?.quantidade > 0);
          const opponent = { ...state.oponente, species: { types: species.tipos, weight: species.peso, height: species.altura } };
          const conditionalMultiplier = captureBallMultiplier(action.itemId, { round: state.rodada, opponent, player: state.jogador });
          const chance = action.itemId === 'master-ball' ? 1 : Math.min(.95, species.taxaCaptura / 255 * (BASE_CAPTURE_MULTIPLIER[action.itemId] ?? 1) * conditionalMultiplier * (3 - 2 * state.oponente.hp / state.oponente.maxHp) / 3 * multiplier);
          if (randomInt(10000) < chance * 10000) { state.resultado = 'captura'; if (action.itemId === 'heal-ball') state.oponente.status = null; log(state, `${state.oponente.nome} foi capturado${action.itemId === 'heal-ball' ? ' e recuperou todo o HP e status com a Bola de Cura' : ''}!`); }
          else { log(state, `${state.oponente.nome} escapou da Poké Bola.`); await opponentTurn(tx, save.id, state); }
        } else {
          if (state.aguardandoReviver) throw new HttpError(409, 'Reviva seu Pokémon antes de atacar.');
          const move = state.jogador.ataques.find((entry) => entry.nome === action.golpe);
          if (!move) throw new HttpError(400, 'Ataque indisponivel para este Pokemon.');
          const enemyMove = aiMove(state.oponente, state.jogador);
          const first = move.prioridade !== enemyMove.prioridade ? move.prioridade > enemyMove.prioridade : battleSpeed(state.jogador) !== battleSpeed(state.oponente) ? battleSpeed(state.jogador) > battleSpeed(state.oponente) : randomInt(2) === 0;
          if (first) {
            attack(state, state.jogador, state.oponente, move);
            if (state.oponente.hp === 0) { await recordWildDefeat(tx, save.id, state); afterFaint(state); if (state.tipo === 'torneio' && !state.jogador && !state.resultado) await loadTournamentRound(tx, state); }
            else await opponentTurn(tx, save.id, state);
          } else {
            attack(state, state.oponente, state.jogador, enemyMove);
            if (state.jogador.hp === 0) { state.aguardandoReviver = true; log(state, `${state.jogador.nome} desmaiou. ${state.reservas?.length ? 'Escolha outro Pokémon ou use um Reviver.' : 'Use um Reviver ou aceite a derrota.'}`); }
            else { attack(state, state.jogador, state.oponente, move); if (state.oponente.hp === 0) { await recordWildDefeat(tx, save.id, state); afterFaint(state); if (state.tipo === 'torneio' && !state.jogador && !state.resultado) await loadTournamentRound(tx, state); } else await resolveTurnEnd(tx, save.id, state); }
          }
        }
        if (!['escolher', 'procurar', 'procurar-auto'].includes(action.acao)) state.rodada++;
        if (state.resultado) return finish(tx, save, state, action);
        const updated = await tx.batalha.updateMany({ where: { id: battle.id, versao: action.versao }, data: { estado: state, versao: { increment: 1 } } });
        if (updated.count !== 1) throw new HttpError(409, 'A batalha mudou. Recarregue seu estado.');
        return { id: battle.id, versao: battle.versao + 1, ...state };
      }, { isolationLevel: 'Serializable', timeout: 20_000 });
    },
  };
}
