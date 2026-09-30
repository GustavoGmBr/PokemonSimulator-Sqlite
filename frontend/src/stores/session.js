import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSession = create(persist((set) => ({
  token: null,
  usuario: null,
  saveId: null,
  selectSave: (save) => set({ saveId: save.id, usuario: { id: save.id, login: save.nomeTreinador } }),
  logout: () => set({ token: null, usuario: null, saveId: null }),
}), { name: 'pokemon-simulator-local-save', partialize: ({ saveId, usuario }) => ({ saveId, usuario }) }));
