import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Clock3, MapPin, Save, Leaf, Trash2 } from 'lucide-react';
import { useSession } from '../stores/session';
import { useCatalogo } from '../lib/queries';
import { api } from '../lib/api';
import { PageTitle, Loading, Failure, PokemonImage } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function SavesPage() {
  const [nome, setNome] = useState('');
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();
  const client = useQueryClient();
  const selectSave = useSession((state) => state.selectSave);
  const saves = useQuery({ queryKey: ['saves'], queryFn: () => api('/jogador/saves') });
  const { data: catalogo } = useCatalogo();
  const create = useMutation({
    mutationFn: () => api('/jogador/saves', { method: 'POST', body: { nomeTreinador: nome.trim() } }),
    onSuccess: (save) => { client.setQueryData(['saves'], [save, ...(saves.data ?? [])]); selectSave(save); client.clear(); navigate('/inicial'); },
  });
  const remove = useMutation({
    mutationFn: (save) => api(`/jogador/saves/${save.id}`, { method: 'DELETE' }),
    onSuccess: (_, save) => {
      client.setQueryData(['saves'], (current = []) => current.filter((entry) => entry.id !== save.id));
      if (useSession.getState().saveId === save.id) useSession.getState().logout();
      setDeleting(null);
    },
  });
  if (saves.isPending) return <Loading label="Carregando seus saves…" />;
  if (saves.error) return <Failure error={saves.error} retry={saves.refetch} />;
  function openSave(save) {
    selectSave(save);
    client.clear();
    navigate(save.inicialEspecieId ? '/menu' : '/inicial');
  }
  function submit(event) { event.preventDefault(); create.reset(); create.mutate(); }
  return <>
    <PageTitle label="JORNADAS LOCAIS" title="Qual história você vai viver?">Escolha um save neste dispositivo ou crie uma nova jornada. Seu progresso fica no arquivo local do jogo.</PageTitle>
    <div className="save-grid">
      {saves.data.map((save, index) => {
        const started = Boolean(save.iniciadoEm);
        const pokemon = catalogo?.pokemon.find((entry) => entry.id === save.inicialEspecieId);
        return <section className="save-card existing-save" key={save.id}>
          <div className="flex justify-between items-center"><span className="eyebrow">{started ? 'JORNADA SALVA' : 'JORNADA INICIADA'}</span><Save size={21} /></div>
          <div className="save-art">{pokemon ? <PokemonImage pokemon={pokemon} /> : <span className="large-pokeball" />}</div>
          <span className="save-slot">SLOT {String(index + 1).padStart(2, '0')} <span className="status-dot" /></span>
          <h2>{save.nomeTreinador}</h2>
          <p className="muted">{pokemon ? `Você e ${pokemon.nomeExibicao} têm uma história pela frente.` : 'Escolha seu primeiro parceiro e comece a aventura.'}</p>
          <div className="save-meta"><span><MapPin size={15} /> Kanto a Paldea</span><span><Clock3 size={15} /> {new Date(save.atualizadoEm).toLocaleDateString('pt-BR')}</span></div>
          <Button className="w-full mt-6" onClick={() => openSave(save)}>Carregar save <ArrowRight /></Button>
          <Button variant="ghost" className="w-full mt-2" onClick={() => { remove.reset(); setDeleting(save); }}><Trash2 size={16} /> Excluir save</Button>
        </section>;
      })}
      <section className="save-card new-save"><span className="form-icon"><Plus size={24} /></span><h2>Uma nova história.</h2><p className="muted">Cada save tem seu próprio treinador, equipe e progresso.</p>
        <form onSubmit={submit}><label>Nome do treinador<input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Como devemos chamar você?" required minLength={2} maxLength={30} /></label><Button variant="outline" type="submit" className="w-full mt-5" disabled={create.isPending}>{create.isPending ? 'Criando…' : 'Criar novo save'} <Plus /></Button></form>
        {create.error && <p className="error-box mt-4" role="alert">{create.error.message}</p>}
        {remove.error && <p className="error-box mt-4" role="alert">{remove.error.message}</p>}
        <p className="save-warning">Os saves ficam guardados localmente neste dispositivo.</p>
      </section>
    </div>
    <div className="tip"><Leaf size={18} /><span>Todo grande treinador já esteve exatamente aqui.</span><span className="ml-auto">SEUS SAVES LOCAIS</span></div>
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => remove.mutate(deleting)} pending={remove.isPending} error={remove.error} title="Excluir este save?" description={`A jornada de ${deleting?.nomeTreinador ?? 'este treinador'} e todo o progresso dela serão apagados permanentemente.`} confirmLabel="Excluir save" destructive />
  </>;
}
