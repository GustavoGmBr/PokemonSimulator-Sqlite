import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trophy, Sparkles, Footprints, RefreshCw, Swords, Backpack, Users, Check, X } from 'lucide-react';
import { api, assetUrl } from '../lib/api';
import { useCatalogo, useColecao, useSave } from '../lib/queries';
import { displayName, ownedForm } from '../lib/pokemon';
import { PageTitle, Loading, Failure, TypeBadge, typeNames } from '../components/common';
import { SpriteControls, VariantImage } from '../components/PokemonViewer';
import { Button } from '../components/ui/button';
import { BattleSetup } from '../components/BattleSetup';
import { IvStars } from '../components/IvSummary';
import { ivQuality, IV_ITEMS } from '../lib/ivs';
import { isPriorityAutoSearchEncounter } from '../lib/auto-search';
import { captureChanceTone } from '../lib/capture-chance';
import { effectiveness, effectivenessLabel } from '../lib/effectiveness';
import './battle-screen.css';

const ballNames = { 'poke-ball': 'Poké Bola', 'great-ball': 'Grande Bola', 'ultra-ball': 'Ultra Bola', 'master-ball': 'Master Bola', 'fast-ball': 'Bola Rápida', 'timer-ball': 'Bola Psíquica', 'dusk-ball': 'Bola do Crepúsculo', 'dive-ball': 'Bola Aquática', 'net-ball': 'Bola de Rede', 'nest-ball': 'Bola do Ninho', 'repeat-ball': 'Bola Trovão', 'heavy-ball': 'Bola Pesada', 'moon-ball': 'Bola Dracônica', 'level-ball': 'Bola Congelante', 'love-ball': 'Bola das Fadas', 'dream-ball': 'Bola de Sonho', 'heal-ball': 'Bola de Cura', 'luxury-ball': 'Bola de Treino', 'friend-ball': 'Bola Floresta', 'premier-ball': 'Bola Premier', 'sport-ball': 'Bola Incandescente' };
const rewardNames = { 'rare-candy': 'Doce Raro', 'exp-candy-p': 'Doce EXP P', 'exp-candy-m': 'Doce EXP M', 'exp-candy-g': 'Doce EXP G', 'exp-candy-gg': 'Doce EXP GG' };
const healNames = { potion: 'Poção', 'super-potion': 'Superpoção', 'hyper-potion': 'Hiperpoção', 'max-potion': 'Poção Máxima', 'full-restore': 'Restauração Total', antidote: 'Antídoto', 'paralyze-heal': 'Antiparalisia', awakening: 'Despertador', 'burn-heal': 'Antiqueimadura', 'ice-heal': 'Antigelo', 'full-heal': 'Cura Total', revive: 'Reviver', 'max-revive': 'Reviver Máximo' };
const itemEffects = { potion: 'Recupera até 20 HP', 'super-potion': 'Recupera até 50 HP', 'hyper-potion': 'Recupera até 200 HP', 'max-potion': 'Recupera todo o HP', 'full-restore': 'Recupera todo o HP e cura status', antidote: 'Cura envenenamento', 'paralyze-heal': 'Cura paralisia', awakening: 'Acorda o Pokémon', 'burn-heal': 'Cura queimadura', 'ice-heal': 'Cura congelamento', 'full-heal': 'Remove qualquer status', revive: 'Revive com 50% do HP', 'max-revive': 'Revive com todo o HP', 'poke-ball': 'Captura padrão · 1×', 'great-ball': 'Chance de captura · 1,5×', 'ultra-ball': 'Chance de captura · 2×', 'master-ball': 'Captura garantida', 'fast-ball': '6× no primeiro turno', 'timer-ball': '3× contra Pokémon Psíquicos', 'dusk-ball': '4× contra Pokémon Sombrios ou Fantasmas', 'dive-ball': '3,5× contra Pokémon do tipo Água', 'net-ball': '3× contra Água ou Inseto', 'nest-ball': '3× contra Pokémon Voadores', 'repeat-ball': '3× contra Pokémon Elétricos', 'heavy-ball': 'Até 4× conforme peso ou tamanho', 'moon-ball': '3× contra Pokémon Dragões', 'level-ball': '3× contra Pokémon de Gelo', 'love-ball': '3,5× em Fadas; 3× em tipos compartilhados', 'dream-ball': '4× contra Pokémon adormecidos', 'heal-ball': 'Recupera HP e cura status ao capturar', 'luxury-ball': '3× contra Pokémon Lutadores', 'friend-ball': '3× contra Pokémon de Planta', 'premier-ball': 'Visual especial · captura padrão', 'sport-ball': '3× contra Pokémon de Fogo' };
function Life({ name, combatant, wildEncounter = false }) {
  const percent = Math.max(0, Math.min(100, combatant.hp / combatant.maxHp * 100));
  const statusLabels = { burn: 'Queimado', poison: 'Envenenado', paralysis: 'Paralisado', sleep: 'Dormindo', freeze: 'Congelado' };
  return <div className="battle-life"><div><strong>{name}{combatant.shiny ? <Sparkles size={14} aria-label="Shiny" /> : null}</strong><span>Nv. {combatant.nivel}</span></div><IvStars ivs={combatant.ivs} hideZero={wildEncounter} />{combatant.status && <span className="battle-status">{statusLabels[combatant.status] ?? combatant.status}</span>}{combatant.confusionTurns > 0 && <span className="battle-status">Confuso</span>}<div className="battle-life-types">{combatant.tipos.map((type) => <TypeBadge key={type} type={type} />)}</div><div className="battle-life-track"><span style={{ width: `${percent}%`, background: percent < 20 ? '#e47b6c' : percent < 50 ? '#eac86f' : '#a8db75' }} /></div><small>HP {combatant.hp} / {combatant.maxHp}</small></div>;
}

function ItemChoices({ label, items, names, selected, onSelect, busy, showChance = false }) {
  return <div className="battle-item-choices" role="group" aria-label={label}>{items.map((item) => <button type="button" key={item.itemId} className={`battle-item-choice ${selected === item.itemId ? 'selected' : ''}`} aria-pressed={selected === item.itemId} disabled={busy} onClick={() => onSelect(item.itemId)}><img src={assetUrl(`/assets/items/${item.itemId}.png`)} alt="" /><span className="battle-item-choice-copy"><strong>{names[item.itemId]}</strong>{showChance ? <><b className={`battle-capture-chance chance-${captureChanceTone(item.chance)}`} aria-label={`Chance de captura ${item.chance ?? 0}%`}>{item.chance ?? 0}%<small>chance</small></b><small>{itemEffects[item.itemId]}</small></> : <small>{itemEffects[item.itemId]}</small>}<b className="battle-item-quantity">×{item.quantidade} na bolsa</b></span>{selected === item.itemId && <Check size={14} />}</button>)}</div>;
}

function HealingPicker({ healing, chosenHeal, setHealItem, act, busy, combatant }) {
  const fainted = combatant.hp === 0, hpFull = combatant.hp === combatant.maxHp, statusCure = ['antidote', 'paralyze-heal', 'awakening', 'burn-heal', 'ice-heal', 'full-heal', 'full-restore'].includes(chosenHeal);
  const amount = fainted ? Math.max(1, Math.ceil(combatant.maxHp * (chosenHeal === 'revive' ? .5 : 1))) : Math.min(combatant.maxHp - combatant.hp, ({ potion: 20, 'super-potion': 50, 'hyper-potion': 200 })[chosenHeal] ?? combatant.maxHp);
  const hasStatus = Boolean(combatant.status);
  const canUse = fainted || !hpFull || hasStatus;
  return <section className="battle-healing"><div className="battle-item-heading"><strong>Itens de cura</strong><small>{fainted ? 'Seu Pokémon desmaiou' : hasStatus ? `Status: ${combatant.status}` : `Faltam ${combatant.maxHp - combatant.hp} HP`}</small></div>{healing.length ? <ItemChoices label="Item de cura" items={healing} names={healNames} selected={chosenHeal} onSelect={setHealItem} busy={busy || !canUse} /> : <p>{fainted ? 'Nenhum Reviver disponível. Envie uma reserva ou aceite a derrota.' : 'Nenhum item de cura disponível para este Pokémon.'}</p>}<p className="battle-item-preview">{chosenHeal && statusCure ? `${healNames[chosenHeal]} removerá a condição de status${chosenHeal === 'full-heal' || chosenHeal === 'full-restore' ? ' e a Restauração Total também recupera HP' : ''} de ${combatant.nome}.` : hpFull ? 'HP completo: não é necessário gastar um item.' : chosenHeal ? `${healNames[chosenHeal]} recuperará ${amount} HP de ${combatant.nome}.${fainted ? '' : ' Usar um item dá um turno ao adversário.'}` : 'Compre itens de cura no mercado.'}</p><Button variant="outline" disabled={busy || !chosenHeal || !canUse} onClick={() => act('usar-item', { itemId: chosenHeal })}>Usar {healNames[chosenHeal] ?? 'item'}</Button></section>;
}

function BallPicker({ balls, selected, setBall, act, busy }) {
  return <section className="battle-extras"><div className="battle-item-heading"><span><strong>Poké Bolas</strong><small>Chance recalculada após cada ação, com a vida e os status atuais do Pokémon selvagem.</small></span></div><div className="capture-chance-legend" aria-label="Legenda das chances de captura"><span className="chance-low">Abaixo de 25%</span><span className="chance-medium">25%–49%</span><span className="chance-high">50%–98%</span><span className="chance-near">99%–abaixo de 100%</span><span className="chance-guaranteed">100%</span></div>{balls.length ? <ItemChoices label="Poké Bola e chance atual de captura" items={balls} names={ballNames} selected={selected} onSelect={setBall} busy={busy} showChance /> : <p>Nenhuma Poké Bola na bolsa.</p>}<p className="battle-item-preview">{selected === 'master-ball' ? 'A Master Bola garante a captura deste Pokémon.' : `${itemEffects[selected] ?? 'Captura padrão · 1×'}${selected === 'heal-ball' ? '' : ' Se falhar, o adversário terá um turno.'}`}</p><Button variant="outline" disabled={busy || !selected} onClick={() => act('capturar', { itemId: selected })}>Capturar com {ballNames[selected] ?? 'Poké Bola'}</Button></section>;
}

function ReservePicker({ members, byId, act, busy, fainted }) {
  return <section className="battle-reserves"><div className="battle-item-heading"><strong>Equipe de reserva</strong><small>{fainted ? 'Envie seu próximo parceiro' : 'A troca dá um turno ao adversário'}</small></div>{members?.length ? members.map(member => <button type="button" className="battle-reserve-card" key={member.pokemonId} disabled={busy || member.hp === 0} onClick={() => act('trocar', { pokemonId: member.pokemonId })}><VariantImage species={ownedForm(byId.get(member.especieId), member)} shiny={member.shiny} /><span><strong>{member.nome}</strong><small>Nv. {member.nivel} · HP {member.hp}/{member.maxHp}</small><span className="battle-reserve-health"><i style={{width:`${member.hp / member.maxHp * 100}%`}} /></span></span><span>Enviar →</span></button>) : <p className="panel-hint">Nenhum Pokémon na reserva nesta batalha.</p>}</section>;
}

function AttackOption({ move, defenderTypes, types, busy, onAttack }) {
  const multiplier = effectiveness(move.tipo, defenderTypes, types);
  return <button type="button" disabled={busy} onClick={() => onAttack(move.nome)}><strong>{displayName(move.nome)}</strong><TypeBadge type={move.tipo} /><small>{move.categoria === 'status' ? 'Golpe de efeito' : `${move.categoria === 'physical' ? 'Físico' : 'Especial'} · Poder ${move.poder}`}</small><span className={`effectiveness effectiveness-${multiplier > 1 ? 'super' : multiplier < 1 ? 'weak' : 'neutral'}`}>{effectivenessLabel(multiplier)}</span></button>;
}

function BattleMemberCard({ member, species, opponent, types, selected, position, onSelect, levelCap, disabled }) {
  const form = ownedForm(species, member);
  const outgoing = opponent ? Math.max(...form.tipos.map((type) => effectiveness(type, opponent.tipos, types))) : 1;
  const incoming = opponent ? Math.max(...opponent.tipos.map((type) => effectiveness(type, form.tipos, types))) : 1;
  const advantage = outgoing > incoming ? 'advantage' : outgoing < incoming ? 'disadvantage' : 'neutral';
  const label = { advantage: 'Vantagem', disadvantage: 'Desvantagem', neutral: 'Neutro' }[advantage];
  return <button type="button" className={`battle-member ${selected ? 'chosen' : ''}`} aria-pressed={selected} disabled={disabled} onClick={onSelect}><span className="battle-member-order">{position || '+'}</span><VariantImage species={form} mode="2d" shiny={member.shiny} /><span className="battle-member-info"><strong>{member.apelido || form.nomeExibicao}{member.shiny ? ' ✨' : ''}</strong><small>#{String(species.id).padStart(3, '0')} · Nv. {member.nivel}{levelCap && member.nivel > levelCap ? ` → ${levelCap} neste desafio` : ''}</small><span className="battle-member-types">{form.tipos.map((entry) => <TypeBadge key={entry} type={entry} />)}</span><IvStars ivs={member.ivs} /></span>{opponent && <span className={`battle-matchup battle-matchup-${advantage}`}><b>{label}</b><small>Ataque ×{outgoing} · Defesa ×{incoming}</small></span>}</button>;
}

export function BattlePage({ area = 'batalhas' }) {
  const client = useQueryClient();
  const save = useSave();
  const catalog = useCatalogo();
  const collection = useColecao(save.data?.id);
  const challenges = useQuery({ queryKey: ['challenges', save.data?.id], queryFn: () => api('/batalhas/desafios'), enabled: Boolean(save.data?.id) });
  const current = useQuery({ queryKey: ['current-battle', save.data?.id], queryFn: () => api('/batalhas/atual'), enabled: Boolean(save.data?.id), staleTime: 0 });
  const inventory = useQuery({ queryKey: ['inventario', save.data?.usuarioId, save.data?.id], queryFn: () => api('/jogador/inventario'), enabled: Boolean(save.data?.id) });
  const teamsQuery = useQuery({ queryKey: ['teams', save.data?.id], queryFn: () => api('/jogador/equipes'), enabled: Boolean(save.data?.id) });
  const [battle, setBattle] = useState(null);
  const [choice, setChoice] = useState({ tipo: 'treinador', dificuldade: 'facil' });
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [shinyFilter, setShinyFilter] = useState('');
  const [starFilter, setStarFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [teamFilter, setTeamFilter] = useState('');
  const [actionTab, setActionTab] = useState('attack');
  const [mode, setMode] = useState(() => localStorage.getItem('battle-sprite-mode') === '3d' ? '3d' : '2d');
  const [busy, setBusy] = useState(false);
  const autoSearchRef = useRef(false);
  const [autoSearchStatus, setAutoSearchStatus] = useState(null);
  const [error, setError] = useState('');
  const [ball, setBall] = useState('poke-ball');
  const [healItem, setHealItem] = useState('potion');
  const active = battle ?? current.data;
  function changeMode(value) { setMode(value); localStorage.setItem('battle-sprite-mode', value); }
  async function refresh() {
    await Promise.all([client.invalidateQueries({ queryKey: ['current-battle', save.data?.id] }), client.invalidateQueries({ queryKey: ['colecao'] }), client.invalidateQueries({ queryKey: ['inventario'] }), client.invalidateQueries({ queryKey: ['save'] }), client.invalidateQueries({ queryKey: ['challenges'] }), client.invalidateQueries({ queryKey: ['missoes'] }), client.invalidateQueries({ queryKey: ['historico'] })]);
  }
  async function start(requestedChoice = choice) {
    setBusy(true); setError(''); setAutoSearchStatus(null);
    try {
      const state = await api('/batalhas/iniciar', { method: 'POST', body: requestedChoice });
      setBattle(state); setSelected([]); setActionTab('attack'); await refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function act(acao, extra = {}) {
    setBusy(true); setError('');
    try {
      const state = await api('/batalhas/acao', { method: 'POST', body: { batalhaId: active.id, versao: active.versao, acao, ...extra } });
      setBattle(state); if (['procurar', 'fugir', 'escolher'].includes(acao)) setSelected([]); if (['escolher', 'trocar'].includes(acao)) setActionTab('attack'); await refresh();
    } catch (err) { setError(err.message); await current.refetch(); setBattle(null); } finally { setBusy(false); }
  }
  function matchesAutoSearch(opponent, criteria) {
    return (!(criteria.especieIds?.length) || criteria.especieIds.includes(opponent.especieId)) && (!criteria.especieId || opponent.especieId === criteria.especieId) &&
      (criteria.estrelasMin == null || ivQuality(opponent.ivs).stars >= criteria.estrelasMin) &&
      (criteria.estrelasMax == null || ivQuality(opponent.ivs).stars <= criteria.estrelasMax) &&
      (criteria.shiny === 'any' || opponent.shiny === (criteria.shiny === 'shiny'));
  }
  async function startAutoSearch(requestedChoice, criteria) {
    if (busy || !criteria.especieId && !criteria.especieIds?.length && criteria.estrelasMin == null && criteria.estrelasMax == null && criteria.shiny === 'any') return;
    autoSearchRef.current = true;
    setAutoSearchStatus({ running: true, attempts: 0, criteria, stopping: false });
    setBusy(true); setError('');
    let state = null;
    try {
      state = await api('/batalhas/iniciar', { method: 'POST', body: { ...requestedChoice, autoBusca: true, ...(criteria.especieIdsEspecificos?.length ? { autoBuscaEspeciesIds: criteria.especieIdsEspecificos } : {}) } });
      setBattle(state); setSelected([]); setActionTab('attack');
      setAutoSearchStatus({ running: true, attempts: 1, criteria, stopping: false });
      if (state.moedasBusca != null) client.setQueryData(['save', save.data.id], currentSave => currentSave ? { ...currentSave, moedas: state.moedasBusca } : currentSave);
      while (autoSearchRef.current && !matchesAutoSearch(state.oponente, criteria) && !isPriorityAutoSearchEncounter(state.oponente)) {
        await new Promise(resolve => setTimeout(resolve, 180));
        if (!autoSearchRef.current) break;
        state = await api('/batalhas/acao', { method: 'POST', body: { batalhaId: state.id, versao: state.versao, acao: 'procurar-auto' } });
        setBattle(state);
        setAutoSearchStatus(currentStatus => ({ ...currentStatus, attempts: state.buscaTentativas ?? currentStatus.attempts + 1 }));
        if (state.moedasBusca != null) client.setQueryData(['save', save.data.id], currentSave => currentSave ? { ...currentSave, moedas: state.moedasBusca } : currentSave);
      }
      autoSearchRef.current = false;
      setAutoSearchStatus({ running: false, attempts: state?.buscaTentativas ?? 1, criteria, result: state && isPriorityAutoSearchEncounter(state.oponente) ? 'rare' : state && matchesAutoSearch(state.oponente, criteria) ? 'found' : 'stopped', stopping: false });
    } catch (err) {
      autoSearchRef.current = false;
      const validationDetails = err.fields?.map((field) => `${field.field}: ${field.message}`).join(' · ');
      setError(validationDetails ? `${err.message} ${validationDetails}` : err.message);
      setAutoSearchStatus(currentStatus => ({ ...currentStatus, running: false, result: 'stopped', stopping: false }));
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  function stopAutoSearch() {
    if (!autoSearchRef.current) return;
    autoSearchRef.current = false;
    setAutoSearchStatus(currentStatus => currentStatus ? { ...currentStatus, stopping: true } : currentStatus);
  }
  if (save.isPending || catalog.isPending || (save.data?.id && (collection.isPending || challenges.isPending || current.isPending || inventory.isPending || teamsQuery.isPending))) return <Loading label="Preparando arena…" />;
  if (save.error || catalog.error || collection.error || challenges.error || current.error || inventory.error || teamsQuery.error) return <Failure error={save.error || catalog.error || collection.error || challenges.error || current.error || inventory.error || teamsQuery.error} retry={() => { save.refetch(); catalog.refetch(); collection.refetch(); challenges.refetch(); current.refetch(); inventory.refetch(); teamsQuery.refetch(); }} />;
  if (!save.data?.iniciadoEm) return <Navigate to="/saves" replace />;
  if (!save.data.inicialEspecieId) return <Navigate to="/inicial" replace />;
  if (active && !active.resultado && (active.tipo === 'selvagem') !== (area === 'selvagens')) return <Navigate to={active.tipo === 'selvagem' ? '/selvagens' : '/batalha'} replace />;
  const byId = new Map(catalog.data.pokemon.map((entry) => [entry.id, entry]));
  const selectedChallenge = challenges.data.lideres.find((entry) => entry.id === (active?.desafioId ?? choice.desafioId));
  const members = (collection.data ?? []).filter((member) => {
    const species = byId.get(member.especieId);
    const term = search.toLowerCase().trim();
    const form = ownedForm(species, member);
    const [minimumLevel, maximumLevel] = levelFilter ? levelFilter.split('-').map(Number) : [null, null];
    const team = (teamsQuery.data ?? []).find(entry => entry.nome === teamFilter);
    return species && (!favoriteOnly || member.favorito) && (!teamFilter || team?.pokemonIds.includes(member.id)) && (!type || form.tipos.includes(type)) && (!shinyFilter || member.shiny === (shinyFilter === 'shiny')) && (starFilter === '' || ivQuality(member.ivs).stars === Number(starFilter)) && (!levelFilter || (member.nivel >= minimumLevel && member.nivel <= maximumLevel)) && (!term || species.nomeExibicao.toLowerCase().includes(term) || form.nomeExibicao.toLowerCase().includes(term) || member.apelido?.toLowerCase().includes(term) || String(species.id) === term.replace(/^#0*/, ''));
  });
  const balls = (inventory.data ?? []).filter((item) => ballNames[item.itemId] && item.quantidade > 0).map(item => ({ ...item, chance: active?.chancesCaptura?.[item.itemId] ?? 0 }));
  const healing = (inventory.data ?? []).filter((item) => {
    const combatant = active?.jogador;
    if (!healNames[item.itemId] || item.quantidade <= 0) return false;
    if (combatant?.hp === 0) return ['revive', 'max-revive'].includes(item.itemId);
    if (['revive', 'max-revive'].includes(item.itemId)) return false;
    if (['antidote', 'paralyze-heal', 'awakening', 'burn-heal', 'ice-heal'].includes(item.itemId)) return combatant?.status === ({ antidote: 'poison', 'paralyze-heal': 'paralysis', awakening: 'sleep', 'burn-heal': 'burn', 'ice-heal': 'freeze' })[item.itemId];
    if (item.itemId === 'full-heal') return Boolean(combatant?.status);
    return !combatant || combatant.hp < combatant.maxHp || item.itemId === 'full-restore' && Boolean(combatant.status);
  });
  const chosenHeal = healing.some((item) => item.itemId === healItem) ? healItem : healing[0]?.itemId;
  const chosenBall = balls.some((item) => item.itemId === ball) ? ball : balls[0]?.itemId;
  const hasShinyCharm = (inventory.data ?? []).some((item) => item.itemId === 'shiny-charm' && item.quantidade > 0);
  const opponent = active && byId.get(active.oponente.especieId);
  const partnerSpecies = active?.jogador && byId.get(active.jogador.especieId);
  const partner = ownedForm(partnerSpecies, active?.jogador);
  const teamLimit = active?.tipo === 'selvagem' ? 1 : active?.totalOponentes ?? 1;
  function toggleMember(id) { setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : teamLimit === 1 ? [id] : current.length < teamLimit ? [...current, id] : current); }
  const selectedMembers = selected.map(id => collection.data.find(member => member.id === id)).filter(Boolean);
  return <>
    <PageTitle label={area === 'selvagens' ? 'ENCONTROS SELVAGENS · NOVE GERAÇÕES' : 'ARENA DE BATALHAS · DEZ CAMPANHAS'} title={area === 'selvagens' ? 'Explore a região.' : 'Escolha seu próximo desafio.'}>{area === 'selvagens' ? 'Defina o intervalo de níveis liberado pelos desafios. Ao vencer o campeão da região, escolha também a espécie.' : 'Enfrente treinadores, participe de torneios ou vença os desafios e campeões de cada região.'}</PageTitle>
    {area === 'selvagens' && <details className="wild-iv-guide"><summary>O que significam as estrelas do Pokémon selvagem?</summary><p>As estrelas resumem a qualidade dos IVs: valores individuais que contribuem para os atributos do Pokémon. Mais estrelas indicam IVs totais melhores. A classificação não altera o nível nem o tipo do Pokémon.</p><div><span>⭐ 1 estrela: 91–120 pontos</span><span>⭐⭐ 2 estrelas: 121–150 pontos</span><span>⭐⭐⭐ 3 estrelas: 151–185 pontos</span><span>⭐⭐⭐⭐ 4 estrelas: 186 pontos · perfeito</span></div><small>Pokémon com 0 estrelas não exibem um indicador de estrelas.</small></details>}
    <div className="battle-toolbar"><span><Trophy size={16} /> Escolha uma região · Shiny base: <strong>1 em 4096</strong></span><SpriteControls mode={mode} setMode={changeMode} showShiny={false} /></div>
    {error && <p className="battle-error" role="alert">{error}</p>}
    {active ? <div className="battle-active">
      <div className="battle-topline"><span>{active.tipo === 'selvagem' ? 'ENCONTRO SELVAGEM' : `${active.tipo === 'desafio' ? 'DESAFIO' : active.tipo === 'torneio' ? 'TORNEIO' : 'TREINADOR'} · ${active.treinador.toUpperCase()}`}</span><span>{active.resultado ? 'RESULTADO' : active.jogador ? 'EM COMBATE' : 'ESCOLHA SEU PARCEIRO'} · {active.torneio && `TREINADOR ${active.torneio.rodada}/8 · `}RODADA {active.rodada}</span></div>
      {active.tipo === 'selvagem' && (active.oponente.shiny || ivQuality(active.oponente.ivs).stars === 4) && <div className="wild-priority-alert" role="alert"><Sparkles size={18} /><strong>{active.oponente.shiny && ivQuality(active.oponente.ivs).stars === 4 ? 'Shiny e 4 estrelas!' : active.oponente.shiny ? 'Pokémon Shiny!' : 'Pokémon de 4 estrelas!'}</strong><span>Encontro raro: confira o Pokémon antes de continuar.</span></div>}
      {active.tipo === 'selvagem' && autoSearchStatus && <div className={`wild-auto-status ${['found', 'rare'].includes(autoSearchStatus.result) ? 'found' : ''}`} role="status"><span><Sparkles size={17} /><strong>{autoSearchStatus.running ? autoSearchStatus.stopping ? `Parando após o giro atual · ${autoSearchStatus.attempts} tentativas` : `Busca automática em andamento · ${autoSearchStatus.attempts} tentativas` : autoSearchStatus.result === 'rare' ? `Pokémon Shiny ou de 4 estrelas encontrado! Busca pausada após ${autoSearchStatus.attempts} tentativas.` : autoSearchStatus.result === 'found' ? `Encontrado após ${autoSearchStatus.attempts} tentativas!` : `Busca automática parada · ${autoSearchStatus.attempts ?? 0} tentativas`} · {(autoSearchStatus.attempts ?? 0) * 25} ₽ gastos</strong></span>{autoSearchStatus.running && <Button variant="outline" onClick={stopAutoSearch}>Parar busca</Button>}</div>}
      {active.tipo === 'torneio' && !active.resultado && <button className="battle-abandon" type="button" disabled={busy} onClick={() => act('abandonar')}>Abandonar torneio</button>}
      {active.tipo === 'selvagem' && active.intervaloNivel && <p className="panel-hint">Intervalo escolhido: Nv. {active.intervaloNivel.minimo}–{active.intervaloNivel.maximo}{active.regiao === 'todas' ? ` · progresso de ${challenges.data.regioes.find(entry => entry.id === active.regiaoNiveis)?.nome ?? active.regiaoNiveis}` : ''}.</p>}
      <div className="battle-workspace">
      <div className={`battle-arena ${!active.jogador ? 'battle-arena-encounter' : ''}`} aria-label="Arena: seu Pokémon acima e adversário abaixo"><div className="battle-player"><span className="battle-side-label">SEU POKÉMON</span>{active.jogador ? <><VariantImage species={partner} mode={mode} shiny={active.jogador.shiny} /><Life name={active.jogador.nome} combatant={active.jogador} /></> : <div className="battle-empty-player"><Swords size={26} /><strong>Seu parceiro entra aqui</strong><small>Escolha um Pokémon para começar</small></div>}</div><div className="battle-versus" aria-hidden="true"><span />VS<span /></div><div className="battle-foe"><span className="battle-side-label">{active.tipo === 'selvagem' ? 'POKÉMON SELVAGEM' : 'ADVERSÁRIO'}</span><VariantImage species={opponent} mode={mode} shiny={active.oponente.shiny} /><Life name={active.oponente.nome} combatant={active.oponente} wildEncounter={active.tipo === 'selvagem'} /></div></div>
      <div className="battle-console"><div className="battle-log" aria-live="polite"><strong>Registro de batalha</strong>{active.logs.slice(-5).map((entry, index) => <p key={`${active.rodada}-${index}`}>{entry}</p>)}</div>
{active.resultado ? <div className="battle-result"><h2>{({ vitoria: 'Vitória!', derrota: 'Derrota', captura: 'Pokémon capturado!', fuga: 'Você fugiu', desistencia: 'Torneio abandonado' })[active.resultado]}</h2>{active.xpGanho > 0 && <p>Seus Pokémon receberam {active.xpGanho} XP{active.novoNivel ? ` e chegaram ao nível ${active.novoNivel}` : ''}.</p>}{active.resultado === 'vitoria' && <p>Você ganhou {active.moedasGanhas.toLocaleString('pt-BR')} ₽.{active.itensGanhos?.length ? ` Itens: ${active.itensGanhos.map((item) => `${ballNames[item.itemId] ?? healNames[item.itemId] ?? rewardNames[item.itemId] ?? IV_ITEMS.find(entry => entry.nome === item.itemId)?.nomeExibicao ?? item.itemId} ×${item.quantidade}`).join(', ')}.` : ''}</p>}<div className="battle-result-actions"><Button disabled={busy} onClick={() => { setBattle(null); setSelected([]); }}>Escolher próxima batalha</Button>{active.tipo === 'selvagem' && <Button disabled={busy} onClick={() => { setSelected([]); if ((active.oponente.shiny || ivQuality(active.oponente.ivs).stars === 4) && !(window.confirm('Este Pokémon é shiny ou tem 4 estrelas. Deseja mesmo procurar outro e deixar este encontro?'))) return; start({ tipo: 'selvagem', regiao: active.regiao ?? 'kanto', ...(active.buscaEspecieId ? { selvagem: { regiao: active.regiaoEncontro, especieId: active.buscaEspecieId, nivel: active.buscaNivel } } : active.intervaloNivel ? { intervaloNivel: active.intervaloNivel } : {}) }); }}>Procurar novo Pokémon</Button>}{active.tipo === 'treinador' && <Button disabled={busy} onClick={() => { setSelected([]); start({ tipo: 'treinador', dificuldade: active.dificuldade }); }}>Enfrentar outro treinador</Button>}</div></div> : active.jogador ? active.aguardandoReviver ? <div className="battle-actions"><h2>{active.jogador.nome} desmaiou.</h2><p className="panel-hint">Escolha um Pokémon da reserva, use um Reviver ou aceite a derrota.</p><ReservePicker members={active.reservas} {...{byId,act,busy}} fainted /><HealingPicker {...{healing,chosenHeal,setHealItem,act,busy}} combatant={active.jogador} /><Button variant="outline" disabled={busy} onClick={() => act('desistir')}>Aceitar derrota</Button></div> : <div className="battle-actions"><span className="battle-phase">SUA PRÓXIMA AÇÃO</span><h2>O que {active.jogador.nome} vai fazer?</h2><div className="battle-action-tabs" role="tablist" aria-label="Ações de batalha">{[['attack','Ataques',Swords],['items','Bolsa',Backpack],['team','Equipe',Users]].map(([id,label,Icon])=><button type="button" key={id} role="tab" aria-selected={actionTab===id} aria-controls="battle-action-panel" id={'battle-action-'+id} onClick={()=>setActionTab(id)}><Icon size={16} />{label}</button>)}</div><div id="battle-action-panel" role="tabpanel" aria-labelledby={'battle-action-'+actionTab}>{actionTab==='attack' && <div className="battle-moves">{active.jogador.ataques.map((move) => <AttackOption key={move.nome} move={move} defenderTypes={active.oponente.tipos} types={catalog.data.tipos} busy={busy} onAttack={(name) => act('ataque', { golpe: name })} />)}</div>}{actionTab==='items' && <><HealingPicker {...{healing,chosenHeal,setHealItem,act,busy}} combatant={active.jogador} />{active.tipo==='selvagem' && <BallPicker balls={balls} selected={chosenBall} setBall={setBall} act={act} busy={busy} />}</>}{actionTab==='team' && <ReservePicker members={active.reservas} {...{byId,act,busy}} />}</div>{active.tipo==='selvagem' && <button className="battle-flee" disabled={busy} onClick={()=>act('fugir')}><Footprints size={14} />Fugir do encontro</button>}</div> : <div className="battle-actions"><div className="battle-encounter-heading"><span className="battle-phase">{active.tipo === 'selvagem' ? 'NOVO ENCONTRO' : 'PRÓXIMO CONFRONTO'}</span><h2>Escolha seu Pokémon após ver o adversário</h2><p>{active.oponente.nome} · Nv. {active.oponente.nivel} · {active.oponente.tipos.map((entry) => typeNames[entry] ?? entry).join(' / ')}</p>{active.tipo === 'selvagem' && <div className="battle-encounter-actions"><Button variant="outline" disabled={busy} onClick={() => { if ((active.oponente.shiny || ivQuality(active.oponente.ivs).stars === 4) && !(window.confirm('Este Pokémon é shiny ou tem 4 estrelas. Deseja mesmo procurar outro e deixar este encontro?'))) return; act('procurar'); }}><RefreshCw size={16} /> Procurar outro Pokémon</Button><Button variant="outline" disabled={busy} onClick={() => act('fugir')}><Footprints size={16} /> Fugir</Button></div>}</div>{(active.limiteNivel ?? selectedChallenge?.nivel) && <div className="battle-cap">Limite de {active.torneio ? active.torneio.nome : selectedChallenge?.nome ?? "desafio"}: nível {active.limiteNivel ?? selectedChallenge?.nivel}</div>}<div className="battle-team-heading"><strong>Sua equipe · {selected.length}/{teamLimit}</strong><small>O primeiro escolhido entra em campo.</small></div>{selectedMembers.length>0 && <div className="battle-selected-team" aria-label="Ordem da equipe selecionada">{selectedMembers.map((member,index)=><div key={member.id}><b>{index+1}</b><span>{member.apelido || ownedForm(byId.get(member.especieId),member).nomeExibicao}<small>{index ? 'Reserva' : 'Entra primeiro'}</small></span>{index>0 && <button type="button" aria-label={'Enviar '+(member.apelido || byId.get(member.especieId).nomeExibicao)+' primeiro'} disabled={busy} onClick={()=>setSelected(current=>[member.id,...current.filter(id=>id!==member.id)])}>↑</button>}<button type="button" aria-label={'Remover '+(member.apelido || byId.get(member.especieId).nomeExibicao)+' da equipe'} disabled={busy} onClick={()=>toggleMember(member.id)}><X size={14} /></button></div>)}</div>}<div className="collection-filters battle-selection-filters"><label className="search-field battle-filter-name"><Search size={16} /><input aria-label="Filtrar Pokémon para batalha por número ou nome" placeholder="Nº da Pokédex ou nome" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="battle-filter-type" aria-label="Filtrar Pokémon para batalha por tipo" value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos os tipos</option>{Object.entries(typeNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><select className="battle-filter-stars" aria-label="Filtrar Pokémon para batalha por estrelas" value={starFilter} onChange={event=>setStarFilter(event.target.value)}><option value="">Todas as estrelas</option>{[0,1,2,3,4].map(stars=><option key={stars} value={stars}>{stars} estrelas</option>)}</select><select className="battle-filter-level" aria-label="Filtrar Pokémon para batalha por nível" value={levelFilter} onChange={event=>setLevelFilter(event.target.value)}><option value="">Todos os níveis</option>{["1-20","21-40","41-60","61-80","81-100"].map(range=><option key={range} value={range}>Nível {range.replace("-", "–")}</option>)}</select><select className="battle-filter-shiny" aria-label="Filtrar Pokémon para batalha por brilho" value={shinyFilter} onChange={event=>setShinyFilter(event.target.value)}><option value="">Normal e Shiny</option><option value="normal">Normal</option><option value="shiny">Shiny</option></select><select className="battle-filter-team" aria-label="Filtrar por equipe" value={teamFilter} onChange={event => setTeamFilter(event.target.value)}><option value="">Todos os Pokémon</option>{(teamsQuery.data ?? []).map(team => <option key={team.nome} value={team.nome}>Equipe: {team.nome}</option>)}</select><label className="battle-favorite-filter"><input type="checkbox" checked={favoriteOnly} onChange={event => setFavoriteOnly(event.target.checked)} /> Apenas favoritos</label></div><div className="battle-collection">{members.map((member) => <BattleMemberCard key={member.id} member={member} species={byId.get(member.especieId)} opponent={opponent} types={catalog.data.tipos} selected={selected.includes(member.id)} position={selected.indexOf(member.id)+1} disabled={busy || teamLimit>1 && selected.length>=teamLimit && !selected.includes(member.id)} onSelect={() => toggleMember(member.id)} levelCap={active.limiteNivel ?? selectedChallenge?.nivel} />)}{!members.length && <p className="collection-empty">Nenhum Pokémon corresponde aos filtros.</p>}</div><div className="battle-selection-footer"><span>Equipe selecionada · {selected.length}/{teamLimit}</span><Button className="battle-start" disabled={!selected.length || busy} onClick={() => act('escolher', { pokemonIds: selected })}>{busy ? 'Entrando…' : 'Escolher para batalhar'}</Button></div></div>}
      </div>
      </div>
    </div> : <BattleSetup area={area} catalog={catalog.data} challenges={challenges.data} choice={choice} setChoice={setChoice} start={start} startAutoSearch={startAutoSearch} busy={busy} collectionCount={collection.data.length} hasShinyCharm={hasShinyCharm} coins={save.data.moedas} />}
  </>;
}
