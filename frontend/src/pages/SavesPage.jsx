import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Clock3, MapPin, Save, Leaf, Trash2, Download, Upload, FileUp } from 'lucide-react';
import { useSession } from '../stores/session';
import { useCatalogo } from '../lib/queries';
import { api } from '../lib/api';
import { PageTitle, Loading, Failure, PokemonImage } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function SavesPage() {
  const [nome, setNome] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [archive, setArchive] = useState(null);
  const [archiveName, setArchiveName] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [replaceSaveId, setReplaceSaveId] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(null);
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
  const importSave = useMutation({
    mutationFn: ({ replacingId }) => api('/jogador/saves/importar', { method: 'POST', body: { arquivo: archive, ...(replacingId ? { substituirSaveId: replacingId } : {}) } }),
    onSuccess: async () => {
      setConfirmReplace(null);
      setArchive(null);
      setArchiveName('');
      setReplaceSaveId('');
      setArchiveError('');
      client.clear();
      await client.invalidateQueries({ queryKey: ['saves'] });
      await saves.refetch();
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
  async function selectArchive(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setArchive(null); setArchiveName(''); setArchiveError(''); importSave.reset();
    if (!file) return;
    if (file.size > 32 * 1024 * 1024) { setArchiveError('O arquivo ultrapassa o limite de 32 MB.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== 'pokemon-simulator-save' || parsed?.formatVersion !== 1 || !parsed?.data?.save?.nomeTreinador) throw new Error('Este arquivo não parece ser um save exportado pelo Pokémon Simulator.');
      setArchive(parsed); setArchiveName(file.name);
    } catch (error) { setArchiveError(error instanceof SyntaxError ? 'Não foi possível ler o arquivo. Selecione um arquivo JSON de save válido.' : error.message); }
  }
  async function exportSave(save) {
    try {
      const data = await api(`/jogador/saves/${save.id}/exportar`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const trainer = save.nomeTreinador.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'Treinador';
      anchor.href = url; anchor.download = `PokemonSimulator-${trainer}-${new Date().toISOString().slice(0, 10)}.pokemon-save.json`;
      anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setArchiveError(error.message); }
  }
  function startImport() {
    if (!archive) return;
    if (replaceSaveId) setConfirmReplace(saves.data.find((save) => save.id === replaceSaveId));
    else importSave.mutate({ replacingId: null });
  }
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
          <Button variant="outline" className="w-full mt-2" onClick={() => exportSave(save)}><Download size={16} /> Exportar save</Button>
          <Button variant="ghost" className="w-full mt-2" onClick={() => { remove.reset(); setDeleting(save); }}><Trash2 size={16} /> Excluir save</Button>
        </section>;
      })}
      <section className="save-card new-save"><span className="form-icon"><Plus size={24} /></span><h2>Uma nova história.</h2><p className="muted">Cada save tem seu próprio treinador, equipe e progresso.</p>
        <form onSubmit={submit}><label>Nome do treinador<input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Como devemos chamar você?" required minLength={2} maxLength={30} /></label><Button variant="outline" type="submit" className="w-full mt-5" disabled={create.isPending}>{create.isPending ? 'Criando…' : 'Criar novo save'} <Plus /></Button></form>
        {create.error && <p className="error-box mt-4" role="alert">{create.error.message}</p>}
        {remove.error && <p className="error-box mt-4" role="alert">{remove.error.message}</p>}
        <p className="save-warning">Os saves ficam guardados localmente neste dispositivo.</p>
      </section>
      <section className="save-card import-save"><span className="form-icon"><FileUp size={24} /></span><h2>Trazer uma jornada.</h2><p className="muted">Importe um arquivo exportado para continuar em outro dispositivo ou restaurar uma cópia de segurança.</p>
        <label className="archive-file-label">Arquivo do save<input type="file" accept=".json,application/json" onChange={selectArchive} /></label>
        {archive && <p className="archive-preview"><Save size={16} /> {archive.data.save.nomeTreinador} <span>·</span> {archiveName}</p>}
        <label className="archive-replace-label">Importar como
          <select value={replaceSaveId} onChange={(event) => setReplaceSaveId(event.target.value)}>
            <option value="">Novo save (mantém os saves atuais)</option>
            {saves.data.map((save) => <option key={save.id} value={save.id}>Substituir “{save.nomeTreinador}”</option>)}
          </select>
        </label>
        <Button variant="outline" className="w-full mt-5" onClick={startImport} disabled={!archive || importSave.isPending}>{importSave.isPending ? 'Importando…' : <><Upload size={16} /> Importar save</>}</Button>
        {archiveError && <p className="error-box mt-4" role="alert">{archiveError}</p>}
        {importSave.error && <p className="error-box mt-4" role="alert">{importSave.error.message}</p>}
        {importSave.isSuccess && <p className="archive-success mt-4" role="status">Save importado. Ele já aparece na lista de jornadas.</p>}
        <p className="save-warning">Ao substituir, o conteúdo atual do save escolhido será trocado pelo arquivo importado.</p>
      </section>
    </div>
    <div className="tip"><Leaf size={18} /><span>Todo grande treinador já esteve exatamente aqui.</span><span className="ml-auto">SEUS SAVES LOCAIS</span></div>
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => remove.mutate(deleting)} pending={remove.isPending} error={remove.error} title="Excluir este save?" description={`A jornada de ${deleting?.nomeTreinador ?? 'este treinador'} e todo o progresso dela serão apagados permanentemente.`} confirmLabel="Excluir save" destructive />
    <ConfirmDialog open={Boolean(confirmReplace)} onOpenChange={(open) => { if (!open) setConfirmReplace(null); }} onConfirm={() => importSave.mutate({ replacingId: confirmReplace?.id })} pending={importSave.isPending} error={importSave.error} title="Substituir este save?" description={`O save “${confirmReplace?.nomeTreinador ?? ''}” será substituído integralmente pela jornada “${archive?.data?.save?.nomeTreinador ?? ''}” do arquivo selecionado. Esta ação não pode ser desfeita.`} confirmLabel="Substituir save" destructive />
  </>;
}
