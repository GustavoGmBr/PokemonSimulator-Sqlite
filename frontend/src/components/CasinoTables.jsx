import { useState } from 'react';
import { assetUrl } from '../lib/api';
import { PokemonWagerPicker } from './CasinoWagerPicker';
import { CasinoWheel, segmentAngles, winningRotation } from './CasinoWheel';
import { BetInput, BetList, FlipCard, NumberInput, PokemonToken, RoundResult, factor, money, pause, pokemonNames, pokemonStake, roundToken, validBet } from './casinoShared';

const SYMBOLS=['mew','bar','pikachu','charmander','bulbasaur','squirtle','magikarp','poke-ball','ditto','blank'];
const lineNames=['horizontal superior','horizontal central','horizontal inferior','diagonal ↘','diagonal ↗'];
function SlotSymbol({ name }) {
  if(name === 'bar') return <span className="slot-token slot-bar" aria-label="Moltres, Zapdos e Articuno"><span className="slot-birds">{[146,145,144].map(id=><img key={id} src={assetUrl(`/assets/pokemon/${id}-front.png`)} alt="" />)}</span><b>BAR</b></span>;
  if(name === 'poke-ball') return <span className="slot-token slot-poke-ball"><img src={assetUrl('/assets/items/poke-ball.png')} alt="" /></span>;
  if(name === 'pikachu' || name === 'charmander' || name === 'bulbasaur' || name === 'squirtle' || name === 'mew' || name === 'magikarp' || name === 'ditto') return <PokemonToken name={{ pikachu:'Pikachu',charmander:'Charmander',bulbasaur:'Bulbasaur',squirtle:'Squirtle',mew:'Mew',magikarp:'Magikarp',ditto:'Ditto' }[name]} />;
  return <span className={`slot-token slot-${name}`}>·</span>;
}
export function SlotGame({ wallet, bet, setBet, busy, play, result, pokemonWagerId }) {
  const [symbols,setSymbols]=useState(Array(9).fill('blank')), [rolling,setRolling]=useState(false),[offset,setOffset]=useState(0);
  const winning=new Set(result?.linhas?.flatMap(line => line.posicoes) ?? []);
  async function spin() {
    setRolling(true); setOffset(0);
    const data=await play('slots',{ aposta:Number(bet),...pokemonStake(pokemonWagerId) },async next => {
      setSymbols(next.simbolos);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      setOffset(SYMBOLS.length * 4); await pause(2250);
    });
    setRolling(false); setOffset(0); if(data) setSymbols(data.simbolos);
  }
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">TRÊS ROLOS · CINCO LINHAS</span><h2>Caça-níqueis</h2></div><span className="game-badge">✦ Ditto é o coringa</span></div>
    <div className={`slot-machine ${rolling ? 'slots-rolling' : ''}`} aria-label="Rolos do caça-níqueis" aria-busy={busy}><div className="slot-machine-lights">✦ POKÉ JACKPOT ✦</div><div className="casino-reels">{[0,1,2].map(col => {
      const final=[symbols[col],symbols[col+3],symbols[col+6]], strip=rolling ? [...Array.from({ length:4 },()=>SYMBOLS).flat(),...final] : final;
      return <div className="slot-reel" key={col}><div className="slot-strip" style={{ transform:`translateY(calc(-${offset} * var(--slot-height)))`, '--reel-delay':`${col * 120}ms` }}>{strip.map((symbol,row) => <div key={row} className={`slot-cell ${!rolling && winning.has(row*3+col) ? 'slot-winner' : ''}`}><SlotSymbol name={symbol} /></div>)}</div></div>;
    })}</div></div>
    <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={spin}>{busy ? 'Rolos girando…' : 'Girar'}</button></div>
    <RoundResult result={result}>{result?.linhas?.length ? `${result.linhas.length} ${result.linhas.length === 1 ? 'linha premiada' : 'linhas premiadas'}!` : 'Sem combinação nesta rodada'}</RoundResult>
    {result?.linhas?.length > 0 && <ul className="slot-win-list">{result.linhas.map(line => <li key={line.linha}>Linha {line.linha} · {lineNames[line.linha-1]} · {factor(line.multiplicador)} = {money(line.premio)} fichas{line.coringas ? ` · ${line.coringas} coringa(s)` : ''}</li>)}</ul>}
    <details className="casino-rules" open><summary>Como os resultados pagam</summary><p>As três horizontais e as duas diagonais estão sempre ativas. Cada linha usa o valor inteiro da aposta; os prêmios das linhas são somados. Ditto substitui qualquer símbolo em uma combinação. Três Ditto pagam 5×.</p><div className="slot-paytable">{[['mew','Três Mew','50×'],['bar','Três símbolos BAR (Moltres, Zapdos e Articuno)','20×'],['charmander','Três iniciais iguais','10×'],['pikachu','Três Pikachu','5×'],['magikarp','Três Magikarp','1×'],['poke-ball','Poké Bola na primeira coluna da linha','0,5×']].map(([symbol,label,mult]) => <div key={symbol}><SlotSymbol name={symbol} /><span>{label}</span><b>{mult}</b></div>)}</div><p>Os iniciais são Charmander, Bulbasaur e Squirtle; cada trinca paga 10×. Com uma Poké Bola na primeira posição, a linha paga metade mesmo sem trinca. Ditto nessa posição também pode substituí-la. Valores fracionários são arredondados para baixo por linha.</p></details>
  </section>;
}

export function RouletteGame({ wallet, bet, setBet, busy, play, result, members, market, catalog, pokemonWagerId, setPokemonWagerId }) {
  const [type,setType]=useState('numero'),[number,setNumber]=useState(0),[color,setColor]=useState('vermelho'),[parity,setParity]=useState('par'),[range,setRange]=useState('baixa'),[dozen,setDozen]=useState(1),[pokemon,setPokemon]=useState('Pikachu'),[bets,setBets]=useState([]),[rotation,setRotation]=useState(0);
  const red=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const pocketColor=n=>n===0 ? 'verde' : red.has(n) ? 'vermelho' : 'preto';
  const mascotByNumber=new Map(wallet.regras.casasRoleta.map(entry=>[entry.numero,entry]));
  const segments=wallet.regras.roleta.map(n=>({ ...mascotByNumber.get(n), label:String(n),weight:1,color:({ vermelho:'#963c42',preto:'#20282b',verde:'#2c7f57' })[pocketColor(n)] }));
  const selection=type==='numero' ? { tipo:type,numero:Number(number) } : type==='cor' ? { tipo:type,cor:color } : type==='paridade' ? { tipo:type,paridade:parity } : type==='faixa' ? { tipo:type,faixa:range } : type==='duzia' ? { tipo:type,duzia:Number(dozen) } : { tipo:type,pokemon };
  const cost=bets.reduce((sum,b)=>sum+b.valor,0), selected=members.find(m=>m.id===pokemonWagerId);
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">MODELO EUROPEU · ZERO ÚNICO</span><h2>Roleta Pokémon</h2></div><span className="game-badge">37 casas</span></div><p>De 0 a 36: 18 casas vermelhas, 18 pretas e um zero verde. O zero não conta como par, ímpar, faixa ou dúzia.</p>
    <div className="roulette-layout"><CasinoWheel segments={segments} rotation={rotation} busy={busy} /><div className="roulette-betting-grid" role="group" aria-label="Números da roleta">{Array.from({ length:37 },(_,n)=>{ const mascot=mascotByNumber.get(n); return <button type="button" key={n} title={`${n} · ${mascot.pokemon}`} className={`roulette-number ${pocketColor(n)} ${type==='numero' && Number(number)===n ? 'selected' : ''} ${result?.resultado?.numero===n ? 'pocket-winning' : ''}`} aria-label={`Apostar no número ${n} · ${mascot.pokemon}`} aria-pressed={type==='numero' && Number(number)===n} disabled={busy} onClick={()=>{ setType('numero'); setNumber(n); }}><img src={assetUrl(`/assets/pokemon/${mascot.especieId}-front.png`)} alt="" loading="lazy" /><b>{n}</b></button>; })}</div></div>
    <div className="casino-form"><label>Tipo de palpite<select value={type} onChange={e=>setType(e.target.value)}><option value="numero">Número · 36×</option><option value="cor">Cor · 2× (verde: 36×)</option><option value="paridade">Par ou ímpar · 2×</option><option value="faixa">1–18 ou 19–36 · 2×</option><option value="duzia">Dúzia · 3×</option><option value="pokemon">Grupo Pokémon · 4×</option></select></label>{type==='numero' && <NumberInput label="Número escolhido" value={number} onChange={setNumber} min={0} max={36} />}{type==='cor' && <label>Cor<select value={color} onChange={e=>setColor(e.target.value)}>{['vermelho','preto','verde'].map(c=><option key={c}>{c}</option>)}</select></label>}{type==='paridade' && <label>Paridade<select value={parity} onChange={e=>setParity(e.target.value)}><option value="par">Par</option><option value="impar">Ímpar</option></select></label>}{type==='faixa' && <label>Faixa<select value={range} onChange={e=>setRange(e.target.value)}><option value="baixa">1 a 18</option><option value="alta">19 a 36</option></select></label>}{type==='duzia' && <label>Dúzia<select value={dozen} onChange={e=>setDozen(e.target.value)}>{[1,2,3].map(n=><option key={n} value={n}>{(n-1)*12+1} a {n*12}</option>)}</select></label>}{type==='pokemon' && <label>Pokémon<select value={pokemon} onChange={e=>setPokemon(e.target.value)}>{pokemonNames.map(n=><option key={n}>{n}</option>)}</select></label>}<NumberInput label="Fichas nesta aposta" value={bet} onChange={setBet} min={5} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || (type==='numero' && (!Number.isInteger(Number(number)) || number<0 || number>36)) || bets.length>=24} onClick={()=>setBets(current=>[...current,{ ...selection,valor:Number(bet) }])}>Adicionar aposta</button></div>
    <BetList bets={bets} busy={busy} remove={index=>setBets(current=>current.filter((_,i)=>i!==index))} />
    <details className="casino-rules"><summary>Pokémon das casas e aposta de coleção</summary><p>Ímpares vermelhos: Charmander · ímpares pretos: Squirtle · pares vermelhos: Bulbasaur · pares pretos: Pikachu · zero: Mew. Apostar em um Pokémon da coleção continua usando o seu grupo de casas; o zero sempre representa Mew.</p><PokemonWagerPicker members={members} market={market} catalog={catalog} selectedId={wagerId} onSelect={setWagerId} busy={busy || !!wallet.rodada} selection={selection} /></details>
    <button disabled={busy || !!wallet.rodada || (!bets.length && !pokemonWagerId) || cost>wallet.fichas || !!pokemonWagerId && (members.length<2 || selected?.favorito)} onClick={async()=>{ const data=await play('roleta',{ apostas:bets,...(pokemonWagerId ? { pokemonAposta:{ pokemonId:pokemonWagerId,...selection } } : {}) },async next=>{ const i=wallet.regras.roleta.indexOf(next.resultado.numero); setRotation(current=>winningRotation(current,segmentAngles(segments)[i].center)); await pause(2450); }); if(data)setBets([]); }}>{busy ? 'Roleta girando…' : `Girar roleta · ${money(cost)} fichas${pokemonWagerId ? ' + Pokémon' : ''}`}</button>
    <RoundResult result={result}>{result?.resultado && `Número ${result.resultado.numero} · ${result.resultado.cor}${result.pokemonPremio ? ` · prêmio do Pokémon: ${money(result.pokemonPremio.ganho)} ₽` : ''}`}</RoundResult>
  </section>;
}

export function VoltorbGame({ wallet, bet, setBet, busy, play, result, pokemonWagerId }) {
  const [visual,setVisual]=useState(null),active=wallet.rodada?.jogo === 'voltorb' ? wallet.rodada : null, table=visual ?? active ?? result?.mesa;
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">ATÉ CINCO ESCOLHAS · BÔNUS DE LINHA</span><h2>Voltorb Flip</h2></div><span className="game-badge">0 · 0,5 · 1 · 2 · 3 · 5×</span></div><p>Abra até cinco cartas e receba a aposta multiplicada pela soma delas. Complete uma linha horizontal ou vertical para dobrar o retorno. Se encontrar um Voltorb, perde a rodada e toda a aposta.</p><p className="casino-muted">Há 6 Voltorbs, 8 cartas de 0,5×, 6 de 1×, 3 de 2×, uma de 3× e uma de 5×. Diagonais não recebem bônus.</p>
    {!active && <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={async()=>{ setVisual(null); await play('voltorb',{ aposta:Number(bet),...pokemonStake(pokemonWagerId) }); }}>Iniciar rodada</button></div>}
    <div className={`voltorb-card-grid ${result?.bonusLinha===2 ? 'completed-line' : ''}`} aria-label="Tabuleiro Voltorb de 25 cartas">{Array.from({ length:25 },(_,i)=>{
      const value=table?.casas[i], open=value!==null && value!==undefined;
      return <FlipCard key={`${table?.id ?? 'empty'}-${i}`} open={open} selected={table?.abertas.includes(i)} disabled={busy || !active || open} label={`Carta Voltorb ${i+1}${open ? `: ${factor(value)}` : ''}`} onClick={()=>play('voltorb/virar',{ ...roundToken(active),indice:i },async data=>{ setVisual(data.rodada ?? data.mesa); await pause(350); })}>{value===0 ? <><img src={assetUrl('/assets/pokemon/100-front.png')} alt="" /><b>0×</b></> : <b>{factor(value ?? 0)}</b>}</FlipCard>;
    })}</div>
    {table && <p className="voltorb-progress">{table.abertas.length} de até 5 cartas · soma {factor(table.soma)}{active ? ` · mais ${table.restantes} ${table.restantes===1 ? 'escolha' : 'escolhas'}` : result?.resultado==='voltorb' ? ' · Voltorb encontrado: aposta perdida!' : table.bonusLinha===2 ? ' · linha completa: bônus 2×!' : ''}</p>}
    <RoundResult result={result}>{result?.resultado==='voltorb' ? 'Você encontrou um Voltorb! A aposta foi perdida.' : result?.bonusLinha===2 ? 'Linha completa! A soma das cartas dobrou.' : 'Cinco cartas abertas'}</RoundResult>
  </section>;
}
