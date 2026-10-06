import { randomInt } from 'node:crypto';

export const CAPTURE_BALL_ITEMS = [
  { id: 'fast-ball', name: 'Bola Rápida', price: 1_000, description: 'Multiplica a captura por 4–5× no primeiro turno.' },
  { id: 'timer-ball', name: 'Bola Psíquica', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Psíquico.' },
  { id: 'dusk-ball', name: 'Bola do Crepúsculo', price: 1_000, description: 'Multiplica a captura por 4× contra Pokémon dos tipos Sombrio ou Fantasma.' },
  { id: 'dive-ball', name: 'Bola Aquática', price: 1_000, description: 'Multiplica a captura por 3,5× na água, pescando ou contra Pokémon de Água.' },
  { id: 'net-ball', name: 'Bola de Rede', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon de Água ou Inseto.' },
  { id: 'nest-ball', name: 'Bola do Ninho', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Voador.' },
  { id: 'repeat-ball', name: 'Bola Trovão', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Elétrico.' },
  { id: 'heavy-ball', name: 'Bola Pesada', price: 1_000, description: 'Pokémon maiores ou mais pesados que o treinador recebem bônus crescente, até 4×.' },
  { id: 'moon-ball', name: 'Bola Dracônica', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Dragão.' },
  { id: 'level-ball', name: 'Bola Congelante', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Gelo.' },
  { id: 'love-ball', name: 'Bola das Fadas', price: 1_000, description: 'Multiplica a captura por 3,5× contra Pokémon do tipo Fada e por 3× contra Pokémon que compartilham um tipo com o seu.' },
  { id: 'dream-ball', name: 'Bola de Sonho', price: 1_000, description: 'Multiplica a captura por 4× contra Pokémon adormecidos.' },
  { id: 'heal-ball', name: 'Bola de Cura', price: 1_000, description: 'Captura e restaura todo o HP, curando condições de status.' },
  { id: 'luxury-ball', name: 'Bola de Treino', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Lutador.' },
  { id: 'friend-ball', name: 'Bola Floresta', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Planta.' },
  { id: 'premier-ball', name: 'Bola Premier', price: null, description: 'Visual especial. Ganhe uma ao comprar 10 Poké Bolas de uma vez.' },
  { id: 'sport-ball', name: 'Bola Incandescente', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon do tipo Fogo.' },
];

export const SPECIAL_CAPTURE_BALL_REWARD_ID = 'special-capture-ball';
export const SPECIAL_CAPTURE_BALL_REWARD_IDS = Object.freeze(CAPTURE_BALL_ITEMS.filter((ball) => ball.id !== 'premier-ball').map((ball) => ball.id));

export function randomRewardCaptureBall(rng = randomInt) {
  return SPECIAL_CAPTURE_BALL_REWARD_IDS[rng(SPECIAL_CAPTURE_BALL_REWARD_IDS.length)];
}

export const CAPTURE_BALL_IDS = new Set([
  'poke-ball', 'great-ball', 'ultra-ball', 'master-ball',
  ...CAPTURE_BALL_ITEMS.map((ball) => ball.id),
]);

export function captureBallMultiplier(itemId, { round = 1, opponent, player, previouslyCaptured = false, environment = 'field', hour = new Date().getHours() }) {
  const species = opponent?.species;
  const types = species?.types ?? opponent?.tipos ?? [];
  switch (itemId) {
    case 'fast-ball': return round <= 1 ? 5 : 1;
    case 'timer-ball': return types.includes('psychic') ? 3 : 1;
    case 'dusk-ball': return types.some((type) => ['dark', 'ghost'].includes(type)) ? 4 : 1;
    case 'dive-ball': return ['water', 'fishing'].includes(environment) || types.includes('water') ? 3.5 : 1;
    case 'net-ball': return types.some((type) => ['water', 'bug'].includes(type)) ? 3 : 1;
    case 'nest-ball': return types.includes('flying') ? 3 : 1;
    case 'repeat-ball': return types.includes('electric') ? 3 : 1;
    case 'heavy-ball': {
      const weightMultiplier = 1 + Math.floor((species?.weight ?? 0) / 100);
      const heightMultiplier = 1 + Math.floor((species?.height ?? 0) / 1.7);
      return Math.max(1, Math.min(4, Math.max(weightMultiplier, heightMultiplier)));
    }
    case 'moon-ball': return types.includes('dragon') ? 3 : 1;
    case 'level-ball': return types.includes('ice') ? 3 : 1;
    case 'love-ball': return types.includes('fairy') ? 3.5 : types.some((type) => player?.tipos?.includes(type)) ? 3 : 1;
    case 'dream-ball': return opponent?.status === 'sleep' ? 4 : 1;
    case 'luxury-ball': return types.includes('fighting') ? 3 : 1;
    case 'friend-ball': return types.includes('grass') ? 3 : 1;
    case 'sport-ball': return types.includes('fire') ? 3 : 1;
    default: return itemId === 'great-ball' ? 1.5 : itemId === 'ultra-ball' ? 2 : 1;
  }
}

export function rollPokemonSex(species, rng) {
  const femaleRate = Number(species?.proporcaoFemeas);
  if (!Number.isFinite(femaleRate) || femaleRate < 0) return null;
  return rng(100) < femaleRate * 12.5 ? 'female' : 'male';
}

export function baseFriendship(species) {
  return Math.max(0, Math.min(255, Number.isInteger(species?.felicidadeBase) ? species.felicidadeBase : 70));
}

export function happinessGain(ballId, current = 70) {
  return Math.min(255, current + 5);
}

export function evolvesWithMoonStone(root, speciesId) {
  if (!root) return false;
  if (root.especieId === speciesId) return (root.evolucoes ?? []).some((node) => (node.condicoes ?? []).some((condition) => condition.item === 'moon-stone'));
  return (root.evolucoes ?? []).some((node) => evolvesWithMoonStone(node, speciesId));
}
