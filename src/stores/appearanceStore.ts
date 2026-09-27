import { create } from 'zustand'
import { syncThemeColor } from '@/lib/surface'

export type Appearance = 'system' | 'light' | 'dark'

// La misma clave la lee el script en línea de index.html (evita el parpadeo al cargar)
const STORAGE_KEY = 'talkio-appearance'

function read(): Appearance {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(appearance: Appearance) {
  const root = document.documentElement
  if (appearance === 'system') delete root.dataset.theme
  else root.dataset.theme = appearance

  // Color de la interfaz del navegador: el del fondo real de la página
  syncThemeColor()
}

type AppearanceState = {
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  appearance: read(),
  setAppearance: (appearance) => {
    apply(appearance)
    try {
      if (appearance === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, appearance)
    } catch {
      // Sin almacenamiento: la elección dura solo esta sesión
    }
    set({ appearance })
  },
}))
