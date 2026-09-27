import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invokeFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Attempt, Exercise, ExerciseResponse, GradeResult, LessonKind, LessonRule } from './types'

export const lessonKeys = {
  all: ['lessons'] as const,
  active: (userId?: string) => ['lessons', 'active', userId] as const,
  history: (userId?: string) => ['lessons', 'history', userId] as const,
  detail: (id: string) => ['lessons', 'detail', id] as const,
}

/** Lección sin terminar (ready / in_progress) con su avance (solo lecciones, no exámenes) */
export function useActiveLesson() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: lessonKeys.active(userId),
    enabled: !!userId,
    // Mientras no haya lección, se revisa cada 15 s: la preparación en segundo plano (al abrir la
    // app) la deja lista en unos segundos y aparece sola, sin pulsar "Generar"
    refetchInterval: (query) => (query.state.data ? false : 15_000),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, status, generated_at, focus_pattern_ids, round, meta')
        .eq('kind', 'lesson')
        .in('status', ['ready', 'in_progress'])
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const [{ count: total }, { count: done }] = await Promise.all([
        supabase.from('exercises_public').select('id', { count: 'exact', head: true }).eq('lesson_id', data.id),
        supabase.from('exercise_attempts').select('id', { count: 'exact', head: true }).eq('lesson_id', data.id).eq('round', data.round),
      ])
      return { ...data, total: total ?? 0, done: done ?? 0 }
    },
  })
}

export function useLessonHistory() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: lessonKeys.history(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, completed_at, score, xp_earned, round')
        .eq('kind', 'lesson')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
  })
}

/** Patrones de error de una lección (foco en la intro y progreso en la pantalla final) */
export function useLessonPatterns(ids: string[] | undefined) {
  return useQuery({
    queryKey: ['patterns', 'lesson', ...(ids ?? [])],
    enabled: !!ids?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_patterns')
        .select('id, code, title, correct_streak, mastery_threshold, status')
        .in('id', ids!)
      if (error) throw error
      return data
    },
  })
}

export type LessonDetail = {
  id: string
  title: string
  status: string
  kind: LessonKind
  round: number
  meta: Record<string, unknown>
  covers: string | null
  summary: string | null
  score: number | null
  xp_earned: number
  rule: LessonRule | null
  focus_pattern_ids: string[]
  exercises: Exercise[]
  attempts: Map<string, Attempt>
}

export function useLesson(id: string) {
  return useQuery({
    queryKey: lessonKeys.detail(id),
    queryFn: async (): Promise<LessonDetail> => {
      const lessonRes = await supabase
        .from('lessons')
        .select('id, title, status, score, xp_earned, content, focus_pattern_ids, kind, round, meta')
        .eq('id', id)
        .single()
      if (lessonRes.error) throw lessonRes.error
      const round = lessonRes.data.round
      const [exercisesRes, attemptsRes] = await Promise.all([
        supabase
          .from('exercises_public')
          .select('id, lesson_id, position, phase, type, grading, payload, target_pattern_id')
          .eq('lesson_id', id)
          .order('position'),
        // Solo los intentos de la ronda actual (repetir una lección abre una ronda nueva)
        supabase.from('exercise_attempts').select('id, exercise_id, response, is_correct, score, feedback').eq('lesson_id', id).eq('round', round),
      ])
      if (exercisesRes.error) throw exercisesRes.error
      if (attemptsRes.error) throw attemptsRes.error
      const content = (lessonRes.data.content ?? {}) as { rule?: LessonRule | null; covers?: string; summary?: string }
      return {
        id: lessonRes.data.id,
        title: lessonRes.data.title,
        status: lessonRes.data.status,
        kind: lessonRes.data.kind as LessonKind,
        round,
        meta: (lessonRes.data.meta ?? {}) as Record<string, unknown>,
        covers: content.covers ?? null,
        summary: content.summary ?? null,
        score: lessonRes.data.score,
        xp_earned: lessonRes.data.xp_earned,
        rule: content.rule ?? null,
        focus_pattern_ids: lessonRes.data.focus_pattern_ids,
        exercises: exercisesRes.data as unknown as Exercise[],
        attempts: new Map((attemptsRes.data as unknown as Attempt[]).map((a) => [a.exercise_id, a])),
      }
    },
  })
}

/** Repetir una lección completada: abre una ronda nueva (la nota guardada será la última) */
export function useRetakeLesson(lessonId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('retake_lesson', { p_lesson_id: lessonId })
      if (error) throw error
      return data as number
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lessonId) })
      queryClient.invalidateQueries({ queryKey: ['lessons', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['lessons', 'history'] })
    },
  })
}

// ─── Exámenes ────────────────────────────────────────────────────────────────
export type ExamSummary = {
  id: string
  status: string
  score: number | null
  passed: boolean | null
  target_level: string | null
  new_level: string | null
  week_start: string | null
  completed_at: string | null
}

export type ExamStatus = {
  today: string
  weekly: {
    week_start: string
    lessons_this_week: number
    required: number
    available: boolean
    exam: ExamSummary | null
    history: ExamSummary[]
  }
  level: {
    current: string
    target: string | null
    lessons_since: number
    required: number
    average: number
    min_average: number
    pass_threshold: number
    cooldown_until: string | null
    available: boolean
    exam: ExamSummary | null
    last: ExamSummary | null
  }
  dev_unlock: boolean
}

export function useExamStatus() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['exams', 'status', userId],
    enabled: !!userId,
    // Examen desbloqueado pero aún sin crear: la preparación en segundo plano lo crea enseguida
    refetchInterval: (query) => {
      const s = query.state.data
      return s && ((s.weekly.available && !s.weekly.exam) || (s.level.available && !s.level.exam)) ? 20_000 : false
    },
    queryFn: () => invokeFunction<ExamStatus>('exams', { action: 'status' }),
  })
}

export function useCreateExam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (kind: 'weekly' | 'level') => invokeFunction<{ lesson_id: string; reused: boolean }>('exams', { action: 'create', kind }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
  })
}

export function useGenerateLesson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => invokeFunction<{ lesson_id: string; reused: boolean }>('generate-lesson', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
  })
}

export function useGradeAttempt(lessonId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { exercise_id: string; response: ExerciseResponse; duration_ms: number }) =>
      invokeFunction<GradeResult>('grade-attempt', vars),
    onSuccess: (result, vars) => {
      // Guarda el intento en la caché de la lección sin volver a pedirla
      queryClient.setQueryData<LessonDetail>(lessonKeys.detail(lessonId), (prev) => {
        if (!prev) return prev
        const attempts = new Map(prev.attempts)
        attempts.set(vars.exercise_id, {
          id: result.attempt_id,
          exercise_id: vars.exercise_id,
          response: vars.response,
          is_correct: result.is_correct,
          score: result.score,
          feedback: result.feedback,
        })
        return {
          ...prev,
          attempts,
          status: result.lesson.completed ? 'completed' : 'in_progress',
          score: result.lesson.score ?? prev.score,
          xp_earned: result.lesson.xp_earned ?? prev.xp_earned,
        }
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['lessons', 'active'] })
      if (result.lesson.completed) {
        queryClient.invalidateQueries({ queryKey: ['lessons', 'history'] })
        queryClient.invalidateQueries({ queryKey: ['exams'] })
        queryClient.invalidateQueries({ queryKey: ['profile'] })
      }
    },
  })
}
