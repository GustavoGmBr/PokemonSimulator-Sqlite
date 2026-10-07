import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCatalogo, useColecao, useSave } from '../lib/queries';
import { PageTitle, Loading, Failure, TypeBadge } from '../components/common';
import { Button } from '../components/ui/button';
import { Search, Users, Save, Check, X, Sparkles } from 'lucide-react';
import { VariantImage } from '../components/PokemonViewer';
import { IvStars } from '../components/IvSummary';
import { ownedForm } from '../lib/pokemon';

export function TeamsPage() {
  const client = useQueryClient();
  const save = useSave();
  const catalog = useCatalogo();
  const collection = useColecao(save.data?.id);
  const query = useQuery({ queryKey: ['teams', save.data?.id], queryFn: () => api('/jogador/equipes'), enabled: Boolean(save.data?.id) });
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [chosen, setChosen] = useState([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: teams => api('/jogador/equipes', { method: 'PUT', body: { equipes: teams } }), onSuccess: data => { client.setQueryData(['teams', save.data?.id], data); setError(''); } });
  if (save.isPending || catalog.isPending || collection.isPending || query.isPending) return <Loading label="Carregando equipes…" />;
  if (save.error || catalog.error || collection.error || query.error) return <Failure error={save.error || catalog.error || collection.error || query.error} retry={() => { save.refetch(); catalog.refetch(); collection.refetch(); query.refetch(); }} />;
  const teams = query.data ?? [];
  const filtered = collection.data.filter(member => {
    const species = catalog.data.pokemon.find(pokemon => pokemon.id === member.especieId);
    const text = `${species?.nomeExibicao ?? ''} ${member.apelido ?? ''} ${member.especieId}`.toLowerCase();
    return text.includes(term.toLowerCase().trim());
  });
  const current = teams.find(team => team.nome === selected);
  const toggle = id => setChosen(values => values.includes(id) ? values.filter(value => value !== id) : values.length < 6 ? [...values, id] : values);
  async function persist(next) { setError(''); try { await mutation.mutateAsync(next); return true; } catch (err) { setError(err.message); return false; } }
  async function createTeam() {
    const clean = name.trim();
    if (clean.length < 1 || chosen.length !== 6) return;
    if (teams.some(team => team.nome.toLocaleLowerCase() === clean.toLocaleLowerCase())) { setError('Já existe uma equipe com esse nome.'); return; }
    if (!await persist([...teams, { nome: clean, pokemonIds: chosen }])) return;
    setName(''); setChosen([]); setSelected(clean);
  }
  async function saveTeam() { if (!current || chosen.length !== 6) return; await persist(teams.map(team => team.nome === current.nome ? { ...team, pokemonIds: chosen } : team)); }
  async function removeTeam() { if (!current) return; if (!await persist(teams.filter(team => team.nome !== current.nome))) return; setSelected(''); setChosen([]); }
  const membersById = new Map(collection.data.map(member => [member.id, member]));
  const selectedMembers = chosen.map(id => membersById.get(id)).filter(Boolean);
  return <>
    <PageTitle label="ESTRATÉGIA · EQUIPES" title="Monte seu grupo de seis Pokémon.">Crie quantas equipes quiser, dê um nome a cada uma e filtre por elas ao escolher Pokémon para uma batalha.</PageTitle>
    {error && <p className="battle-error" role="alert">{error}</p>}
    <section className="panel team-manager"><div className="section-heading"><div><h2><Users size={19} /> Suas equipes</h2><p>{teams.length} equipe{teams.length === 1 ? '' : 's'} salvas · seis espaços por equipe</p></div><label>Equipe<select aria-label="Selecionar equipe" value={selected} onChange={event => { const value = event.target.value; setSelected(value); setChosen(teams.find(team => team.nome === value)?.pokemonIds ?? []); }}><option value="">Criar nova equipe</option>{teams.map(team => <option key={team.nome} value={team.nome}>{team.nome}</option>)}</select></label></div>
      <div className="team-builder-heading"><span><strong>{current ? `Editando ${current.nome}` : 'Nova equipe'}</strong><small>Selecione até seis Pokémon. A ordem define quem entra primeiro.</small></span><b className={chosen.length === 6 ? 'complete' : ''}>{chosen.length}<small>/ 6</small></b></div>
      <div className="team-build-preview" aria-label={`Equipe atual com ${selectedMembers.length} de 6 Pokémon`}>
        {Array.from({ length: 6 }, (_, index) => { const member = selectedMembers[index]; const species = member && catalog.data.pokemon.find(pokemon => pokemon.id === member.especieId); const form = member && ownedForm(species, member); return member ? <article key={member.id}><span className="team-slot-order">{index + 1}</span><VariantImage species={form} shiny={member.shiny} /><span><strong>{member.apelido || species?.nomeExibicao}</strong><small>Nv. {member.nivel}{member.shiny ? ' · Shiny' : ''}</small></span><button type="button" aria-label={`Remover ${member.apelido || species?.nomeExibicao} da equipe`} onClick={() => toggle(member.id)}><X size={15} /></button></article> : <div className="team-empty-slot" key={`empty-${index}`}><span>{index + 1}</span><small>Espaço vazio</small></div>; })}
      </div>
      <div className="team-collection-heading"><strong><Search size={16} /> Pokémon disponíveis</strong><label className="search-field"><Search size={16} /><input aria-label="Buscar Pokémon para equipe" placeholder="Filtrar por nome ou número" value={term} onChange={event => setTerm(event.target.value)} /></label></div>
      <div className="team-roster-picker">{filtered.map(member => { const species = catalog.data.pokemon.find(pokemon => pokemon.id === member.especieId); const form = ownedForm(species, member); const active = chosen.includes(member.id); return <button key={member.id} type="button" aria-pressed={active} disabled={!active && chosen.length >= 6} className={`team-roster-option ${active ? 'active' : ''}`} onClick={() => toggle(member.id)}><span className="team-roster-image"><VariantImage species={form} shiny={member.shiny} />{active && <i><Check size={14} /></i>}</span><span className="team-roster-info"><strong>{member.apelido || species?.nomeExibicao}</strong><small>#{String(member.especieId).padStart(3, '0')} · Nv. {member.nivel}{member.shiny ? <em><Sparkles size={11} /> Shiny</em> : ''}</small><span>{form?.tipos?.map(type => <TypeBadge key={type} type={type} />)}</span><IvStars ivs={member.ivs} /></span></button>; })}{!filtered.length && <p className="collection-empty">Nenhum Pokémon encontrado com esse filtro.</p>}</div>
      <div className="team-footer"><p className="team-selected-count">{chosen.length < 6 ? `Escolha mais ${6 - chosen.length} Pokémon para completar.` : 'Equipe completa e pronta para salvar.'}</p>{current ? <div className="team-actions"><Button disabled={mutation.isPending || chosen.length !== 6} onClick={saveTeam}><Save size={16} /> Salvar alterações</Button><Button variant="outline" disabled={mutation.isPending} onClick={removeTeam}>Excluir equipe</Button><Button variant="ghost" disabled={mutation.isPending} onClick={() => setChosen(current.pokemonIds)}>Descartar alterações</Button></div> : <><label className="team-name-input">Nome da equipe<input maxLength={30} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Equipe de Kanto" /></label><Button disabled={mutation.isPending || chosen.length !== 6 || !name.trim()} onClick={createTeam}><Save size={16} /> Criar equipe</Button></>}</div>
    </section>
  </>;
}
