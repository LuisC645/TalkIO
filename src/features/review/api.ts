import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserToday } from '@/features/progress/api'
import { addDaysISO, localDateISO } from '@/lib/dates'
import { NEW_CARDS_PER_DAY, newAvailableToday, type SrsRow } from '@/lib/srs'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { newIntroducedToday } from './queries'

const CARD_COLUMNS =
  'id, item_type, vocab_id, pattern_id, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review'

export type ReviewItem = SrsRow & {
  id: string
  item_type: 'vocab' | 'pattern'
  vocab: { term: string; wrong_form: string | null; translation: string | null; kind: string; example: string | null; notes: string | null } | null
  pattern: { title: string; rule: string; example: { wrong: string; right: string } | null } | null
}

export function useReviewOverview() {
  const userId = useAuthStore((s) => s.user?.id)
  const { timeZone, today, ready } = useUserToday()
  return useQuery({
    queryKey: ['review', 'overview', userId, today],
    enabled: !!userId && ready,
    queryFn: async () => {
      const now = new Date().toISOString()
      const weekAhead = new Date(Date.now() + 8 * 86_400_000).toISOString()
      const [due, fresh, byType, upcoming, introduced] = await Promise.all([
        supabase.from('srs_cards').select('id', { count: 'exact', head: true }).gt('state', 0).lte('due', now),
        supabase.from('srs_cards').select('id', { count: 'exact', head: true }).eq('state', 0),
        supabase.from('srs_cards').select('item_type, state, stability'),
        supabase.from('srs_cards').select('due').gt('state', 0).gt('due', now).lte('due', weekAhead),
        newIntroducedToday(timeZone, today),
      ])
      for (const r of [due, fresh, byType, upcoming]) if (r.error) throw r.error

      const cards = byType.data ?? []
      const forecast = Array.from({ length: 7 }, (_, i) => {
        const date = addDaysISO(today, i + 1)
        return { date, count: (upcoming.data ?? []).filter((c) => localDateISO(timeZone, new Date(c.due)) === date).length }
      })
      const newCount = fresh.count ?? 0
      return {
        dueReviews: due.count ?? 0,
        newCards: newCount,
        newToday: newAvailableToday(newCount, introduced),
        introducedToday: introduced,
        newLimit: NEW_CARDS_PER_DAY,
        forecast,
        deck: {
          vocab: cards.filter((c) => c.item_type === 'vocab').length,
          patterns: cards.filter((c) => c.item_type === 'pattern').length,
          learning: cards.filter((c) => c.state === 1 || c.state === 3).length,
          // "Consolidadas": estabilidad ≥ 21 días (la memoria dura semanas)
          mature: cards.filter((c) => c.state === 2 && c.stability >= 21).length,
          young: cards.filter((c) => c.state === 2 && c.stability < 21).length,
        },
      }
    },
  })
}

/** Cola de la sesión: vencidas (más antiguas primero) + nuevas dentro del cupo, con su contenido */
export function useReviewQueue() {
  const userId = useAuthStore((s) => s.user?.id)
  const { timeZone, today, ready } = useUserToday()
  return useQuery({
    queryKey: ['review', 'queue', userId, today],
    enabled: !!userId && ready,
    staleTime: Infinity, // la sesión maneja su propia cola; no refrescar a mitad de repaso
    queryFn: async (): Promise<ReviewItem[]> => {
      const now = new Date().toISOString()
      const introduced = await newIntroducedToday(timeZone, today)
      const [dueRes, newRes] = await Promise.all([
        supabase.from('srs_cards').select(CARD_COLUMNS).gt('state', 0).lte('due', now).order('due').limit(200),
        supabase
          .from('srs_cards')
          .select(CARD_COLUMNS)
          .eq('state', 0)
          .order('created_at')
          .limit(Math.max(0, NEW_CARDS_PER_DAY - introduced)),
      ])
      if (dueRes.error) throw dueRes.error
      if (newRes.error) throw newRes.error
      const rows = [...(dueRes.data ?? []), ...(newRes.data ?? [])]

      const vocabIds = rows.map((r) => r.vocab_id).filter(Boolean) as string[]
      const patternIds = rows.map((r) => r.pattern_id).filter(Boolean) as string[]
      const [vocabRes, patternRes, occRes] = await Promise.all([
        vocabIds.length
          ? supabase.from('vocab_items').select('id, term, wrong_form, translation, kind, example, notes').in('id', vocabIds)
          : Promise.resolve({ data: [], error: null }),
        patternIds.length ? supabase.from('error_patterns').select('id, title, rule').in('id', patternIds) : Promise.resolve({ data: [], error: null }),
        patternIds.length
          ? supabase
              .from('error_occurrences')
              .select('pattern_id, wrong_text, corrected_text')
              .in('pattern_id', patternIds)
              .order('occurred_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ])
      const vocab = new Map((vocabRes.data ?? []).map((v) => [v.id, v]))
      const patterns = new Map((patternRes.data ?? []).map((p) => [p.id, p]))
      const examples = new Map<string, { wrong: string; right: string }>()
      for (const o of occRes.data ?? []) {
        if (!examples.has(o.pattern_id) && o.corrected_text && o.corrected_text !== '—') {
          examples.set(o.pattern_id, { wrong: o.wrong_text, right: o.corrected_text })
        }
      }

      return rows.map((r) => ({
        ...r,
        item_type: r.item_type as 'vocab' | 'pattern',
        vocab: r.vocab_id ? (vocab.get(r.vocab_id) ?? null) : null,
        pattern: r.pattern_id
          ? (() => {
              const p = patterns.get(r.pattern_id!)
              return p ? { title: p.title, rule: p.rule, example: examples.get(r.pattern_id!) ?? null } : null
            })()
          : null,
      }))
    },
  })
}

export function useRecordReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { cardId: string; card: Record<string, unknown>; log: Record<string, unknown>; durationMs: number }) => {
      const { error } = await supabase.rpc('record_review', {
        p_card_id: vars.cardId,
        p_card: vars.card as never,
        p_log: vars.log as never,
        p_duration_ms: vars.durationMs,
      })
      if (error) throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['review', 'overview'] })
    },
  })
}
