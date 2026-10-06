export const CAPTURE_BALL_ITEMS = [
  { id: 'fast-ball', name: 'Bola Rápida', price: 1_000, description: 'Multiplica a captura por 5× no primeiro turno.' },
  { id: 'timer-ball', name: 'Bola do Tempo', price: 1_000, description: 'Ganha 0,3× por turno, até 4×.' },
  { id: 'dusk-ball', name: 'Bola do Crepúsculo', price: 1_000, description: 'Multiplica a captura por 3,5× à noite ou em cavernas.' },
  { id: 'dive-ball', name: 'Bola Aquática', price: 1_000, description: 'Multiplica a captura por 3,5× na água, pescando ou contra Pokémon de Água.' },
  { id: 'net-ball', name: 'Bola de Rede', price: 1_000, description: 'Multiplica a captura por 3× contra Pokémon de Água ou Inseto.' },
  { id: 'nest-ball', name: 'Bola do Ninho', price: 1_000, description: 'Quanto menor o nível selvagem, maior a captura (até 4×).' },
  { id: 'repeat-ball', name: 'Bola de Repetição', price: 1_000, description: 'Multiplica a captura por 3× contra espécies já registradas.' },
  { id: 'heavy-ball', name: 'Bola Pesada', price: 1_000, description: 'Pokémon com 100 kg ou mais recebem bônus crescente, até 4×.' },
  { id: 'moon-ball', name: 'Bola Lunar', price: 1_000, description: 'Multiplica a captura por 4× contra Pokémon que evoluem com Pedra da Lua.' },
  { id: 'level-ball', name: 'Bola de Nível', price: 1_000, description: 'Bônus de 2×, 4× ou 8× conforme seu nível supera o selvagem.' },
  { id: 'love-ball', name: 'Bola do Amor', price: 1_000, description: 'Multiplica a captura por 8× se os Pokémon forem de sexos opostos.' },
  { id: 'dream-ball', name: 'Bola dos Sonhos', price: 1_000, description: 'Multiplica a captura por 4× contra Pokémon adormecidos.' },
  { id: 'heal-ball', name: 'Bola de Cura', price: 1_000, description: 'Captura e restaura todo o HP, curando condições de status.' },
  { id: 'luxury-ball', name: 'Bola de Luxo', price: 1_000, description: 'A amizade cresce duas vezes mais rápido após batalhas.' },
  { id: 'friend-ball', name: 'Bola Amiga', price: 1_000, description: 'O Pokémon capturado começa com amizade 200.' },
  { id: 'premier-ball', name: 'Bola Premier', price: null, description: 'Visual especial. Ganhe uma ao comprar 10 Poké Bolas de uma vez.' },
];

export const CAPTURE_BALL_IDS = new Set([
  'poke-ball', 'great-ball', 'ultra-ball', 'master-ball',
  ...CAPTURE_BALL_ITEMS.map((ball) => ball.id),
]);

export function captureBallMultiplier(itemId, { round = 1, opponent, player, previouslyCaptured = false, environment = 'field', hour = new Date().getHours() }) {
  const species = opponent?.species;
  const types = species?.types ?? opponent?.tipos ?? [];
  switch (itemId) {
    case 'fast-ball': return round <= 1 ? 5 : 1;
    case 'timer-ball': return Math.min(4, 1 + Math.max(0, round - 1) * 0.3);
    case 'dusk-ball': return environment === 'cave' || hour >= 20 || hour < 6 ? 3.5 : 1;
    case 'dive-ball': return ['water', 'fishing'].includes(environment) || types.includes('water') ? 3.5 : 1;
    case 'net-ball': return types.some((type) => ['water', 'bug'].includes(type)) ? 3 : 1;
    case 'nest-ball': return Math.max(1, Math.min(4, (41 - (opponent?.nivel ?? 100)) / 10));
    case 'repeat-ball': return previouslyCaptured ? 3 : 1;
    case 'heavy-ball': return Math.max(1, Math.min(4, 1 + Math.floor((species?.weight ?? 0) / 100)));
    case 'moon-ball': return species?.evolvesWithMoonStone ? 4 : 1;
    case 'level-ball': {
      const ratio = (player?.nivel ?? 0) / Math.max(1, opponent?.nivel ?? 1);
      return ratio >= 4 ? 8 : ratio >= 2 ? 4 : ratio > 1 ? 2 : 1;
    }
    case 'love-ball': return player?.sexo && opponent?.sexo && player.sexo !== opponent.sexo ? 8 : 1;
    case 'dream-ball': return opponent?.status === 'sleep' ? 4 : 1;
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
  return Math.min(255, current + (ballId === 'luxury-ball' ? 10 : 5));
}

export function evolvesWithMoonStone(root, speciesId) {
  if (!root) return false;
  if (root.especieId === speciesId) return (root.evolucoes ?? []).some((node) => (node.condicoes ?? []).some((condition) => condition.item === 'moon-stone'));
  return (root.evolucoes ?? []).some((node) => evolvesWithMoonStone(node, speciesId));
}
