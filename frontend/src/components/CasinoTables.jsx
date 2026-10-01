import { useState } from 'react';
import { assetUrl } from '../lib/api';
import { PokemonWagerPicker } from './CasinoWagerPicker';
import { CasinoWheel, segmentAngles, winningRotation } from './CasinoWheel';
import { BetInput, BetList, FlipCard, NumberInput, PokemonToken, RoundResult, factor, money, pause, pokemonNames, roundToken, validBet } from './casinoShared';

const SYMBOLS=['master-ball','bar','pikachu','charmander','replay','cherry','wild','blank'];
const lineNames=['horizontal superior','horizontal central','horizontal inferior','diagonal ↘','diagonal ↗'];
function SlotSymbol({ name }) {
  if(name === 'master-ball') return <span className="slot-token slot-master"><img src={assetUrl('/assets/items/master-ball.png')} alt="" /><b>7</b></span>;
  if(name === 'pikachu' || name === 'charmander') return <PokemonToken name={name === 'pikachu' ? 'Pikachu' : 'Charmander'} />;
  return <span className={`slot-token slot-${name}`}>{({ bar:'BAR', replay:'↻', cherry:'🍒', wild:'✦', blank:'·' })[name]}{name === 'wild' && <small>CORINGA</small>}</span>;
}
export function SlotGame({ wallet, bet, setBet, busy, play, result }) {
  const [symbols,setSymbols]=useState(Array(9).fill('blank')), [rolling,setRolling]=useState(false),[offset,setOffset]=useState(0);
  const winning=new Set(result?.linhas?.flatMap(line => line.posicoes) ?? []);
  async function spin() {
    setRolling(true); setOffset(0);
    const data=await play('slots',{ aposta:Number(bet) },async next => {
      setSymbols(next.simbolos);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      setOffset(SYMBOLS.length * 4); await pause(2250);
    });
    setRolling(false); setOffset(0); if(data) setSymbols(data.simbolos);
  }
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">TRÊS ROLOS · CINCO LINHAS</span><h2>Caça-níqueis</h2></div><span className="game-badge">✦ Coringa novo</span></div>
    <div className={`slot-machine ${rolling ? 'slots-rolling' : ''}`} aria-label="Rolos do caça-níqueis" aria-busy={busy}><div className="slot-machine-lights">✦ POKÉ JACKPOT ✦</div><div className="casino-reels">{[0,1,2].map(col => {
      const final=[symbols[col],symbols[col+3],symbols[col+6]], strip=rolling ? [...Array.from({ length:4 },()=>SYMBOLS).flat(),...final] : final;
      return <div className="slot-reel" key={col}><div className="slot-strip" style={{ transform:`translateY(calc(-${offset} * var(--slot-height)))`, '--reel-delay':`${col * 120}ms` }}>{strip.map((symbol,row) => <div key={row} className={`slot-cell ${!rolling && winning.has(row*3+col) ? 'slot-winner' : ''}`}><SlotSymbol name={symbol} /></div>)}</div></div>;
    })}</div></div>
    <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={spin}>{busy ? 'Rolos girando…' : 'Girar'}</button></div>
    <RoundResult result={result}>{result?.linhas?.length ? `${result.linhas.length} ${result.linhas.length === 1 ? 'linha premiada' : 'linhas premiadas'}!` : 'Sem combinação nesta rodada'}</RoundResult>
    {result?.linhas?.length > 0 && <ul className="slot-win-list">{result.linhas.map(line => <li key={line.linha}>Linha {line.linha} · {lineNames[line.linha-1]} · {factor(line.multiplicador)} = {money(line.premio)} fichas{line.coringas ? ` · ${line.coringas} coringa(s)` : ''}</li>)}</ul>}
    <details className="casino-rules" open><summary>Como os resultados pagam</summary><p>As três horizontais e as duas diagonais estão sempre ativas. Cada linha usa o valor inteiro da aposta; os prêmios das linhas são somados. O coringa substitui qualquer símbolo em uma combinação. Três coringas pagam 5×.</p><div className="slot-paytable">{[['master-ball','Três Master Bolas','100×'],['bar','Três BAR','30×'],['pikachu','Três Pikachu ou três Charmander','5×'],['replay','Três replay','1×'],['cherry','Cereja na primeira coluna da linha','0,5×']].map(([symbol,label,mult]) => <div key={symbol}><SlotSymbol name={symbol} /><span>{label}</span><b>{mult}</b></div>)}</div><p>Com uma cereja na primeira posição, a linha paga metade mesmo sem trinca. Um coringa nessa posição pode substituí-la se houver uma cereja na linha. Valores fracionários são arredondados para baixo por linha.</p></details>
  </section>;
}

export function CardsGame({ wallet, bet, setBet, busy, play, result }) {
  const [type,setType]=useState('exata'),[pokemon,setPokemon]=useState('Pikachu'),[number,setNumber]=useState('1'),[bets,setBets]=useState([]),[visual,setVisual]=useState(null),[revealed,setRevealed]=useState([]);
  const active=wallet.rodada?.jogo === 'cartas' ? wallet.rodada : null, table=visual ?? active ?? result?.mesa;
  const cost=bets.reduce((sum,bet)=>sum+bet.valor,0);
  function add() { if(!validBet(bet)) return; const entry={ tipo:type,valor:Number(bet) }; if(type !== 'numero') entry.pokemon=pokemon; if(type !== 'pokemon') entry.numero=Number(number); setBets(current=>[...current,entry]); }
  async function flip(index) {
    if(active) await play('cartas/virar',{ ...roundToken(active),indice:index },async data=>{ setVisual(data.mesa); setRevealed(data.mesa.abertas); await pause(450); });
    else setRevealed(current=>[...current,index]);
  }
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">ESCOLHA UMA CARTA NA MESA</span><h2>Jogo de cartas</h2></div><span className="game-badge">24 cartas</span></div><p>Escolha seus palpites, distribua o baralho e clique em uma carta. A primeira escolha decide o prêmio; depois você pode virar as outras para conferir a mesa.</p>
    {!active && <><div className="casino-form"><label>Palpite<select value={type} onChange={e=>{ setType(e.target.value); setNumber('1'); }}><option value="exata">Carta exata · 24×</option><option value="dupla">Dois números vizinhos · 12×</option><option value="numero">Número · 6×</option><option value="pokemon">Pokémon · 4×</option></select></label>{type !== 'numero' && <label>Pokémon<select value={pokemon} onChange={e=>setPokemon(e.target.value)}>{pokemonNames.map(name=><option key={name}>{name}</option>)}</select></label>}{type !== 'pokemon' && <label>Número<select value={number} onChange={e=>setNumber(e.target.value)}>{Array.from({ length:type === 'dupla' ? 5 : 6 },(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>}<NumberInput label="Fichas neste palpite" value={bet} onChange={setBet} min={5} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || bets.length>=24} onClick={add}>Adicionar palpite</button></div><BetList bets={bets} busy={busy} remove={index=>setBets(current=>current.filter((_,i)=>i!==index))} /><button disabled={busy || !!wallet.rodada || !bets.length || cost>wallet.fichas} onClick={async()=>{ setVisual(null); setRevealed([]); if(await play('cartas',{ apostas:bets })) setBets([]); }}>Distribuir cartas · {money(cost)} fichas</button></>}
    <div className="casino-card-table"><div className="casino-card-grid" aria-label="Mesa com 24 cartas">{Array.from({ length:24 },(_,i)=>{
      const value=table?.casas[i], open=!!value && (active ? table.abertas.includes(i) : revealed.includes(i));
      return <FlipCard key={`${table?.id ?? 'empty'}-${i}`} value={value} open={open} selected={table?.abertas.includes(i)} disabled={busy || !table || open} label={`${open ? 'Carta' : 'Virar carta'} ${i+1}${open ? `: ${value.pokemon} ${value.numero}` : ''}`} onClick={()=>flip(i)}>{value && <><PokemonToken name={value.pokemon} /><b className="card-number">{value.numero}</b></>}</FlipCard>;
    })}</div><span className="table-caption">{active ? 'Sua aposta está na mesa. Escolha uma carta.' : table ? 'Rodada encerrada · só a primeira carta valeu para a aposta.' : 'Quatro Pokémon · números de 1 a 6'}</span></div>
    <RoundResult result={result}>{result?.carta && `Carta ${result.carta.pokemon} · ${result.carta.numero}`}</RoundResult>
  </section>;
}

export function RouletteGame({ wallet, bet, setBet, busy, play, result, members, market, catalog }) {
  const [type,setType]=useState('numero'),[number,setNumber]=useState(0),[color,setColor]=useState('vermelho'),[parity,setParity]=useState('par'),[range,setRange]=useState('baixa'),[dozen,setDozen]=useState(1),[pokemon,setPokemon]=useState('Pikachu'),[bets,setBets]=useState([]),[wagerId,setWagerId]=useState(''),[rotation,setRotation]=useState(0);
  const red=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const pocketColor=n=>n===0 ? 'verde' : red.has(n) ? 'vermelho' : 'preto';
  const segments=wallet.regras.roleta.map(n=>({ label:String(n),weight:1,color:({ vermelho:'#963c42',preto:'#20282b',verde:'#2c7f57' })[pocketColor(n)] }));
  const selection=type==='numero' ? { tipo:type,numero:Number(number) } : type==='cor' ? { tipo:type,cor:color } : type==='paridade' ? { tipo:type,paridade:parity } : type==='faixa' ? { tipo:type,faixa:range } : type==='duzia' ? { tipo:type,duzia:Number(dozen) } : { tipo:type,pokemon };
  const cost=bets.reduce((sum,b)=>sum+b.valor,0), selected=members.find(m=>m.id===wagerId);
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">MODELO EUROPEU · ZERO ÚNICO</span><h2>Roleta Pokémon</h2></div><span className="game-badge">37 casas</span></div><p>De 0 a 36: 18 casas vermelhas, 18 pretas e um zero verde. O zero não conta como par, ímpar, faixa ou dúzia.</p>
    <div className="roulette-layout"><CasinoWheel segments={segments} rotation={rotation} busy={busy} /><div className="roulette-betting-grid" role="group" aria-label="Números da roleta">{Array.from({ length:37 },(_,n)=><button type="button" key={n} className={`roulette-number ${pocketColor(n)} ${type==='numero' && Number(number)===n ? 'selected' : ''} ${result?.resultado?.numero===n ? 'pocket-winning' : ''}`} aria-label={`Apostar no número ${n}`} aria-pressed={type==='numero' && Number(number)===n} disabled={busy} onClick={()=>{ setType('numero'); setNumber(n); }}>{n}</button>)}</div></div>
    <div className="casino-form"><label>Tipo de palpite<select value={type} onChange={e=>setType(e.target.value)}><option value="numero">Número · 36×</option><option value="cor">Cor · 2× (verde: 36×)</option><option value="paridade">Par ou ímpar · 2×</option><option value="faixa">1–18 ou 19–36 · 2×</option><option value="duzia">Dúzia · 3×</option><option value="pokemon">Grupo Pokémon · 4×</option></select></label>{type==='numero' && <NumberInput label="Número escolhido" value={number} onChange={setNumber} min={0} max={36} />}{type==='cor' && <label>Cor<select value={color} onChange={e=>setColor(e.target.value)}>{['vermelho','preto','verde'].map(c=><option key={c}>{c}</option>)}</select></label>}{type==='paridade' && <label>Paridade<select value={parity} onChange={e=>setParity(e.target.value)}><option value="par">Par</option><option value="impar">Ímpar</option></select></label>}{type==='faixa' && <label>Faixa<select value={range} onChange={e=>setRange(e.target.value)}><option value="baixa">1 a 18</option><option value="alta">19 a 36</option></select></label>}{type==='duzia' && <label>Dúzia<select value={dozen} onChange={e=>setDozen(e.target.value)}>{[1,2,3].map(n=><option key={n} value={n}>{(n-1)*12+1} a {n*12}</option>)}</select></label>}{type==='pokemon' && <label>Pokémon<select value={pokemon} onChange={e=>setPokemon(e.target.value)}>{pokemonNames.map(n=><option key={n}>{n}</option>)}</select></label>}<NumberInput label="Fichas nesta aposta" value={bet} onChange={setBet} min={5} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || (type==='numero' && (!Number.isInteger(Number(number)) || number<0 || number>36)) || bets.length>=24} onClick={()=>setBets(current=>[...current,{ ...selection,valor:Number(bet) }])}>Adicionar aposta</button></div>
    <BetList bets={bets} busy={busy} remove={index=>setBets(current=>current.filter((_,i)=>i!==index))} />
    <details className="casino-rules"><summary>Grupos Pokémon e aposta de coleção</summary><p>Cada Pokémon representa nove números: Pikachu (1, 5, 9…), Bulbasaur (2, 6, 10…), Charmander (3, 7, 11…) e Squirtle (4, 8, 12…). O zero não pertence a nenhum grupo.</p><PokemonWagerPicker members={members} market={market} catalog={catalog} selectedId={wagerId} onSelect={setWagerId} busy={busy || !!wallet.rodada} selection={selection} /></details>
    <button disabled={busy || !!wallet.rodada || (!bets.length && !wagerId) || cost>wallet.fichas || !!wagerId && (members.length<2 || selected?.favorito)} onClick={async()=>{ const data=await play('roleta',{ apostas:bets,...(wagerId ? { pokemonAposta:{ pokemonId:wagerId,...selection } } : {}) },async next=>{ const i=wallet.regras.roleta.indexOf(next.resultado.numero); setRotation(current=>winningRotation(current,segmentAngles(segments)[i].center)); await pause(2450); }); if(data){setBets([]);setWagerId('');} }}>{busy ? 'Roleta girando…' : `Girar roleta · ${money(cost)} fichas${wagerId ? ' + Pokémon' : ''}`}</button>
    <RoundResult result={result}>{result?.resultado && `Número ${result.resultado.numero} · ${result.resultado.cor}${result.pokemonPremio ? ` · prêmio do Pokémon: ${money(result.pokemonPremio.ganho)} ₽` : ''}`}</RoundResult>
  </section>;
}

export function VoltorbGame({ wallet, bet, setBet, busy, play, result }) {
  const [visual,setVisual]=useState(null),active=wallet.rodada?.jogo === 'voltorb' ? wallet.rodada : null, table=visual ?? active ?? result?.mesa;
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">CINCO ESCOLHAS · BÔNUS DE LINHA</span><h2>Voltorb Flip</h2></div><span className="game-badge">0 · 0,5 · 1 · 2 · 3 · 5×</span></div><p>Abra cinco cartas e receba a aposta multiplicada pela soma delas. Se as cinco completarem uma linha horizontal ou vertical, o retorno dobra. Uma Voltorb soma 0× e você continua jogando.</p><p className="casino-muted">O baralho tem 3 Voltorbs (0×), 8 cartas de 0,5×, 9 de 1×, 3 de 2×, uma de 3× e uma de 5×. Diagonais não recebem bônus.</p>
    {!active && <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={async()=>{ setVisual(null); await play('voltorb',{ aposta:Number(bet) }); }}>Iniciar rodada</button></div>}
    <div className={`voltorb-card-grid ${result?.bonusLinha===2 ? 'completed-line' : ''}`} aria-label="Tabuleiro Voltorb de 25 cartas">{Array.from({ length:25 },(_,i)=>{
      const value=table?.casas[i], open=value!==null && value!==undefined;
      return <FlipCard key={`${table?.id ?? 'empty'}-${i}`} open={open} selected={table?.abertas.includes(i)} disabled={busy || !active || open} label={`Carta Voltorb ${i+1}${open ? `: ${factor(value)}` : ''}`} onClick={()=>play('voltorb/virar',{ ...roundToken(active),indice:i },async data=>{ setVisual(data.rodada ?? data.mesa); await pause(350); })}>{value===0 ? <><img src={assetUrl('/assets/pokemon/100-front.png')} alt="" /><b>0×</b></> : <b>{factor(value ?? 0)}</b>}</FlipCard>;
    })}</div>
    {table && <p className="voltorb-progress">{table.abertas.length} de 5 cartas · soma {factor(table.soma)}{active ? ` · mais ${table.restantes} ${table.restantes===1 ? 'escolha' : 'escolhas'}` : table.bonusLinha===2 ? ' · linha completa: bônus 2×!' : ''}</p>}
    <RoundResult result={result}>{result?.bonusLinha===2 ? 'Linha completa! A soma das cartas dobrou.' : 'Cinco cartas abertas'}</RoundResult>
  </section>;
}
