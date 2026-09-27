import { useQuery } from '@tanstack/react-query'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { addDaysISO, isoRange, localDateISO, mondayOf } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import { newIntroducedToday } from '@/features/review/queries'
import { useAuthStore } from '@/stores/authStore'

/** Zona horaria del perfil (la racha y los días se cuentan en hora local del usuario) */
export function useUserToday() {
  const { data: profile } = useProfile()
  const timeZone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  return { timeZone, today: localDateISO(timeZone), ready: !!profile }
}

export function useProgress() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['dashboard', 'progress', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_progress_view').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type DayActivity = { date: string; xp: number; goalMet: boolean; isToday: boolean }

/** Últimos `days` días locales, con los días sin actividad rellenos en 0 */
export function useDailyActivity(days: number) {
  const userId = useAuthStore((s) => s.user?.id)
  const { today, ready } = useUserToday()
  const start = addDaysISO(today, -(days - 1))

  return useQuery({
    queryKey: ['dashboard', 'daily', userId, start, days],
    enabled: !!userId && ready,
    queryFn: async (): Promise<DayActivity[]> => {
      const { data: rows, error } = await supabase
        .from('daily_activity')
        .select('local_date, xp, goal_met')
        .gte('local_date', start)
        .lte('local_date', today)
        .order('local_date')
      if (error) throw error
      const byDate = new Map(rows.map((r) => [r.local_date, r]))
      return isoRange(start, days).map((date) => ({
        date,
        xp: byDate.get(date)?.xp ?? 0,
        goalMet: byDate.get(date)?.goal_met ?? false,
        isToday: date === today,
      }))
    },
  })
}

export function useReviewQueue() {
  const userId = useAuthStore((s) => s.user?.id)
  const { timeZone, today, ready } = useUserToday()
  return useQuery({
    queryKey: ['dashboard', 'reviews', userId, today],
    enabled: !!userId && ready,
    queryFn: async () => {
      const now = new Date().toISOString()
      const [due, fresh, introduced] = await Promise.all([
        supabase.from('srs_cards').select('id', { count: 'exact', head: true }).gt('state', 0).lte('due', now),
        supabase.from('srs_cards').select('id', { count: 'exact', head: true }).eq('state', 0),
        newIntroducedToday(timeZone, today),
      ])
      if (due.error) throw due.error
      if (fresh.error) throw fresh.error
      return { dueReviews: due.count ?? 0, newCards: fresh.count ?? 0, introducedToday: introduced }
    },
  })
}

export function useErrorPatterns() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['dashboard', 'patterns', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('error_patterns')
        .select('id, code, title, rule, category, skill, priority, correct_streak, mastery_threshold, occurrences, status')
        .order('priority', { ascending: false })
        .order('occurrences', { ascending: false })
      if (error) throw error
      return {
        active: rows.filter((r) => r.status === 'active'),
        masteredCount: rows.filter((r) => r.status === 'mastered').length,
      }
    },
  })
}

export function useLatestAssessment() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['dashboard', 'assessment', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('level_assessments')
        .select('overall_cefr, overall_plus, skills, source, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type WeeklyStats = {
  week_start: string
  totals: { xp: number; active_minutes: number; exercises: number; lessons: number; reviews: number; days_active: number; days_goal_met: number }
  previous_week_xp: number
  attempts: { total: number; correct: number; accuracy: number | null }
  daily: { local_date: string; xp: number; goal_met: boolean; exercises_done: number; reviews_done: number }[]
}

export function useWeeklyStats() {
  const userId = useAuthStore((s) => s.user?.id)
  const { today, ready } = useUserToday()
  const weekStart = mondayOf(today)

  return useQuery({
    queryKey: ['dashboard', 'week', userId, weekStart],
    enabled: !!userId && ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_weekly_stats', { p_user_id: userId!, p_week_start: weekStart })
      if (error) throw error
      return data as unknown as WeeklyStats
    },
  })
}
