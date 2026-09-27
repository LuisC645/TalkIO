import { create } from 'zustand'

/** Paneles laterales de la capa funcional (hoja inferior en móvil, cajón a la derecha desde md) */
export type Panel = 'friends' | 'notifications'

type UiState = {
  panel: Panel | null
  openPanel: (panel: Panel) => void
  closePanel: () => void
}

export const useUiStore = create<UiState>((set) => ({
  panel: null,
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
}))
