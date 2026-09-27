import { useSoundStore } from '@/stores/soundStore'

/**
 * Sonidos de lecciones y repasos, sintetizados con Web Audio (sin archivos que descargar).
 * Cortos, suaves y a volumen bajo: acompañan la respuesta, no la tapan. Siempre se disparan
 * desde un toque o una tecla, así que el navegador permite reproducirlos.
 */
export type Sound = 'correct' | 'wrong' | 'flip' | 'again' | 'complete'

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number }

const SOUNDS: Record<Sound, Note[]> = {
  // Dos notas ascendentes (quinta): acierto
  correct: [
    { freq: 784, at: 0, dur: 0.12 },
    { freq: 1175, at: 0.08, dur: 0.22 },
  ],
  // Dos notas graves descendentes, más suaves: error (informa sin castigar)
  wrong: [
    { freq: 330, at: 0, dur: 0.14, type: 'triangle', gain: 0.7 },
    { freq: 262, at: 0.11, dur: 0.22, type: 'triangle', gain: 0.7 },
  ],
  // Toque breve: voltear tarjeta
  flip: [{ freq: 1320, at: 0, dur: 0.05, gain: 0.35 }],
  // "Otra vez" en repaso: una sola nota neutra
  again: [{ freq: 392, at: 0, dur: 0.14, type: 'triangle', gain: 0.6 }],
  // Arpegio mayor: lección o sesión completada
  complete: [
    { freq: 523, at: 0, dur: 0.14 },
    { freq: 659, at: 0.1, dur: 0.14 },
    { freq: 784, at: 0.2, dur: 0.14 },
    { freq: 1047, at: 0.3, dur: 0.4 },
  ],
}

const VOLUME = 0.12
let ctx: AudioContext | null = null

function context() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function playSound(sound: Sound) {
  if (!useSoundStore.getState().enabled) return
  try {
    const ac = context()
    if (!ac) return
    const start = ac.currentTime + 0.01
    for (const n of SOUNDS[sound]) {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = n.type ?? 'sine'
      osc.frequency.value = n.freq
      // Envolvente: ataque corto y caída exponencial (sin clics)
      const t = start + n.at
      const peak = VOLUME * (n.gain ?? 1)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur)
      osc.connect(gain).connect(ac.destination)
      osc.start(t)
      osc.stop(t + n.dur + 0.02)
    }
  } catch {
    // sin audio disponible: la app sigue funcionando en silencio
  }
}
