import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCatalogo, useColecao, useSave } from '../lib/queries';
import { PageTitle, Loading, Failure } from '../components/common';
import { Button } from '../components/ui/button';
import { Search, Users, Save } from 'lucide-react';

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
  async function persist(next) { setError(''); try { await mutation.mutateAsync(next); } catch (err) { setError(err.message); } }
  async function createTeam() {
    const clean = name.trim();
    if (clean.length < 1 || chosen.length !== 6) return;
    if (teams.some(team => team.nome.toLocaleLowerCase() === clean.toLocaleLowerCase())) { setError('Já existe uma equipe com esse nome.'); return; }
    await persist([...teams, { nome: clean, pokemonIds: chosen }]);
    setName(''); setChosen([]); setSelected(clean);
  }
  async function removeTeam() { if (!current) return; await persist(teams.filter(team => team.nome !== current.nome)); setSelected(''); setChosen([]); }
  const membersById = new Map(collection.data.map(member => [member.id, member]));
  return <>
    <PageTitle label="ESTRATÉGIA · EQUIPES" title="Monte seu grupo de seis Pokémon.">Crie quantas equipes quiser, dê um nome a cada uma e filtre por elas ao escolher Pokémon para uma batalha.</PageTitle>
    {error && <p className="battle-error" role="alert">{error}</p>}
    <section className="panel team-manager"><div className="section-heading"><div><h2><Users size={19} /> Suas equipes</h2><p>{teams.length} equipe{teams.length === 1 ? '' : 's'} salvas</p></div><select aria-label="Selecionar equipe" value={selected} onChange={event => { const value = event.target.value; setSelected(value); setChosen(teams.find(team => team.nome === value)?.pokemonIds ?? []); }}><option value="">Criar nova equipe</option>{teams.map(team => <option key={team.nome} value={team.nome}>{team.nome}</option>)}</select></div>
      <label className="search-field"><Search size={16} /><input aria-label="Buscar Pokémon para equipe" placeholder="Filtrar Pokémon por nome ou número" value={term} onChange={event => setTerm(event.target.value)} /></label>
      <div className="team-roster-picker">{filtered.map(member => { const species = catalog.data.pokemon.find(pokemon => pokemon.id === member.especieId); const active = chosen.includes(member.id); return <button key={member.id} type="button" aria-pressed={active} className={`team-roster-option ${active ? 'active' : ''}`} onClick={() => toggle(member.id)}><span>#{member.especieId}</span><strong>{member.apelido || species?.nomeExibicao}{member.shiny ? ' ✨' : ''}</strong><small>Nv. {member.nivel}</small></button>; })}</div>
      {current ? <><p className="team-selected-count">{chosen.length ? chosen.length : current.pokemonIds.length} / 6 selecionados para editar “{current.nome}”.</p><div className="team-actions"><Button disabled={mutation.isPending || chosen.length !== 6} onClick={() => persist(teams.map(team => team.nome === current.nome ? { ...team, pokemonIds: chosen } : team))}><Save size={16} /> Salvar equipe</Button><Button variant="outline" disabled={mutation.isPending} onClick={removeTeam}>Excluir equipe</Button><Button variant="ghost" onClick={() => setChosen([])}>Cancelar edição</Button></div></> : <><label className="team-name-input">Nome da equipe<input maxLength={30} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Equipe de Kanto" /></label><p className="team-selected-count">{chosen.length} / 6 Pokémon escolhidos</p><Button disabled={mutation.isPending || chosen.length !== 6 || !name.trim()} onClick={createTeam}><Save size={16} /> Criar equipe</Button></>}
      {current && <div className="team-current-roster"><strong>Pokémon atuais</strong>{current.pokemonIds.map((id, index) => { const member = membersById.get(id); const species = catalog.data.pokemon.find(pokemon => pokemon.id === member?.especieId); return <span key={id}>{index + 1}. {member?.apelido || species?.nomeExibicao || 'Pokémon não encontrado'}</span>; })}</div>}
    </section>
  </>;
}
