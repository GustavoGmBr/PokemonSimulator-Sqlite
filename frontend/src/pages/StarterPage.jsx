import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Leaf, Flame, Droplets } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSave, useCatalogo } from '../lib/queries';
import { api } from '../lib/api';
import { PageTitle, Loading, Failure, PokemonImage, TypeBadge } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ConfirmDialog';

const details = {
  1: { icon: Leaf, description: 'Calmo e leal. Um pequeno broto com um enorme potencial.', theme: 'grass' },
  4: { icon: Flame, description: 'Corajoso e cheio de energia. A chama de uma grande amizade.', theme: 'fire' },
  7: { icon: Droplets, description: 'Companheiro e determinado. Pronto para mergulhar na aventura.', theme: 'water' },
};
export function StarterPage() {
  const saveQuery = useSave();
  const catalogQuery = useCatalogo();
  const [selected, setSelected] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const client = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: () => api('/jogador/inicial', { method: 'POST', body: { saveId: saveQuery.data.id, especieId: selected } }),
    onSuccess: (save) => { client.setQueryData(['save', save.id], save); for (const key of ['time', 'colecao']) client.invalidateQueries({ queryKey: [key] }); navigate('/menu', { replace: true }); },
    onError: (error) => { if (error.status === 409) saveQuery.refetch(); },
  });
  if (saveQuery.isPending || catalogQuery.isPending) return <Loading label="Preparando seus primeiros parceiros…" />;
  if (saveQuery.error || catalogQuery.error) return <Failure error={saveQuery.error || catalogQuery.error} retry={() => { saveQuery.refetch(); catalogQuery.refetch(); }} />;
  if (!saveQuery.data?.iniciadoEm) return <Navigate to="/saves" replace />;
  if (saveQuery.data.inicialEspecieId) return <Navigate to="/menu" replace />;
  const starters = [1, 4, 7].map((id) => catalogQuery.data.pokemon.find((entry) => entry.id === id)).filter(Boolean);
  const chosen = starters.find((entry) => entry.id === selected);
  return <>
    <div className="step-indicator"><span className="complete"><Check size={12} /> SAVE CRIADO</span><i /><span className="current">02 · SEU PRIMEIRO POKÉMON</span><i /><span>03 · SUA JORNADA</span></div>
    <PageTitle label="LABORATÓRIO CARVALHO · KANTO" title="Uma escolha. Uma amizade para sempre.">Olá, {saveQuery.data.nomeTreinador}. Sua jornada começa com um dos três parceiros da primeira geração: Bulbasaur, Charmander ou Squirtle.</PageTitle>
    <div className="starter-grid" role="group" aria-label="Escolha seu Pokémon inicial">
      {starters.map((pokemon, index) => {
        const detail = details[pokemon.id]; const Icon = detail.icon;
        return <motion.button key={pokemon.id} type="button" className={`starter-card ${detail.theme} ${selected === pokemon.id ? 'chosen' : ''}`} aria-pressed={selected === pokemon.id} onClick={() => setSelected(pokemon.id)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .08 }}>
          <div className="starter-card-top"><span>#{String(pokemon.id).padStart(3, '0')}</span><span className="selection-mark">{selected === pokemon.id && <Check size={15} />}</span></div>
          <div className="starter-picture"><span className="element-watermark"><Icon /></span><PokemonImage pokemon={pokemon} /></div>
          <div className="starter-info"><span className="starter-level">INICIAL · NÍVEL 05</span><h2>{pokemon.nomeExibicao}</h2><div className="flex gap-2 justify-center">{pokemon.tipos.map((type) => <TypeBadge key={type} type={type} />)}</div><p>{detail.description}</p><div className="starter-stats"><span><strong>{pokemon.atributosBase.hp}</strong>HP BASE</span><span><strong>{pokemon.atributosBase.attack}</strong>ATAQUE</span><span><strong>{pokemon.atributosBase.defense}</strong>DEFESA</span></div></div>
        </motion.button>;
      })}
    </div>
    <div className="selection-footer"><div><strong>Todo parceiro tem o seu potencial.</strong><p className="muted">Seu inicial começará no nível 5, com IVs perfeitos.</p></div><Button disabled={!chosen} onClick={() => { mutation.reset(); setConfirm(true); }}>Escolher {chosen?.nomeExibicao}<ArrowRight /></Button></div>
    {chosen && <ConfirmDialog open={confirm} onOpenChange={setConfirm} onConfirm={() => mutation.mutate()} pending={mutation.isPending} error={mutation.error} title={`${chosen.nomeExibicao}, eu escolho você!`} description="Este será seu primeiro parceiro na coleção. Você só pode escolher um inicial por save." confirmLabel="Confirmar meu parceiro" />}
  </>;
}
