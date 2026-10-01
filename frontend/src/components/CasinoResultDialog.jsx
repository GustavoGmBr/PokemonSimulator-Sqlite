import * as Dialog from '@radix-ui/react-dialog';
import { Check, CircleDollarSign, Ticket, X } from 'lucide-react';
import { money, factor } from './casinoShared';
import { Button } from './ui/button';

const gameNames = {
  slots: 'Caça-níqueis', roleta: 'Roleta Pokémon', voltorb: 'Voltorb Flip',
  pokejack: 'Pokejack', corrida: 'Pokémon Race', fortune: 'Wheel of Fortune',
  piplup: 'Pula Piplup', fichas: 'Compra de fichas', itens: 'Loja do cassino',
  'rodada/desistir': 'Rodada encerrada',
};

function resultMessage(result) {
  if (result.jogo === 'fichas') return 'As fichas foram adicionadas à sua carteira.';
  if (result.jogo === 'itens') return `Compra concluída por ${money(result.custo)} fichas.`;
  if (result.resultado === 'voltorb') return 'Um Voltorb explodiu! A aposta da rodada foi perdida.';
  if (result.resultado === 'queda') return 'Piplup caiu no gelo e perdeu a aposta da rodada.';
  if (result.resultado === 'empate') return 'Empate: a aposta em fichas foi devolvida.';
  if (result.resultado === 'desistencia') return 'Rodada abandonada; a entrada não foi devolvida.';
  if (result.resultado === 'pokejack') return 'Pokejack natural! 21 pontos com as duas cartas iniciais.';
  if (result.resultado === 'vitoria' || result.resultado === 'saque') return result.resultado === 'saque' ? 'Você sacou o prêmio da travessia.' : 'Você venceu esta rodada!';
  if (result.resultado === 'derrota') return 'A banca venceu esta mão.';
  if (result.vencedor !== undefined) return result.premio > 0 || result.pokemonPremio?.ganho > 0 ? 'Seu Pokémon cruzou a linha de chegada primeiro!' : 'O Pokémon escolhido não venceu a corrida.';
  if (result.multiplicador !== undefined) return `A roda parou em ${factor(result.multiplicador)}.`;
  if (result.linhas) return result.linhas.length ? `${result.linhas.length} ${result.linhas.length === 1 ? 'linha premiada' : 'linhas premiadas'}.` : 'Nenhuma trinca desta vez.';
  if (result.resultado?.numero !== undefined) return `A roleta parou no ${result.resultado.numero} · ${result.resultado.cor}.`;
  if (result.rodada === null) return 'Compra concluída.';
  return 'Resultado da rodada.';
}

export function CasinoResultDialog({ open, onOpenChange, result, racers = [] }) {
  if (!result) return null;
  const game = gameNames[result.jogo] ?? 'Pokécassino';
  const message = resultMessage(result);
  const cost = result.custo ?? result.aposta;
  const tokenPrize = result.premio ?? 0;
  const pokemonPrize = result.pokemonPremio;
  const purchase = ['fichas', 'itens'].includes(result.jogo);
  const won = purchase || tokenPrize > 0 || (pokemonPrize?.ganho ?? 0) > 0;
  const hasContestWinner = result.vencedor !== undefined && racers[result.vencedor];
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content casino-result-dialog">
        <header><span className={`casino-result-mark ${won ? 'is-win' : ''}`}>{won ? <Check size={22} /> : <Ticket size={22} />}</span><Dialog.Close className="casino-result-close" aria-label="Fechar resultado"><X size={20} /></Dialog.Close></header>
        <span className="casino-eyebrow">{game.toUpperCase()}</span>
        <Dialog.Title>{purchase ? 'Compra realizada' : won ? 'Prêmio da rodada' : 'Rodada concluída'}</Dialog.Title>
        <Dialog.Description>{message}{hasContestWinner ? ` Vencedor: ${racers[result.vencedor].nome}.` : ''}</Dialog.Description>
        {result.linhas?.length > 0 && <ul className="casino-result-lines">{result.linhas.map((line) => <li key={line.linha}>Linha {line.linha} · {factor(line.multiplicador)} · {money(line.premio)} fichas{line.coringas ? ` · Ditto coringa ×${line.coringas}` : ''}</li>)}</ul>}
        {result.resultado?.numero !== undefined && <p className="casino-result-detail">Número {result.resultado.numero} · {result.resultado.pokemon}</p>}
        {result.multiplicador !== undefined && <p className="casino-result-detail">Multiplicador: {factor(result.multiplicador)}</p>}
        {cost !== undefined && <div className="casino-result-currency"><span>Entrada em fichas</span><b>{money(cost)}</b><span>Prêmio em fichas</span><b>{money(tokenPrize)}</b></div>}
        {pokemonPrize && <div className={`casino-result-pokemon ${pokemonPrize.ganho ? 'won' : 'lost'}`}><strong>{pokemonPrize.ganho ? 'Prêmio da aposta Pokémon' : 'Pokémon perdido'}</strong><span>{pokemonPrize.ganho ? `${pokemonPrize.nome}: ${money(pokemonPrize.ganho)} ₽ + ${money(pokemonPrize.fichas)} fichas` : `${pokemonPrize.nome} não voltou para a coleção.`}</span></div>}
        {result.moedas !== undefined && <p className="casino-result-balance"><CircleDollarSign size={17} /> Saldo atualizado: {money(result.moedas)} ₽ · {money(result.fichas)} fichas</p>}
        <div className="casino-result-actions"><Dialog.Close asChild><Button>Continuar</Button></Dialog.Close></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
