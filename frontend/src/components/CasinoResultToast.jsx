import { useEffect, useState } from 'react';
import { Check, CircleDollarSign, Ticket, X } from 'lucide-react';
import { money, factor } from './casinoShared';

const gameNames = {
  slots: 'Caça-níqueis', roleta: 'Roleta Pokémon', voltorb: 'Voltorb Flip',
  pokejack: 'Pokejack', corrida: 'Pokémon Race', fortune: 'Wheel of Fortune',
  piplup: 'Pula Piplup', 'slots-auto': 'Rolagem automática', fichas: 'Compra de fichas', itens: 'Loja do cassino',
  'rodada/desistir': 'Rodada encerrada',
};

function resultMessage(result) {
  if (result.autoResumo) return `${result.autoResumo.jogadas} ${result.autoResumo.jogadas === 1 ? 'giro automático concluído' : 'giros automáticos concluídos'}.`;
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

export function CasinoResultToast({ open, onDismiss, result, racers = [] }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    setPaused(false);
  }, [result]);
  useEffect(() => {
    if (!open || paused) return undefined;
    const timeout = window.setTimeout(onDismiss, 12000);
    return () => window.clearTimeout(timeout);
  }, [open, paused, result, onDismiss]);
  if (!open || !result) return null;

  const game = gameNames[result.jogo] ?? 'Pokécassino';
  const message = resultMessage(result);
  const cost = result.custo ?? result.aposta;
  const tokenPrize = result.premio ?? 0;
  const pokemonPrize = result.pokemonPremio;
  const purchase = ['fichas', 'itens'].includes(result.jogo);
  const won = purchase || tokenPrize > 0 || (pokemonPrize?.ganho ?? 0) > 0;
  const hasContestWinner = result.vencedor !== undefined && racers[result.vencedor];
  return <aside className={`casino-result-toast ${won ? 'is-win' : 'is-loss'}`} role="status" aria-live="polite" aria-atomic="true" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <div className="casino-toast-progress" aria-hidden="true" />
    <header><span className="casino-result-mark">{won ? <Check size={19} /> : <Ticket size={19} />}</span><div><span className="casino-eyebrow">{game.toUpperCase()}</span><strong>{result.autoResumo ? 'Resumo da rolagem' : purchase ? 'Compra realizada' : won ? 'Você ganhou!' : 'Resultado da rodada'}</strong></div><button type="button" className="casino-result-close" aria-label="Fechar notificação" onClick={onDismiss}><X size={18} /></button></header>
    <p className="casino-toast-message">{message}{hasContestWinner ? ` Vencedor: ${racers[result.vencedor].nome}.` : ''}</p>
    {result.linhas?.length > 0 && <ul className="casino-result-lines">{result.linhas.map((line) => <li key={line.linha}>Linha {line.linha} · {factor(line.multiplicador)} · {money(line.premio)} fichas{line.coringas ? ` · Ditto coringa ×${line.coringas}` : ''}</li>)}</ul>}
    {result.resultado?.numero !== undefined && <p className="casino-result-detail">Número {result.resultado.numero} · {result.resultado.pokemon}</p>}
    {result.multiplicador !== undefined && <p className="casino-result-detail">Multiplicador: {factor(result.multiplicador)}</p>}
    {cost !== undefined && <div className="casino-result-currency">{result.autoResumo ? <><span>Total gasto</span><b>{money(cost)} fichas</b><span>Total ganho</span><b>{money(tokenPrize)} fichas</b></> : <><span>Entrada em fichas</span><b>{money(cost)}</b><span>Prêmio em fichas</span><b>{money(tokenPrize)}</b></>}</div>}
    {pokemonPrize && <div className={`casino-result-pokemon ${pokemonPrize.ganho ? 'won' : 'lost'}`}><strong>{pokemonPrize.ganho ? 'Prêmio da aposta Pokémon' : 'Pokémon perdido'}</strong><span>{pokemonPrize.ganho ? `${pokemonPrize.nome}: ${money(pokemonPrize.ganho)} ₽ + ${money(pokemonPrize.fichas)} fichas` : `${pokemonPrize.nome} não voltou para a coleção.`}</span></div>}
    {result.moedas !== undefined && <p className="casino-result-balance"><CircleDollarSign size={17} /> Saldo: {money(result.moedas)} ₽ · {money(result.fichas)} fichas</p>}
  </aside>;
}
