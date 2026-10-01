import { useState } from 'react';
import { PokemonImage } from './common';
import { ownedForm } from '../lib/pokemon';
import { NumberInput, money, betLabel } from './casinoShared';

export function PokemonWagerPicker({ members, market, catalog, selectedId, onSelect, busy, selection }) {
  const [search, setSearch] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [sort, setSort] = useState('capture');
  const [visibleCount, setVisibleCount] = useState(48);
  const speciesById = new Map(catalog.pokemon.map((species) => [species.id, species]));
  const needle = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = members.filter((member) => {
    const species = speciesById.get(member.especieId);
    const form = ownedForm(species, member);
    const value = market.get(member.id) ?? 0;
    const name = `${member.apelido ?? ''} ${species?.nomeExibicao ?? ''} ${form?.nomeExibicao ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return (!needle || name.includes(needle) || String(member.especieId) === needle.replace(/^#0*/, ''))
      && (!minValue || value >= Number(minValue))
      && (!maxValue || value <= Number(maxValue));
  }).sort((a, b) => sort === 'value-high' ? (market.get(b.id) ?? 0) - (market.get(a.id) ?? 0) : sort === 'value-low' ? (market.get(a.id) ?? 0) - (market.get(b.id) ?? 0) : new Date(b.capturadoEm) - new Date(a.capturadoEm));
  const selected = members.find((member) => member.id === selectedId);
  return <div className="casino-pokemon-wager">
    <h3>Apostar um Pokémon da coleção</h3>
    <p>O Pokémon sai da coleção quando a rodada começa, mesmo se você perder. Favoritos são protegidos. Em caso de acerto, você recebe o valor multiplicado pelo resultado em Pokédólares e também em fichas (5 ₽ equivalem a 1 ficha). Se apostar um Pokémon, pode jogar sem fichas.</p>
    <div className="casino-wager-filters">
      <label>Buscar por nome ou Nº Dex<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(48); }} placeholder="Nome ou número" /></label>
      <NumberInput label="Valor mínimo (₽)" value={minValue} onChange={(value) => { setMinValue(value); setVisibleCount(48); }} min={0} />
      <NumberInput label="Valor máximo (₽)" value={maxValue} onChange={(value) => { setMaxValue(value); setVisibleCount(48); }} min={0} />
      <label>Ordenar<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="capture">Captura recente</option><option value="value-low">Menor valor</option><option value="value-high">Maior valor</option></select></label>
    </div>
    <p className="casino-wager-count">{filtered.length} de {members.length} Pokémon encontrados · {members.filter((member) => !member.favorito).length} disponíveis para aposta</p>
    <div className="casino-wager-grid" role="group" aria-label="Escolher Pokémon para apostar">{filtered.slice(0, visibleCount).map((member) => {
      const form = ownedForm(speciesById.get(member.especieId), member);
      const name = member.apelido || form.nomeExibicao;
      return <button type="button" key={member.id} className={`casino-wager-card ${selectedId === member.id ? 'selected' : ''} ${member.favorito ? 'protected' : ''}`} aria-label={`${member.favorito ? 'Favorito protegido' : 'Apostar'} ${name}, nível ${member.nivel}, valor ${money(market.get(member.id))} ₽`} aria-pressed={member.favorito ? undefined : selectedId === member.id} disabled={busy || member.favorito} onClick={() => onSelect(selectedId === member.id ? '' : member.id)}><PokemonImage pokemon={form} variant={member.shiny ? 'frontShiny' : 'front'} loading="lazy" /><span><strong>{name}{member.shiny ? ' ✨' : ''}</strong><small>#{String(member.especieId).padStart(3, '0')} · Nv. {member.nivel}</small><b>{money(market.get(member.id))} ₽</b>{member.favorito && <small className="casino-protected-label">★ Favorito protegido</small>}</span></button>;
    })}</div>
    {!filtered.length && <p>Nenhum Pokémon corresponde aos filtros.</p>}
    {visibleCount < filtered.length && <button type="button" className="casino-more" onClick={() => setVisibleCount((count) => count + 48)}>Mostrar mais Pokémon</button>}
    {selected && !selected.favorito && <p className="casino-selected-wager">Selecionado: {selected.apelido || ownedForm(speciesById.get(selected.especieId), selected).nomeExibicao} · valor base {money(market.get(selected.id))} ₽{selection ? ` · palpite: ${betLabel(selection)}` : ''}</p>}
  </div>;
}

