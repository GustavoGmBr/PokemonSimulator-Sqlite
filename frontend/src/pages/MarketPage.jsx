import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { api } from '../lib/api';
import { useCatalogo, useSave } from '../lib/queries';
import { Failure, Loading, PageTitle, PokemonImage, TypeBadge } from '../components/common';
import { IvStars } from '../components/IvSummary';
import { TeamPanel } from '../components/TeamPanel';
import { money } from '../components/casinoShared';
import './market.css';

const SHOP_KEY = 'pokemon-shop';
const SHOP_REFRESH_PRICE = 3_000;

export function MarketPage() {
  const client = useQueryClient();
  const save = useSave();
  const catalog = useCatalogo();
  const shop = useQuery({ queryKey: [SHOP_KEY, save.data?.id], queryFn: () => api('/mercado/pokemon'), enabled: Boolean(save.data?.inicialEspecieId), refetchInterval: 30_000 });
  const [tab, setTab] = useState('comprar');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const speciesById = useMemo(() => new Map((catalog.data?.pokemon ?? []).map(species => [species.id, species])), [catalog.data]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  async function buyPokemon(stockId) {
    setBusyId(stockId); setError('');
    try {
      await api('/mercado/pokemon/comprar', { method: 'POST', body: { stockId } });
      await Promise.all(['save', 'colecao', 'sale-values', SHOP_KEY].map(key => client.invalidateQueries({ queryKey: [key] })));
    } catch (caught) {
      setError(caught.message);
      await client.invalidateQueries({ queryKey: [SHOP_KEY] });
    } finally { setBusyId(''); }
  }

  async function refreshPokemon() {
    setBusyId('refresh'); setError('');
    try {
      await api('/mercado/pokemon/atualizar', { method: 'POST' });
      await Promise.all(['save', SHOP_KEY].map(key => client.invalidateQueries({ queryKey: [key] })));
    } catch (caught) {
      setError(caught.message);
      await Promise.all([client.invalidateQueries({ queryKey: [SHOP_KEY] }), client.invalidateQueries({ queryKey: ['save'] })]);
    } finally { setBusyId(''); }
  }

  async function toggleFavorite(item) {
    setBusyId(item.id); setError('');
    try {
      await api(`/mercado/pokemon/${item.id}/favorito`, { method: 'PATCH', body: { favorito: !item.favorito } });
      await client.invalidateQueries({ queryKey: [SHOP_KEY, save.data?.id] });
    } catch (caught) {
      setError(caught.message);
      await client.invalidateQueries({ queryKey: [SHOP_KEY, save.data?.id] });
    } finally { setBusyId(''); }
  }

  if (save.isPending || catalog.isPending || (save.data?.inicialEspecieId && shop.isPending)) return <Loading label="Abrindo o mercado…" />;
  if (save.error || catalog.error || shop.error) return <Failure error={save.error || catalog.error || shop.error} retry={() => { save.refetch(); catalog.refetch(); shop.refetch(); }} />;
  if (!save.data?.iniciadoEm) return <Navigate to="/saves" replace />;
  if (!save.data.inicialEspecieId) return <Navigate to="/inicial" replace />;

  const stock = shop.data;
  const refreshAt = typeof stock.renovaEm === 'string' ? Date.parse(stock.renovaEm) : NaN;
  const serverRemaining = Number(stock.restanteMs);
  const elapsedSinceFetch = Math.max(0, now - (shop.dataUpdatedAt || now));
  const timeLeft = Number.isFinite(refreshAt)
    ? Math.max(0, refreshAt - now)
    : Number.isFinite(serverRemaining)
      ? Math.max(0, serverRemaining - elapsedSinceFetch)
      : null;
  const hours = timeLeft === null ? '--' : String(Math.floor(timeLeft / 3_600_000)).padStart(2, '0');
  const minutes = timeLeft === null ? '--' : String(Math.floor(timeLeft % 3_600_000 / 60_000)).padStart(2, '0');
  const seconds = timeLeft === null ? '--' : String(Math.floor(timeLeft % 60_000 / 1000)).padStart(2, '0');

  return <div className="market-page">
    <PageTitle label="MERCADO POKÉMON" title="Encontre novos parceiros.">Compre Pokémon com Pokédólares ou venda exemplares da sua coleção.</PageTitle>
    <div className="market-tabs" role="tablist" aria-label="Mercado Pokémon">
      <button type="button" role="tab" aria-selected={tab === 'comprar'} className={tab === 'comprar' ? 'active' : ''} onClick={() => setTab('comprar')}>Comprar Pokémon</button>
      <button type="button" role="tab" aria-selected={tab === 'vender'} className={tab === 'vender' ? 'active' : ''} onClick={() => setTab('vender')}>Vender Pokémon</button>
    </div>
    {tab === 'comprar' ? <section className="pokemon-shop">
      <div className="pokemon-shop-heading"><div><h2>Estoque de Pokémon</h2><p>Doze Pokémon de nível 1 aparecem a cada hora. Todos chegam com pelo menos duas estrelas de IV.</p></div><div className="pokemon-shop-tools"><span className="shop-countdown">Próxima atualização automática <strong>{hours}:{minutes}:{seconds}</strong></span><span className="shop-balance">Saldo: <strong>{money(stock.moedas)} ₽</strong></span><button className="shop-refresh-button" type="button" disabled={Boolean(busyId) || stock.moedas < SHOP_REFRESH_PRICE} onClick={refreshPokemon}>{busyId === 'refresh' ? 'Atualizando…' : `Atualizar estoque · ${money(SHOP_REFRESH_PRICE)} ₽`}</button></div></div>
      {error && <p role="alert" className="battle-error">{error}</p>}
      <div className="pokemon-shop-grid">{stock.pokemons.map(item => {
        const species = speciesById.get(item.especieId);
        if (!species) return null;
        const saving = busyId === item.id;
        return <article className={`pokemon-shop-card ${!item.disponivel ? 'sold' : ''} ${item.favorito ? 'shop-favorite' : ''}`} key={item.id}>
          <div className="pokemon-shop-image"><button type="button" className={`shop-favorite-button ${item.favorito ? 'active' : ''}`} aria-label={item.favorito ? `Desafixar ${species.nomeExibicao} do estoque` : `Favoritar ${species.nomeExibicao} no estoque`} aria-pressed={Boolean(item.favorito)} disabled={!item.disponivel || Boolean(busyId)} onClick={() => toggleFavorite(item)}><Star size={18} fill={item.favorito ? 'currentColor' : 'none'} /></button>{item.shiny && <span className="shop-shiny">✨ SHINY</span>}<PokemonImage pokemon={species} variant={item.shiny ? 'frontShiny' : 'front'} loading="lazy" /></div>
          <div className="pokemon-shop-info"><div className="pokemon-shop-name"><strong>{species.nomeExibicao}</strong><span>#{String(item.especieId).padStart(3, '0')}</span></div>
            <div className="pokemon-shop-tags"><span>Geração {item.geracao}</span>{!item.geracaoDesbloqueada && <span>Geração bloqueada · 2×</span>}{item.shiny && <span>Brilhante · 5×</span>}</div>
            <div className="pokemon-shop-types">{species.tipos.map(type => <TypeBadge key={type} type={type} />)}</div>
            <p>Nível {item.nivel} · IVs <IvStars ivs={item.ivs} /></p>
            {item.estrelas >= 3 && <small className="shop-iv-bonus">Bônus de IV: +{item.estrelas === 4 ? 100 : 50}% no valor</small>}
          </div>
          <div className="pokemon-shop-buy"><strong>{money(item.preco)} ₽</strong><button type="button" disabled={!item.disponivel || Boolean(busyId) || stock.moedas < item.preco} onClick={() => buyPokemon(item.id)}>{saving ? 'Comprando…' : item.disponivel ? stock.moedas < item.preco ? 'Saldo insuficiente' : 'Comprar' : 'Vendido'}</button></div>
        </article>;
      })}</div>
    </section> : <TeamPanel save={save.data} catalogo={catalog.data} market />}
  </div>;
}
