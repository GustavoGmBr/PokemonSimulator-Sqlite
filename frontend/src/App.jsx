import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from './stores/session';
import { api } from './lib/api';
import { Loading, Failure } from './components/common';
import { Layout } from './components/Layout';
import { SavesPage } from './pages/SavesPage';
import { StarterPage } from './pages/StarterPage';
import { MenuPage } from './pages/MenuPage';
import { PokedexPage } from './pages/PokedexPage';
import { BattlePage } from './pages/BattlePage';
import { ShopPage } from './pages/ShopPage';
import { TrainerProfilePage } from './pages/TrainerProfilePage';
import { MissionsPage } from './pages/MissionsPage';
import { CasinoPage } from './pages/CasinoPage';
import { MarketPage } from './pages/MarketPage';
import { TeamsPage } from './pages/TeamsPage';

function ProtectedRoute() {
  const saveId = useSession((state) => state.saveId);
  const query = useQuery({ queryKey: ['save', saveId], queryFn: () => api('/jogador/save'), enabled: Boolean(saveId), staleTime: 60_000, retry: false });
  if (!saveId) return <Navigate to="/saves" replace />;
  if (query.isPending) return <Loading label="Carregando seu save…" />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return <Outlet />;
}
export default function App() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <Routes><Route element={<Layout />}>
      <Route path="/saves" element={<SavesPage />} />
      <Route element={<ProtectedRoute />}>
      <Route path="/inicial" element={<StarterPage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/pokedex" element={<PokedexPage />} />
      <Route path="/equipes" element={<TeamsPage />} />
      <Route path="/selvagens" element={<BattlePage area="selvagens" />} />
      <Route path="/batalha" element={<BattlePage area="batalhas" />} />
      <Route path="/perfil" element={<TrainerProfilePage />} />
      <Route path="/missoes" element={<MissionsPage />} />
      <Route path="/loja" element={<ShopPage />} />
      <Route path="/cassino" element={<CasinoPage />} />
      <Route path="/mercado" element={<MarketPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/saves" replace />} />
  </Routes>;
}
