import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, BookOpen, LogOut, MapPin, CircleDot, Swords, Store, UserRound, Trees, ListChecks, Dices, BadgeDollarSign, Save } from 'lucide-react';
import { useSession } from '../stores/session';
import { Brand } from './common';
import { Button } from './ui/button';

export function Layout() {
  const usuario = useSession((state) => state.usuario);
  const navigate = useNavigate();
  const trainer = usuario?.login ?? 'Treinador';
  return <div className="app-layout">
    <aside className="sidebar">
      <Brand />
      <div className="sidebar-region"><MapPin size={14} /> KANTO A PALDEA <span>01–09</span></div>
      <nav aria-label="Navegação principal">
        <NavLink to="/menu"><Home size={19} /> Início</NavLink>
        <NavLink to="/pokedex"><BookOpen size={19} /> Pokédex <span className="nav-count">1025</span></NavLink>
        <NavLink to="/selvagens"><Trees size={19} /> Selvagens</NavLink>
        <NavLink to="/batalha"><Swords size={19} /> Batalhas</NavLink>
        <NavLink to="/loja"><Store size={19} /> Loja</NavLink>
        <NavLink to="/mercado"><BadgeDollarSign size={19} /> Mercado Pokémon</NavLink>
        <NavLink to="/cassino"><Dices size={19} /> Pokécassino</NavLink>
        <NavLink to="/missoes"><ListChecks size={19} /> Missões</NavLink>
        <NavLink to="/perfil"><UserRound size={19} /> Perfil</NavLink>
        <NavLink to="/saves"><Save size={19} /> Trocar save</NavLink>
      </nav>
      <div className="sidebar-bottom"><div className="trainer-avatar">{trainer.slice(0, 1).toUpperCase()}</div><div><strong>{trainer}</strong><small>Save local</small></div><Button variant="ghost" size="icon" onClick={() => navigate('/saves')} aria-label="Trocar save"><LogOut size={18} /></Button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span><CircleDot size={14} /> SEU PRÓXIMO CAPÍTULO COMEÇA AQUI</span><span className="edition">NOVE GERAÇÕES <span className="status-dot" /></span></header>
      <main className="main-content"><Outlet /></main>
      <footer className="app-footer"><span>POKÉMON SIMULATOR</span><span>Uma jornada. 1.025 possibilidades.</span></footer>
    </div>
  </div>;
}
