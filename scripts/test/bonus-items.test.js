import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBonusItemDescriptions } from '../../frontend/src/lib/bonus-items.js';

test('descreve multiplicadores base dos itens de bônus sem gerações concluídas', () => {
  const descriptions = getBonusItemDescriptions([{ geracao: 1, concluida: false, marcosCharm: 0 }]);
  assert.equal(descriptions['lucky-egg'], '×2,00 de experiência por batalha (+100%).');
  assert.equal(descriptions['amulet-coin'], '×2,00 de dinheiro nas vitórias (+100%).');
  assert.match(descriptions['shiny-charm'], /sem rolagem extra \(1 em 4\.096\)/);
  assert.equal(descriptions['catching-charm'], 'Sem marcos de desafio: +0% de chance em todas as gerações.');
});

test('mostra o progresso de gerações concluídas e aplica os limites do Ovo e Amuleto', () => {
  const regions = Array.from({ length: 9 }, (_, index) => ({ geracao: index + 1, concluida: index > 0, marcosCharm: 0 }));
  const descriptions = getBonusItemDescriptions(regions);
  assert.equal(descriptions['lucky-egg'], '×4,00 de experiência por batalha (+300%).');
  assert.equal(descriptions['amulet-coin'], '×5,00 de dinheiro nas vitórias (+400%).');
});

test('usa o maior marco da geração ao calcular shiny e captura', () => {
  const descriptions = getBonusItemDescriptions([
    { geracao: 5, concluida: false, marcosCharm: 2 },
    { geracao: 5, concluida: false, marcosCharm: 6 },
  ]);
  assert.match(descriptions['shiny-charm'], /Geração V: \+6 rolagem/);
  assert.match(descriptions['catching-charm'], /Geração V: \+18% \(×1,18\)/);
});
