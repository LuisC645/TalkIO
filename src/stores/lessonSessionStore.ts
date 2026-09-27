import { create } from 'zustand'
import type { GradeResult } from '@/features/lessons/types'

export type Stage = 'intro' | 'rule' | 'exercise' | 'done'

/**
 * Estado de cliente de la lección en curso (lo que no vive en el servidor):
 * etapa, ejercicio visible, resultado mostrado en la hoja de retroalimentación y XP de la sesión.
 */
type LessonSessionState = {
  lessonId: string | null
  stage: Stage
  index: number
  result: GradeResult | null
  sessionXp: number
  shownAt: number
  start: (lessonId: string, stage: Stage, index: number) => void
  setStage: (stage: Stage) => void
  showResult: (result: GradeResult) => void
  next: (index: number) => void
}

export const useLessonSession = create<LessonSessionState>((set) => ({
  lessonId: null,
  stage: 'intro',
  index: 0,
  result: null,
  sessionXp: 0,
  shownAt: Date.now(),
  start: (lessonId, stage, index) => set({ lessonId, stage, index, result: null, sessionXp: 0, shownAt: Date.now() }),
  setStage: (stage) => set({ stage, shownAt: Date.now() }),
  showResult: (result) => set((s) => ({ result, sessionXp: s.sessionXp + (result.xp_awarded ?? 0) })),
  next: (index) => set({ index, result: null, shownAt: Date.now() }),
}))
