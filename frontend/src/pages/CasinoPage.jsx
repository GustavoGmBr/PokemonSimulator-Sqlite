import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Ticket } from 'lucide-react';
import { api, assetUrl } from '../lib/api';
import { useCatalogo, useColecao, useSave } from '../lib/queries';
import { Failure, Loading, PageTitle } from '../components/common';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CasinoResultToast } from '../components/CasinoResultToast';
import { PokemonWagerPicker } from '../components/CasinoWagerPicker';
import { NumberInput, money, roundToken } from '../components/casinoShared';
import { SlotGame, RouletteGame, VoltorbGame } from '../components/CasinoTables';
import { PokejackGame, RaceGame, FortuneGame, PiplupGame } from '../components/CasinoArcade';
import './casino.css';

const games=[
  { id:'slots',name:'Caça-níqueis',icon:'✦',route:'slots',Component:SlotGame },
  { id:'roulette',name:'Roleta',icon:'◉',route:'roleta',Component:RouletteGame },
  { id:'voltorb',name:'Voltorb Flip',icon:'▦',route:'voltorb',Component:VoltorbGame },
  { id:'jack',name:'Pokejack',icon:'21',route:'pokejack',Component:PokejackGame },
  { id:'race',name:'Pokémon Race',icon:'⚑',route:'corrida',Component:RaceGame },
  { id:'fortune',name:'Wheel of Fortune',icon:'☸',route:'fortune',Component:FortuneGame },
  { id:'piplup',name:'Pula Piplup',icon:'❄',route:'piplup',Component:PiplupGame },
  { id:'shop',name:'Loja de fichas',icon:'⌂',route:'itens' },
];
export function CasinoPage() {
  const client=useQueryClient(), save=useSave(), catalog=useCatalogo(), collection=useColecao(save.data?.id);
  const casino=useQuery({ queryKey:['casino',save.data?.id], queryFn:()=>api('/cassino'),enabled:Boolean(save.data?.inicialEspecieId) });
  const values=useQuery({ queryKey:['sale-values',save.data?.usuarioId,save.data?.id],queryFn:()=>api('/jogador/pokemon/valores-venda'),enabled:Boolean(save.data?.inicialEspecieId) });
  const [tab,setTab]=useState('slots'),[chips,setChips]=useState('10'),[bet,setBet]=useState('5'),[result,setResult]=useState(null),[resultOpen,setResultOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[itemAmounts,setItemAmounts]=useState({}),[abandon,setAbandon]=useState(false),[pokemonWagerId,setPokemonWagerId]=useState('');
  const pending=useRef(false);
  const dismissResult=useCallback(()=>setResultOpen(false),[]);
  useEffect(()=>{
    const round=casino.data?.rodada;
    if(round) setTab(games.find(g=>g.route===round.jogo)?.id ?? 'slots');
  },[casino.data?.rodada?.id]);
  async function play(path,body,animate) {
    if(pending.current) return null;
    pending.current=true;setBusy(true);setError('');setResult(null);setResultOpen(false);
    try {
      const data=await api(`/cassino/${path}`,{ method:'POST',body });
      if(animate) await animate(data);
      if(body.pokemonAposta) setPokemonWagerId('');
      const resultData={ ...data,jogo:data.mesa?.jogo ?? path.split('/')[0] };
      setResult(resultData);
      if (!Object.prototype.hasOwnProperty.call(data,'rodada') || data.rodada === null) setResultOpen(true);
      await Promise.all(['casino','save','colecao','sale-values','inventario'].map(key=>client.invalidateQueries({ queryKey:[key] })));
      return data;
    } catch(caught) { setError(caught.message); await client.invalidateQueries({ queryKey:['casino'] }); return null; }
    finally { pending.current=false;setBusy(false); }
  }
  if(save.isPending || catalog.isPending || (save.data?.inicialEspecieId && (casino.isPending || collection.isPending || values.isPending))) return <Loading label="Abrindo o Pokécassino…" />;
  if(save.error || catalog.error || casino.error || collection.error || values.error) return <Failure error={save.error || catalog.error || casino.error || collection.error || values.error} retry={()=>{save.refetch();catalog.refetch();casino.refetch();collection.refetch();values.refetch();}} />;
  if(!save.data?.iniciadoEm) return <Navigate to="/saves" replace />;
  if(!save.data.inicialEspecieId) return <Navigate to="/inicial" replace />;
  const wallet=casino.data, game=games.find(g=>g.id===tab), Component=game.Component, active=games.find(g=>g.route===wallet.rodada?.jogo);
  const cart=Object.entries(itemAmounts).filter(([,qty])=>Number(qty)>0).map(([itemId,quantity])=>({ itemId,quantidade:Number(quantity) }));
  const cost=cart.reduce((sum,line)=>sum+(wallet.itens.find(item=>item.itemId===line.itemId)?.preco ?? 0)*line.quantidade,0);
  return <div className="casino-page"><PageTitle label="POKÉCASSINO · SETE JOGOS E UMA LOJA" title="A sorte está lançada.">Escolha sua mesa, acompanhe a rodada e troque as fichas por prêmios para sua jornada.</PageTitle>
    <div className="casino-wallet"><div><Coins size={21} /><span>Pokédólares</span><strong>{money(wallet.moedas)} ₽</strong></div><div><Ticket size={21} /><span>Fichas</span><strong>{money(wallet.fichas)}</strong></div><div className="casino-chip-buy"><NumberInput label="Comprar fichas · 5 ₽ cada" value={chips} onChange={setChips} /><button disabled={busy || !!wallet.rodada || !Number.isInteger(Number(chips)) || Number(chips)<1 || Number(chips)>20_000_000 || Number(chips)*5>wallet.moedas} onClick={()=>play('fichas',{ quantidade:Number(chips) })}>Comprar · {money(Number(chips)*5)} ₽</button></div></div>
    <p className="casino-return-note">Multiplicadores indicam o retorno total: apostar 10 fichas e ganhar 2× devolve 20 fichas. Prêmios fracionários são arredondados para baixo.</p>
    {wallet.reembolso>0 && <p role="status">Uma rodada antiga foi encerrada com devolução de {money(wallet.reembolso)} fichas para iniciar as novas regras.</p>}
    <div className="casino-tabs" role="tablist" aria-label="Jogos e loja do cassino">{games.map(g=><button type="button" role="tab" id={`casino-tab-${g.id}`} aria-controls="casino-game-panel" aria-selected={tab===g.id} tabIndex={tab===g.id ? 0 : -1} disabled={busy} key={g.id} className={tab===g.id ? 'active' : ''} onClick={()=>{setTab(g.id);setResult(null);setResultOpen(false);setError('');}} onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();const i=games.indexOf(g), next=event.key==='Home' ? 0 : event.key==='End' ? games.length-1 : (i+(event.key==='ArrowRight' ? 1 : -1)+games.length)%games.length;
      setTab(games[next].id);setResult(null);setResultOpen(false);document.getElementById(`casino-tab-${games[next].id}`)?.focus();
    }}><span className="casino-tab-icon" aria-hidden="true">{g.icon}</span>{g.name}</button>)}</div>
    {wallet.rodada && <div className="casino-active-round"><span><strong>Rodada de {active?.name} em andamento</strong> · aposta de {money(wallet.rodada.aposta)} fichas.{wallet.rodada.pokemonAposta ? ` Pokémon em risco: ${wallet.rodada.pokemonAposta.nome} (${money(wallet.rodada.pokemonAposta.valorBase)} ₽).` : ''} Você pode continuar após reabrir o jogo.</span><button disabled={busy} onClick={()=>setTab(active.id)}>Retomar rodada</button><button disabled={busy} onClick={()=>setAbandon(true)}>Abandonar rodada</button></div>}
    {error && <p role="alert" className="battle-error">{error}</p>}
    {game.id !== 'shop' && !wallet.rodada && game.id !== 'roulette' && <details className="casino-stake-picker"><summary>Apostar um Pokémon da coleção <span>Opcional</span></summary><PokemonWagerPicker members={collection.data ?? []} catalog={catalog.data} market={new Map((values.data ?? []).map(entry=>[entry.pokemonId,entry.valor]))} selectedId={pokemonWagerId} onSelect={setPokemonWagerId} busy={busy} /></details>}
    <div id="casino-game-panel" role="tabpanel" aria-labelledby={`casino-tab-${tab}`}>{Component ? <Component wallet={wallet} bet={bet} setBet={setBet} busy={busy} play={play} result={result?.jogo===game.route ? result : null} members={collection.data ?? []} catalog={catalog.data} market={new Map((values.data ?? []).map(entry=>[entry.pokemonId,entry.valor]))} pokemonWagerId={pokemonWagerId} setPokemonWagerId={setPokemonWagerId} /> : <section className="casino-panel"><h2>Loja de fichas</h2><p>Troque fichas por Poké Bolas, incluindo Master Bola, itens de cura e essências de IV.</p><div className="casino-items">{wallet.itens.map(item=><div key={item.itemId}><img src={assetUrl(item.sprite)} alt="" /><strong>{item.nome}</strong><span>{money(item.preco)} fichas</span><NumberInput label="Quantidade" value={itemAmounts[item.itemId] ?? '0'} onChange={value=>setItemAmounts(current=>({ ...current,[item.itemId]:value }))} min={0} max={999} /></div>)}</div><p>Compras selecionadas: {cart.reduce((sum,line)=>sum+line.quantidade,0)} · total {money(cost)} fichas</p><button disabled={busy || !cart.length || cost>wallet.fichas || cart.some(line=>!Number.isInteger(line.quantidade) || line.quantidade>999)} onClick={async()=>{if(await play('itens',{ itens:cart }))setItemAmounts({});}}>Comprar itens</button></section>}</div>
    <ConfirmDialog open={abandon} onOpenChange={setAbandon} onConfirm={async()=>{if(await play('rodada/desistir',roundToken(wallet.rodada)))setAbandon(false);}} pending={busy} error={error} title="Abandonar a rodada?" description="A entrada desta rodada será perdida, sem prêmio. Para receber o acumulado do Piplup, use o botão Sacar na mesa." confirmLabel="Abandonar e perder entrada" destructive />
    <CasinoResultToast open={resultOpen} onDismiss={dismissResult} result={result} racers={wallet.regras.corredores} />
  </div>;
}
