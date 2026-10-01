import { assetUrl } from '../lib/api';

export const money = amount => Number(amount ?? 0).toLocaleString('pt-BR');
export const factor = value => `${Number(value).toLocaleString('pt-BR')}×`;
export const pokemonNames = ['Pikachu', 'Bulbasaur', 'Charmander', 'Squirtle', 'Mew', 'Mewtwo', 'Articuno', 'Zapdos', 'Moltres', 'Magikarp', 'Ditto'];
export const pokemonId = { Pikachu:25, Bulbasaur:1, Charmander:4, Squirtle:7, Mew:151, Mewtwo:150, Articuno:144, Zapdos:145, Moltres:146, Magikarp:129, Ditto:132 };
export const betLabel = bet => bet.multiplicador !== undefined ? factor(bet.multiplicador)
  : bet.tipo === 'exata' ? `${bet.pokemon} · ${bet.cor ?? bet.numero}`
    : bet.tipo === 'dupla' ? `${bet.pokemon} · ${bet.numero} ou ${bet.numero + 1}`
      : bet.tipo === 'numero' ? `Número ${bet.numero}` : bet.tipo === 'pokemon' ? bet.pokemon
        : bet.tipo === 'paridade' ? (bet.paridade === 'par' ? 'Par' : 'Ímpar')
          : bet.tipo === 'faixa' ? (bet.faixa === 'baixa' ? '1 a 18' : '19 a 36')
            : bet.tipo === 'duzia' ? `${bet.duzia}ª dúzia` : bet.cor;
export const roundToken = round => ({ rodadaId:round.id, versao:round.versao });
export const pokemonStake = pokemonId => pokemonId ? { pokemonAposta:{ pokemonId } } : {};
export const pause = ms => new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));
export const validBet = (value, allowZero = false) => Number.isInteger(Number(value)) && Number(value) >= (allowZero ? 0 : 5) && Number(value) <= 20_000_000;
export function NumberInput({ label, value, onChange, min=1, max=20_000_000, disabled=false }) {
  return <label className="casino-number">{label}<input type="number" min={min} max={max} step="1" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>;
}
export function PokemonToken({ name }) { return <span className="casino-pokemon"><img src={assetUrl(`/assets/pokemon/${pokemonId[name]}-front.png`)} alt="" />{name}</span>; }
export function BetList({ bets, remove, busy }) { return bets.length ? <div className="casino-bets">{bets.map((entry,index) => <div key={index}><span>{betLabel(entry)} · {money(entry.valor)} fichas</span><button type="button" disabled={busy} onClick={() => remove(index)} aria-label={`Remover aposta ${index + 1}`}>×</button></div>)}</div> : <p className="casino-empty">Nenhuma aposta adicionada.</p>; }
export function BetInput({ bet, setBet, allowZero = false, disabled=false }) { return <NumberInput label={allowZero ? 'Aposta em fichas (opcional)' : 'Aposta em fichas'} value={bet} onChange={setBet} min={allowZero ? 0 : 5} disabled={disabled} />; }
export function RoundResult({ result, children }) {
  if (result?.premio === undefined) return null;
  const stake = result.custo ?? result.aposta, difference = result.premio - stake;
  return <div className={`casino-result ${difference > 0 ? 'result-win' : ''}`} role="status"><strong>{result.resultado === 'desistencia' ? 'Rodada abandonada · entrada perdida' : children ?? 'Rodada concluída'}</strong><span>Entrada: {money(stake)} · retorno: {money(result.premio)} fichas</span><small>Saldo da rodada: {difference > 0 ? '+' : ''}{money(difference)} fichas</small></div>;
}
export function FlipCard({ value, open, onClick, disabled, label, selected, children }) {
  return <button type="button" className={`casino-flip-card ${open ? 'flipped' : ''} ${selected ? 'chosen-card' : ''}`} disabled={disabled} onClick={onClick} aria-label={label}><span className="flip-inner"><span className="flip-back"><span className="card-ball" />?</span><span className="flip-front">{children ?? value}</span></span></button>;
}
export function PlayingCard({ card, index=0 }) {
  if (!card) return <div className="playing-card card-hidden" aria-label="Carta da banca oculta"><span className="card-ball" /></div>;
  const label = ({ 1:'A', 11:'J', 12:'Q', 13:'K' })[card.valor] ?? card.valor;
  return <div className={`playing-card ${['♥','♦'].includes(card.naipe) ? 'red-suit' : ''}`} style={{ '--card-delay':`${index * 70}ms` }} aria-label={`${label} ${card.naipe}`}><small>{label}<br />{card.naipe}</small><b>{card.naipe}</b><small>{card.naipe}<br />{label}</small></div>;
}
