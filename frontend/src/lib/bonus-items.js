const generationNames = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function formatMultiplier(value) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShinyOdds(value) {
  return value.toLocaleString('pt-BR');
}

export function getBonusItemDescriptions(regions = []) {
  const completedAfterFirst = new Set(regions.filter((region) => region.geracao > 1 && region.concluida).map((region) => region.geracao)).size;
  const eggMultiplier = 2 + Math.min(8, completedAfterFirst) * .25;
  const coinMultiplier = Math.min(5, 2 + completedAfterFirst * .5);
  const byGeneration = [...new Set(regions.map((region) => region.geracao))].sort((a, b) => a - b).map((generation) => {
    const milestones = Math.max(0, ...regions.filter((region) => region.geracao === generation).map((region) => region.marcosCharm ?? 0));
    const rolls = 1 + milestones;
    const shinyOdds = Math.round(1 / (1 - (1 - 1 / 4096) ** rolls));
    return { generation, label: `Geração ${generationNames[generation - 1] ?? generation}`, milestones, shinyOdds, catchMultiplier: 1 + milestones * .03 };
  });
  const shinyDescription = byGeneration.map((entry) => entry.milestones
    ? `${entry.label}: +${entry.milestones} rolagem(ns), cerca de 1 em ${formatShinyOdds(entry.shinyOdds)}`
    : `${entry.label}: sem rolagem extra (1 em 4.096)`).join(' · ');
  const catchDescription = byGeneration.some((entry) => entry.milestones)
    ? byGeneration.map((entry) => `${entry.label}: +${entry.milestones * 3}% (×${formatMultiplier(entry.catchMultiplier)})`).join(' · ')
    : 'Sem marcos de desafio: +0% de chance em todas as gerações.';

  return {
    'lucky-egg': `×${formatMultiplier(eggMultiplier)} de experiência por batalha (+${Math.round((eggMultiplier - 1) * 100)}%).`,
    'amulet-coin': `×${formatMultiplier(coinMultiplier)} de dinheiro nas vitórias (+${Math.round((coinMultiplier - 1) * 100)}%).`,
    'shiny-charm': shinyDescription || 'Sem progresso de desafios: 1 em 4.096, sem rolagens extras.',
    'catching-charm': catchDescription,
  };
}
