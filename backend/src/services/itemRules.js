export const HEALING_ITEMS = {
  potion: { amount: 20 },
  'super-potion': { amount: 50 },
  'hyper-potion': { amount: 200 },
  'max-potion': { full: true },
  'full-restore': { full: true, cureAll: true },
  antidote: { cure: ['poison'] },
  'paralyze-heal': { cure: ['paralysis'] },
  awakening: { cure: ['sleep'] },
  'burn-heal': { cure: ['burn'] },
  'ice-heal': { cure: ['freeze'] },
  'full-heal': { cureAll: true },
  revive: { revive: .5 },
  'max-revive': { revive: 1 },
};

export const STATUS_CURE_ITEMS = [
  ['antidote', 'Antídoto', 200, 'Cura envenenamento.'],
  ['paralyze-heal', 'Antiparalisia', 300, 'Cura paralisia.'],
  ['awakening', 'Despertador', 250, 'Acorda um Pokémon adormecido.'],
  ['burn-heal', 'Antiqueimadura', 250, 'Cura queimadura.'],
  ['ice-heal', 'Antigelo', 250, 'Cura congelamento.'],
  ['full-heal', 'Cura Total', 600, 'Remove qualquer condição de status.'],
].map(([nome, nomeExibicao, precoLoja, descricao], index) => ({
  id: 2300 + index, nome, nomeExibicao, categoria: 'cura', descricao, precoReferencia: null,
  sprite: `/assets/items/${nome}.png`, precoLoja,
}));

export const PASSIVE_ITEMS = new Set(['lucky-egg', 'amulet-coin', 'shiny-charm', 'catching-charm']);
export const EXP_CANDIES = { 'exp-candy-p': 800, 'exp-candy-m': 3000, 'exp-candy-g': 10000, 'exp-candy-gg': 30000 };
export const REWARD_ONLY_ITEMS = new Set(['master-ball', 'rare-candy', ...Object.keys(EXP_CANDIES)]);

export function generationForSpecies(speciesId) {
  if (speciesId <= 151) return 1;
  if (speciesId <= 251) return 2;
  if (speciesId <= 386) return 3;
  if (speciesId <= 493) return 4;
  if (speciesId <= 649) return 5;
  if (speciesId <= 721) return 6;
  if (speciesId <= 809) return 7;
  if (speciesId <= 905) return 8;
  return 9;
}

export function healCombatant(combatant, itemId) {
  const item = HEALING_ITEMS[itemId];
  if (!item) return null;
  if (item.revive) {
    if (combatant.hp !== 0) return null;
    const hp = Math.max(1, Math.ceil(combatant.maxHp * item.revive));
    combatant.hp = hp;
    return hp;
  }
  const cured = item.cureAll ? Boolean(combatant.status) : item.cure?.includes(combatant.status) ?? false;
  if ((item.cure || item.cureAll) && !cured && !item.amount && !item.full) return null;
  if (cured) combatant.status = null;
  if ((item.cure || item.cureAll) && !item.amount && !item.full) return 0;
  if (combatant.hp <= 0 || combatant.hp >= combatant.maxHp) return cured ? 0 : null;
  const before = combatant.hp;
  combatant.hp = item.full ? combatant.maxHp : Math.min(combatant.maxHp, before + item.amount);
  return combatant.hp - before;
}
