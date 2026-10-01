import { ownedForm } from '../lib/pokemon';
import { money } from './casinoShared';

export function PokemonStakeSelector({ members, catalog, market, selectedId, onSelect, busy }) {
  const canStake = members.length > 1;
  const available = members.filter(member => !member.favorito);
  const selected = available.find(member => member.id === selectedId);
  const speciesById = new Map(catalog.pokemon.map(species => [species.id, species]));
  return <details className="casino-stake-picker">
    <summary>Apostar um Pokémon da coleção <span>Opcional</span></summary>
    <p>A aposta em fichas é opcional quando você escolhe um Pokémon: informe 0 fichas para jogar só com ele. O Pokémon é removido da coleção quando a rodada começa. Se vencer, você recebe o valor multiplicado pelo resultado em Pokédólares e o equivalente em fichas (5 ₽ = 1 ficha). Favoritos ficam protegidos e é preciso manter ao menos um Pokémon na coleção.</p>
    {!canStake ? <p className="casino-muted">Tenha pelo menos dois Pokémon na coleção para apostar um.</p> : <label>Pokémon em jogo
      <select value={selectedId} disabled={busy} onChange={event => onSelect(event.target.value)}>
        <option value="">Não apostar Pokémon</option>
        {available.map(member => {
          const species = speciesById.get(member.especieId);
          const form = species && ownedForm(species, member);
          const name = member.apelido || form?.nomeExibicao || species?.nomeExibicao || `Pokémon #${member.especieId}`;
          return <option key={member.id} value={member.id}>{name} · Nv. {member.nivel} · {money(market.get(member.id))} ₽</option>;
        })}
      </select>
    </label>}
    {selected && <small className="casino-stake-value">Em risco: {selected.apelido || ownedForm(speciesById.get(selected.especieId), selected).nomeExibicao} · {money(market.get(selected.id))} ₽</small>}
  </details>;
}
