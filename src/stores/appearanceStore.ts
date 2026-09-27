import { create } from 'zustand'

export type Appearance = 'system' | 'light' | 'dark'

// La misma clave la lee el script en línea de index.html (evita el parpadeo al cargar)
const STORAGE_KEY = 'talkio-appearance'
const THEME_COLOR = { light: '#ffffff', dark: '#000000' }

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

  // Color de la barra del navegador: por media query en "system", fijo si se fuerza
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = THEME_COLOR[appearance === 'system' ? scheme : appearance]
  }
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
