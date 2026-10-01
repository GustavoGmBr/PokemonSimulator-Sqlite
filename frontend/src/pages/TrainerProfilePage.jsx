import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, BadgeCheck, ChevronRight, Flag, LockKeyhole, Map, Save, Trophy } from 'lucide-react';
import { useSave } from '../lib/queries';
import { api } from '../lib/api';
import { Failure, Loading, PageTitle, TypeBadge } from '../components/common';
import { HistoryPanel } from '../components/JourneyPanels';
import './trainer-profile.css';

const badgeNames = {
  brock: 'Rocha', misty: 'Cascata', 'lt-surge': 'Trovão', erika: 'Arco-Íris', koga: 'Alma', sabrina: 'Pântano', blaine: 'Vulcão', giovanni: 'Terra',
  'johto-falkner': 'Zéfiro', 'johto-bugsy': 'Colmeia', 'johto-whitney': 'Planície', 'johto-morty': 'Névoa',
  'johto-chuck': 'Tempestade', 'johto-jasmine': 'Mineral', 'johto-pryce': 'Glacial', 'johto-clair': 'Dragão',
  'hoenn-roxanne': 'Pedra', 'hoenn-brawly': 'Punho', 'hoenn-wattson': 'Dínamo', 'hoenn-flannery': 'Calor',
  'hoenn-norman': 'Equilíbrio', 'hoenn-winona': 'Pluma', 'hoenn-tate-liza': 'Mente', 'hoenn-wallace': 'Chuva',
  'sinnoh-roark': 'Carvão', 'sinnoh-gardenia': 'Floresta', 'sinnoh-fantina': 'Relíquia', 'sinnoh-maylene': 'Pedregulho',
  'sinnoh-wake': 'Pântano', 'sinnoh-byron': 'Mina', 'sinnoh-candice': 'Sincelo', 'sinnoh-volkner': 'Farol',
  'unova1-cilan': 'Trio', 'unova1-lenora': 'Básica', 'unova1-burgh': 'Inseto', 'unova1-elesa': 'Volt',
  'unova1-clay': 'Abalo', 'unova1-skyla': 'Jato', 'unova1-brycen': 'Sincelo', 'unova1-drayden': 'Lenda',
  'unova2-cheren': 'Básica', 'unova2-roxie': 'Tóxica', 'unova2-burgh': 'Inseto', 'unova2-elesa': 'Volt',
  'unova2-clay': 'Abalo', 'unova2-skyla': 'Jato', 'unova2-drayden': 'Lenda', 'unova2-marlon': 'Onda',
  'kalos-viola': 'Inseto', 'kalos-grant': 'Penhasco', 'kalos-korrina': 'Briga', 'kalos-ramos': 'Planta',
  'kalos-clemont': 'Voltagem', 'kalos-valerie': 'Fada', 'kalos-olympia': 'Psíquica', 'kalos-wulfric': 'Iceberg',
  'alola-ilima': 'Ilima', 'alola-lana': 'Lana', 'alola-kiawe': 'Kiawe', 'alola-mallow': 'Mallow',
  'alola-sophocles': 'Sophocles', 'alola-acerola-trial': 'Acerola', 'alola-mina': 'Mina', 'alola-hapu': 'Hapu',
  'galar-milo': 'Planta', 'galar-nessa': 'Água', 'galar-kabu': 'Fogo', 'galar-bea': 'Luta',
  'galar-opal': 'Fada', 'galar-gordie': 'Rocha', 'galar-piers': 'Trevas', 'galar-raihan': 'Dragão',
  'paldea-katy': 'Inseto', 'paldea-brassius': 'Planta', 'paldea-iono': 'Elétrico', 'paldea-kofu': 'Água',
  'paldea-larry': 'Normal', 'paldea-ryme': 'Fantasma', 'paldea-tulip': 'Psíquico', 'paldea-grusha': 'Gelo',
};

export function TrainerProfilePage() {
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const save = useSave();
  const challenges = useQuery({ queryKey: ['challenges', save.data?.id], queryFn: () => api('/batalhas/desafios'), enabled: Boolean(save.data?.id) });
  if (save.isPending || (save.data?.id && challenges.isPending)) return <Loading label="Carregando perfil…" />;
  if (save.error || challenges.error) return <Failure error={save.error || challenges.error} retry={() => { save.refetch(); challenges.refetch(); }} />;
  if (!save.data?.iniciadoEm) return <Navigate to="/saves" replace />;
  if (!save.data.inicialEspecieId) return <Navigate to="/inicial" replace />;

  const regions = challenges.data.regioes;
  const allChallenges = challenges.data.lideres;
  const completedChallenges = allChallenges.filter((entry) => entry.vencido).length;
  const kantoBadges = allChallenges.filter((entry) => entry.regiao === 'kanto' && entry.categoria === 'ginásio' && entry.vencido).length;
  const progress = allChallenges.length ? Math.round(completedChallenges / allChallenges.length * 100) : 0;
  const region = regions.find((entry) => entry.id === selectedRegionId) ?? regions.filter((entry) => entry.desbloqueada).at(-1) ?? regions[0];
  const leaders = allChallenges.filter((entry) => entry.regiao === region.id);
  const gyms = leaders.filter((entry) => entry.categoria === 'ginásio');
  const finals = leaders.filter((entry) => entry.categoria !== 'ginásio');
  const doneInRegion = leaders.filter((entry) => entry.vencido).length;
  const generationName = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][region.geracao - 1];
  const nextChallenge = leaders.find((entry) => !entry.vencido);
  return <div className="trainer-profile-page"><PageTitle label="PERFIL DO TREINADOR" title="Sua jornada, em um só lugar.">Acompanhe suas vitórias, insígnias e progresso por região.</PageTitle>
    <section className="profile-hero"><div className="profile-emblem"><Award size={34} /></div><div className="profile-hero-copy"><span>TREINADOR</span><h2>{save.data.nomeTreinador}</h2><p>{region.concluida ? `Campeão de ${region.nome}` : `Próximo objetivo: ${nextChallenge?.nome ?? 'jornada concluída'}`}</p><div className="profile-progress-track" role="progressbar" aria-label="Progresso geral dos desafios" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div><small>{completedChallenges} de {allChallenges.length} desafios concluídos · {progress}%</small></div><div className="profile-hero-stat"><strong>{regions.filter((entry) => entry.concluida).length}</strong><span>regiões<br />concluídas</span></div></section>
    <div className="profile-metrics"><article><Trophy /><strong>{save.data.vitorias}</strong><span>Vitórias</span></article><article><BadgeCheck /><strong>{kantoBadges}/8</strong><span>Insígnias de Kanto</span></article><article><Flag /><strong>{completedChallenges}</strong><span>Desafios concluídos</span></article><article><Map /><strong>{regions.filter((entry) => entry.desbloqueada).length}/{regions.length}</strong><span>Regiões liberadas</span></article></div>
    <section className="profile-region-browser"><div className="profile-section-intro"><div><span>PROGRESSO POR REGIÃO</span><h2>Suas conquistas</h2></div><p>Escolha uma região para ver seus desafios.</p></div><div className="profile-region-tabs" role="tablist" aria-label="Regiões dos desafios">{regions.map((entry) => { const count = allChallenges.filter((challenge) => challenge.regiao === entry.id && challenge.vencido).length; const selected = entry.id === region.id; return <button type="button" role="tab" aria-selected={selected} key={entry.id} className={`${selected ? 'selected' : ''} ${!entry.desbloqueada ? 'locked' : ''}`} onClick={() => setSelectedRegionId(entry.id)}><span>{entry.concluida ? <BadgeCheck size={16} /> : !entry.desbloqueada ? <LockKeyhole size={14} /> : <Map size={15} />}{entry.nome}</span><small>{count}/{allChallenges.filter((challenge) => challenge.regiao === entry.id).length}</small></button>; })}</div>
      <section className="profile-region profile-region-detail" role="tabpanel"><div className="profile-region-title"><div><span>GERAÇÃO {generationName}</span><h2>{region.nome}</h2></div><strong className={region.concluida ? 'region-state complete' : region.desbloqueada ? 'region-state active' : 'region-state locked'}>{region.concluida ? 'Concluída' : region.desbloqueada ? 'Em progresso' : 'Bloqueada'}</strong></div><div className="region-progress-copy"><span>{doneInRegion} de {leaders.length} desafios</span><span>{leaders.length ? Math.round(doneInRegion / leaders.length * 100) : 0}%</span></div><div className="profile-progress-track region-track"><span style={{ width: `${leaders.length ? doneInRegion / leaders.length * 100 : 0}%` }} /></div>
        {!region.desbloqueada && <p className="profile-lock-note"><LockKeyhole size={16} /> Conclua os desafios da etapa anterior para liberar {region.nome}.</p>}
        <h3>{region.challengeLabel === 'Provas Insulares' ? 'Provas Insulares' : 'Insígnias dos ginásios'}</h3><div className="badge-grid">{gyms.map((leader) => <article className={`gym-badge ${leader.vencido ? 'earned' : ''}`} key={leader.id}><div className="badge-medal">{leader.vencido ? <Award size={27} /> : <LockKeyhole size={21} />}</div><strong>{region.challengeLabel === 'Provas Insulares' ? 'Prova' : 'Insígnia'} {badgeNames[leader.id] ?? leader.nome}</strong><small>{leader.nome}</small><TypeBadge type={leader.tipo} /></article>)}</div><h3>{region.eliteLabel ?? 'Desafios finais'} e campeão</h3><div className="elite-progress">{finals.map((leader) => <span className={leader.vencido ? 'earned' : ''} key={leader.id}>{leader.vencido ? <Trophy size={15} /> : <LockKeyhole size={15} />}{leader.nome}</span>)}</div></section>
    </section>
    <section className="profile-region profile-save-card"><div className="section-heading"><div><span>AVENTURA LOCAL</span><h2>Seu save</h2></div><Save size={20} /></div><p>Gerencie suas jornadas salvas ou troque de treinador.</p><Link className="profile-save-link" to="/saves"><Save size={16} /> Gerenciar saves <ChevronRight size={15} /></Link></section>
    <HistoryPanel saveId={save.data.id} />
  </div>;
}
