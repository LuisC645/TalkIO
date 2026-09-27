import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useWeeklyReports() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['reports', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('id, week_start, week_end, stats, created_at, model')
        .order('week_start', { ascending: false })
        .limit(26)
      if (error) throw error
      return data
    },
  })
}

export function useWeeklyReport(id: string) {
  return useQuery({
    queryKey: ['reports', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('weekly_reports').select('id, week_start, week_end, stats, content_md, model').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

const fmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const weekLabel = (start: string, end: string) => `${fmt.format(new Date(`${start}T00:00:00Z`))} – ${fmt.format(new Date(`${end}T00:00:00Z`))}`
