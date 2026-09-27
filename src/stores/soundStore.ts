import { create } from 'zustand'

// Preferencia por dispositivo (como la apariencia): el sonido depende de dónde estudias
const STORAGE_KEY = 'talkio-sound'

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

type SoundState = {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

export const useSoundStore = create<SoundState>((set) => ({
  enabled: read(),
  setEnabled: (enabled) => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
    } catch {
      // sin almacenamiento: la elección dura solo esta sesión
    }
    set({ enabled })
  },
}))
