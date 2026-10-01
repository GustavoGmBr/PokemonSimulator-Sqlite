import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../lib/api';
import { CasinoWheel, segmentAngles, winningRotation } from './CasinoWheel';
import { BetInput, BetList, PlayingCard, RoundResult, factor, money, pause, roundToken, validBet } from './casinoShared';

export function PokejackGame({ wallet, bet, setBet, busy, play, result }) {
  const [visual,setVisual]=useState(null), active=wallet.rodada?.jogo==='pokejack' ? wallet.rodada : null, table=visual ?? active ?? result?.mesa;
  async function act(acao) { await play('pokejack/acao',{ ...roundToken(active),acao },async data=>{ setVisual(data.rodada ?? data.mesa); await pause(650); }); }
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">VOCÊ CONTRA A BANCA</span><h2>Pokejack</h2></div><span className="game-badge">21 com duas cartas: 3×</span></div><p>Chegue mais perto de 21 sem passar. Vitória paga 2×, Pokejack natural (21 com duas cartas) paga 3× e empate devolve a aposta. O ás vale 1 ou 11; J, Q e K valem 10. A banca pede até 16 e para em 17 ou mais.</p>
    <div className="blackjack-table"><div className="blackjack-hand"><h3>Banca <span>{table?.totalBanca ?? '?'}</span></h3><div className="playing-card-row">{(table?.banca ?? [null,null]).map((card,i)=><PlayingCard card={card} index={i} key={card ? `${card.valor}${card.naipe}` : `hidden-${i}`} />)}</div></div><div className="blackjack-table-mark">POKEJACK PAGA 3×</div><div className="blackjack-hand"><h3>Sua mão <span>{table?.totalJogador ?? '—'}</span></h3><div className="playing-card-row">{(table?.jogador ?? [null,null]).map((card,i)=><PlayingCard card={card} index={i} key={card ? `${card.valor}${card.naipe}` : `hidden-${i}`} />)}</div></div></div>
    {active ? <><p>Aposta na mesa: <strong>{money(active.aposta)} fichas</strong></p><div className="casino-controls"><button disabled={busy} onClick={()=>act('pedir')}>Pedir carta</button><button disabled={busy} onClick={()=>act('parar')}>Parar</button><button disabled={busy || !active.podeDobrar || wallet.fichas<active.aposta} onClick={()=>act('dobrar')}>Dobrar · +{money(active.aposta)} fichas</button></div><p className="casino-muted">Ao dobrar, você paga mais uma aposta, recebe só uma carta e encerra a mão.</p></> : <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={async()=>{ setVisual(null); await play('pokejack',{ aposta:Number(bet) },async data=>{setVisual(data.rodada ?? data.mesa);await pause(450);}); }}>Distribuir mão</button></div>}
    <RoundResult result={result}>{({ pokejack:'Pokejack! 21 com duas cartas.', vitoria:'Você venceu a banca!', empate:'Empate · aposta devolvida', derrota:'A banca venceu esta mão' })[result?.resultado]}</RoundResult>
    <details className="casino-rules"><summary>Decisões durante a mão</summary><p>Sugestão: pedir abaixo de 15, parar em 15 ou mais e considerar dobrar com 20. Dobrar só está disponível com as duas cartas iniciais; um 21 com três ou mais cartas paga como vitória normal.</p></details>
  </section>;
}

export function RaceGame({ wallet, bet, setBet, busy, play, result }) {
  const [chosen,setChosen]=useState(0),[positions,setPositions]=useState(Array(5).fill(0)),[running,setRunning]=useState(false),[countdown,setCountdown]=useState('');
  const racers=wallet.regras.corredores;
  async function race() {
    setPositions(Array(5).fill(0)); setRunning(true);
    await play('corrida',{ aposta:Number(bet),pokemon:chosen },async data=>{
      for(const count of ['3','2','1','VAI!']) { setCountdown(count); await pause(280); }
      setCountdown('');
      for(const frame of data.quadros.slice(1)) { setPositions(frame); await pause(2600/(data.quadros.length-1)); }
    });
    setRunning(false); setCountdown('');
  }
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">CINCO COMPETIDORES · UMA CHEGADA</span><h2>Pokémon Race</h2></div><span className="game-badge">Vencedor: 4×</span></div><p>Escolha seu favorito antes da largada. Os cinco avançam por sorte, sem vantagem de nível ou IVs. Você recebe 4× a aposta se o escolhido cruzar a linha primeiro.</p>
    <div className="race-picks" role="group" aria-label="Escolher Pokémon da corrida">{racers.map((r,i)=><button type="button" key={r.id} disabled={busy} className={chosen===i ? 'selected' : ''} aria-pressed={chosen===i} onClick={()=>setChosen(i)}><img src={assetUrl(`/assets/pokemon/${r.id}-front.png`)} alt="" /><span>{r.nome}</span></button>)}</div>
    <div className={`pokemon-race-track ${running ? 'race-running' : ''}`} aria-label="Pista de corrida">{countdown && <div className="race-countdown" role="status">{countdown}</div>}{racers.map((r,i)=><div className={`race-lane ${chosen===i ? 'race-chosen' : ''} ${result?.vencedor===i ? 'race-winner' : ''}`} key={r.id}><span className="race-lane-name">{i+1} · {r.nome}</span><div className="race-lane-length"><div className="race-runner" style={{ left:`${positions[i]}%` }}><img src={assetUrl(`/assets/pokemon/${r.id}-front.png`)} alt={r.nome} /></div></div><span className="race-finish" /><small>{Math.floor(positions[i])}%</small></div>)}</div>
    <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={race}>{busy ? 'Corrida em andamento…' : 'Largar corrida'}</button></div>
    <RoundResult result={result}>{result && `${racers[result.vencedor].nome} venceu!${result.premio ? ' Seu palpite acertou.' : ''}`}</RoundResult>
  </section>;
}

export function FortuneGame({ wallet, bet, setBet, busy, play, result }) {
  const [rotation,setRotation]=useState(0);
  const choices=wallet.regras.fortune, segments=choices.map(s=>({ label:factor(s.multiplicador),weight:s.peso,color:s.cor }));
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">UM PONTEIRO · SETORES DESIGUAIS</span><h2>Wheel of Fortune</h2></div><span className="game-badge">Até 10×</span></div><p>Aposte o valor da rodada e gire a roda. O setor onde o ponteiro parar define automaticamente o seu retorno: 0× não paga; 0,25× e 0,5× devolvem uma parte da aposta.</p>
    <div className="fortune-layout"><CasinoWheel fortune segments={segments} rotation={rotation} busy={busy} /><div className="fortune-picks" aria-label="Multiplicadores e chances da roda">{choices.map(s=><div key={s.multiplicador} style={{ '--sector-color':s.cor }}><strong>{factor(s.multiplicador)}</strong><small>{s.peso}% da roda</small></div>)}</div></div>
    <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={()=>play('fortune',{ aposta:Number(bet) },async data=>{ setRotation(current=>winningRotation(current,segmentAngles(segments)[data.indice].center)); await pause(2450); })}>{busy ? 'Roda girando…' : `Girar fortuna · ${money(bet)} fichas`}</button></div>
    <RoundResult result={result}>{result && `O ponteiro parou em ${factor(result.multiplicador)} · retorno de ${money(result.premio)} fichas`}</RoundResult>
  </section>;
}

export function PiplupGame({ wallet, bet, setBet, busy, play, result }) {
  const [visual,setVisual]=useState(null),[jumping,setJumping]=useState(false), active=wallet.rodada?.jogo==='piplup' ? wallet.rodada : null, table=visual ?? active ?? result?.mesa;
  const fallen=result?.resultado==='queda' || visual?.queda, steps=table?.passos ?? 0, position=fallen ? steps+1 : steps;
  const scene=useRef(null), actorPosition=position ? 92+(position-1)*96 : 32;
  useEffect(()=>{ scene.current?.scrollTo({ left:Math.max(0,actorPosition - scene.current.clientWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); },[actorPosition]);
  async function act(acao) {
    await play('piplup/acao',{ ...roundToken(active),acao },async data=>{
      const next=data.rodada ?? data.mesa; setVisual({ ...next,queda:data.resultado==='queda' });
      if(acao==='pular') setJumping(true);
      await pause(700); setJumping(false);
    });
  }
  return <section className="casino-panel"><div className="casino-game-heading"><div><span className="casino-eyebrow">PULE, CONTINUE OU SAQUE</span><h2>Pula Piplup</h2></div><span className="game-badge">Sete placas de gelo</span></div><p>Cada salto pode falhar. Complete uma placa e escolha entre sacar o acumulado ou arriscar a próxima. Uma queda perde toda a entrada; sete saltos seguros pagam 5× automaticamente.</p>
    <div className="piplup-scene-scroll" ref={scene}><div className={`piplup-scene ${fallen ? 'piplup-lost' : ''}`}><div className="ice-mountains" /><div className="piplup-water" />{wallet.regras.piplup.map((mult,i)=><div key={i} className={`ice-platform ${i<steps ? 'ice-complete' : ''} ${fallen && i===steps ? 'ice-broken' : ''}`} style={{ left:`${62+i*96}px` }}><b>{factor(mult)}</b><small>Placa {i+1}</small></div>)}<div className={`piplup-actor ${jumping ? 'piplup-jumping' : ''} ${fallen ? 'piplup-fallen' : ''}`} style={{ left:`${actorPosition}px` }}><img src={assetUrl('/assets/pokemon/393-front.png')} alt="Piplup" /></div></div></div>
    {table && <p className="piplup-progress">{steps} de 7 saltos seguros · {factor(table.multiplicador)} · acumulado <strong>{money(fallen ? 0 : table.acumulado)} fichas</strong></p>}
    {active ? <><p className="casino-muted">Próximo salto: {active.proximaChance}% de chance de chegar à placa. O prêmio só entra na carteira ao sacar ou completar as sete placas.</p><div className="casino-controls"><button disabled={busy} onClick={()=>act('pular')}>{busy ? 'Piplup em movimento…' : `Pular para a placa ${active.passos+1}`}</button><button className="casino-cashout" disabled={busy || !active.passos} onClick={()=>act('sacar')}>Sacar {money(active.acumulado)} fichas</button></div></> : <div className="casino-controls"><BetInput bet={bet} setBet={setBet} /><button disabled={busy || !!wallet.rodada || !validBet(bet) || Number(bet)>wallet.fichas} onClick={async()=>{ setVisual(null); await play('piplup',{ aposta:Number(bet) }); }}>Começar travessia</button></div>}
    <RoundResult result={result}>{({ queda:'Piplup caiu! A entrada foi perdida.', saque:'Saque realizado!', vitoria:'Travessia completa! Sete saltos seguros.' })[result?.resultado]}</RoundResult>
  </section>;
}
