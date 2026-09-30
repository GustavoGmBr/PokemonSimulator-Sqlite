export const IV_STATS = { hp: 'HP', attack: 'Ataque', defense: 'Defesa', 'special-attack': 'At. especial', 'special-defense': 'Def. especial', speed: 'Velocidade' };
export const MAX_IV = 31;
export const MAX_TOTAL_IV = 186;
export const IV_ITEMS = Object.entries(IV_STATS).map(([stat, label], index) => ({
  nome: `iv-${stat}`, stat, nomeExibicao: `Essência de ${label}`, categoria: 'ivs', precoLoja: 5000,
  descricao: `Aumenta permanentemente +1 IV de ${label} de um Pokémon, até 31. Use nas informações do Pokémon.`,
  sprite: `/assets/items/iv-${index}.svg`,
}));

export function normalizeIvs(ivs) {
  return Object.fromEntries(Object.keys(IV_STATS).map(stat => [stat, Number.isInteger(ivs?.[stat]) ? Math.max(0, Math.min(MAX_IV, ivs[stat])) : 15]));
}
export function perfectIvs() {
  return Object.fromEntries(Object.keys(IV_STATS).map(stat => [stat, MAX_IV]));
}
export function rollIvs(rng) {
  return Object.fromEntries(Object.keys(IV_STATS).map(stat => [stat, rng(32)]));
}
export function ivQuality(ivs) {
  const total = Object.values(normalizeIvs(ivs)).reduce((sum, value) => sum + value, 0);
  const stars = total === 186 ? 4 : total >= 151 ? 3 : total >= 121 ? 2 : total >= 91 ? 1 : 0;
  return { total, percentage: total / MAX_TOTAL_IV * 100, stars, label: ['Decente / Ruim', 'Acima da média', 'Muito bom', 'Fantástico / Excelente', 'Potencial Perfeito'][stars], valueMultiplier: stars === 4 ? 2 : stars === 3 ? 1.5 : 1 };
}
