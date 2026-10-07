import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Search, ArrowLeft, ArrowRight, CheckCircle2, Circle, ShoppingBag, Sparkles, Swords } from 'lucide-react';
import { useCatalogo, useColecao, useSave } from '../lib/queries';
import { PageTitle, Loading, Failure, TypeBadge, typeNames } from '../components/common';
import { Button } from '../components/ui/button';
import { PokemonDetails } from '../components/PokemonDetails';
import { SpriteControls, VariantImage } from '../components/PokemonViewer';
import { statNames } from '../lib/pokemon';

export function PokedexPage() {
  const query = useCatalogo();
  const save = useSave();
  const collection = useColecao(save.data?.id);
  const registered = useQuery({ queryKey: ['dex-captured', save.data?.id], queryFn: () => api('/jogador/pokedex'), enabled: Boolean(save.data?.id) });
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [generation, setGeneration] = useState('all');
  const [capture, setCapture] = useState('all');
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState('2d');
  const [shiny, setShiny] = useState(false);
  const [selected, setSelected] = useState(null);
  const [compareIds, setCompareIds] = useState(['', '']);
  if (query.isPending || save.isPending || (save.data?.id && (collection.isPending || registered.isPending))) return <Loading label="Abrindo a Pokédex…" />;
  if (query.error || save.error || collection.error || registered.error) return <Failure error={query.error || save.error || collection.error || registered.error} retry={() => { query.refetch(); save.refetch(); collection.refetch(); registered.refetch(); }} />;
  const members = collection.data ?? [];
  const compareMembers = compareIds.map(id => members.find(member => member.id === id)).filter(Boolean);
  const capturedIds = new Set([...(registered.data ?? []), ...members.map((member) => member.especieId)]);
  const filtered = query.data.pokemon.filter((pokemon) =>
    (generation === 'all' || ({ 1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493], 5: [494, 649], 6: [650, 721], 7: [722, 809], 8: [810, 905], 9: [906, 1025] }[generation]?.every((bound, index) => index === 0 ? pokemon.id >= bound : pokemon.id <= bound))) &&
    (!type || pokemon.tipos.includes(type)) &&
    (capture === 'all' || (capture === 'caught' ? capturedIds.has(pokemon.id) : !capturedIds.has(pokemon.id))) &&
    (pokemon.nomeExibicao.toLowerCase().includes(search.toLowerCase().trim()) || String(pokemon.id) === search.trim().replace(/^#0*/, '')));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 24));
  const currentPage = Math.min(page, pageCount - 1);
  return <>
    <PageTitle label="GUIA DE CAMPO · GERAÇÕES I–IX" title="Conheça cada possibilidade.">{query.data.pokemon.length} Pokémon de Kanto a Paldea para descobrir.</PageTitle>
    <div className="dex-collection-bar"><span><CheckCircle2 size={17} /> <strong>{capturedIds.size} / {query.data.pokemon.length}</strong> espécies capturadas</span><SpriteControls {...{ mode, setMode, shiny, setShiny }} /></div>
    <div className="pokedex-toolbar"><label className="search-field"><Search size={18} /><input aria-label="Buscar Pokémon" placeholder="Buscar por nome ou número…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label><select aria-label="Filtrar por geração" value={generation} onChange={(event) => { setGeneration(event.target.value); setPage(0); }}><option value="all">Todas as gerações</option><option value="1">Kanto · Geração I</option><option value="2">Johto · Geração II</option><option value="3">Hoenn · Geração III</option><option value="4">Sinnoh · Geração IV</option><option value="5">Unova · Geração V</option><option value="6">Kalos · Geração VI</option><option value="7">Alola · Geração VII</option><option value="8">Galar · Geração VIII</option><option value="9">Paldea · Geração IX</option></select><select aria-label="Filtrar por tipo" value={type} onChange={(event) => { setType(event.target.value); setPage(0); }}><option value="">Todos os tipos</option>{Object.entries(typeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Filtrar por captura" value={capture} onChange={(event) => { setCapture(event.target.value); setPage(0); }}><option value="all">Todas as espécies</option><option value="caught">Capturados</option><option value="missing">Não capturados</option></select></div>
    <section className="pokemon-comparator"><div className="pokemon-comparator-heading"><span><Swords size={18} /><strong>Comparador de Pokémon</strong></span><small>Compare os atributos reais, incluindo nível, IVs e o bônus de 50% dos Shiny.</small></div><div className="pokemon-compare-picks">{[0, 1].map(index => <label key={index}>Pokémon {index + 1}<select aria-label={`Pokémon ${index + 1} para comparar`} value={compareIds[index]} onChange={event => setCompareIds(ids => ids.map((id, position) => position === index ? event.target.value : id))}><option value="">Escolha da coleção</option>{members.map(member => <option key={member.id} value={member.id}>{member.apelido || query.data.pokemon.find(pokemon => pokemon.id === member.especieId)?.nomeExibicao} · Nv. {member.nivel}{member.shiny ? ' · Shiny' : ''}</option>)}</select></label>)}</div>{compareMembers.length === 2 ? <><div className="pokemon-compare-portraits">{compareMembers.map(member => { const species = query.data.pokemon.find(pokemon => pokemon.id === member.especieId); const quality = member.ivs ? <span>{member.ivs.total ?? Object.values(member.ivs).filter(Number.isFinite).reduce((sum, value) => sum + value, 0)} IV</span> : null; return <article key={member.id}><VariantImage species={species} mode={mode} shiny={member.shiny} /><div><strong>{member.apelido || species?.nomeExibicao}</strong><small>Nível {member.nivel} · {member.shiny ? <em><Sparkles size={12} /> Shiny +50%</em> : 'Normal'}</small><small>{quality}</small></div></article>; })}</div><div className="pokemon-compare-stats"><div className="pokemon-compare-columns"><span>{compareMembers[0].apelido || query.data.pokemon.find(p => p.id === compareMembers[0].especieId)?.nomeExibicao}</span><span>Atributo</span><span>{compareMembers[1].apelido || query.data.pokemon.find(p => p.id === compareMembers[1].especieId)?.nomeExibicao}</span></div>{Object.entries(statNames).map(([stat, label]) => { const left = Number(compareMembers[0].atributos?.[stat] ?? 0), right = Number(compareMembers[1].atributos?.[stat] ?? 0), ceiling = Math.max(left, right, 1); return <div className="pokemon-compare-row" key={stat}><div className={`compare-value compare-left ${left > right ? 'winner' : ''}`}><b>{left}</b><span><i style={{ width: `${left / ceiling * 100}%` }} /></span></div><div className="compare-stat-label"><strong>{label}</strong><small>{left === right ? 'Empate' : `${Math.abs(left - right)} de diferença`}</small></div><div className={`compare-value compare-right ${right > left ? 'winner' : ''}`}><b>{right}</b><span><i style={{ width: `${right / ceiling * 100}%` }} /></span></div></div>; })}</div></> : <p className="pokemon-compare-empty">Escolha dois Pokémon da coleção para ver lado a lado os atributos e os bônus aplicados.</p>}</section>
    <div className="dex-result-count">{filtered.length} Pokémon · Selecione para ver os detalhes{mode === '3d' ? ' · Sprites 3D pré-renderizados' : ''}</div>
    <div className="pokedex-grid">{filtered.slice(currentPage * 24, currentPage * 24 + 24).map((pokemon) => <button type="button" key={pokemon.id} className={`dex-card dex-selectable ${capturedIds.has(pokemon.id) ? 'dex-caught' : ''}`} onClick={() => setSelected(pokemon.id)} aria-label={`Ver ${pokemon.nomeExibicao}, ${capturedIds.has(pokemon.id) ? 'capturado' : 'não capturado'}`}><div className="dex-card-header"><span className="dex-number">#{String(pokemon.id).padStart(3, '0')}</span><span className={`capture-icon ${capturedIds.has(pokemon.id) ? 'caught' : ''}`} title={capturedIds.has(pokemon.id) ? 'Capturado' : 'Não capturado'}>{capturedIds.has(pokemon.id) ? <CheckCircle2 size={16} /> : <Circle size={16} />}</span></div><VariantImage species={pokemon} mode={mode} shiny={shiny} loading="lazy" /><h2>{pokemon.nomeExibicao}</h2><div className="flex gap-1 justify-center flex-wrap">{pokemon.tipos.map((entry) => <TypeBadge key={entry} type={entry} />)}</div><div className="dex-measures"><span>{pokemon.altura} m</span><span>{pokemon.peso} kg</span></div><span className="dex-capture-label">{capturedIds.has(pokemon.id) ? 'Capturado' : 'Não capturado'}</span></button>)}</div>
    {!filtered.length && <div className="state-box">Nenhum Pokémon encontrado. Tente outro nome ou tipo.</div>}
    <div className="pagination"><Button variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}><ArrowLeft />Anterior</Button><span>{currentPage + 1} / {pageCount}</span><Button variant="outline" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Próxima<ArrowRight /></Button></div>
    <Link to="/mercado" className="dex-market-cta"><span className="dex-market-icon"><ShoppingBag size={21} /></span><span><strong>Quer ampliar sua coleção?</strong><small>Veja o estoque atual e escolha um novo Pokémon no mercado.</small></span><b>Comprar Pokémon <ArrowRight size={17} /></b></Link>
    {selected && <PokemonDetails speciesId={selected} captured={capturedIds.has(selected)} members={members.filter((member) => member.especieId === selected)} onClose={() => setSelected(null)} initialMode={mode} initialShiny={shiny} allowEvolution />}
  </>;
}
