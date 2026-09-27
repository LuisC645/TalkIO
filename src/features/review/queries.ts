import { localDateISO } from '@/lib/dates'
import { supabase } from '@/lib/supabase'

/** Tarjetas nuevas ya presentadas hoy (primer repaso de una tarjeta en estado New), en día local */
export async function newIntroducedToday(timeZone: string, today: string): Promise<number> {
  const since = new Date(Date.now() - 36 * 3_600_000).toISOString()
  const { data, error } = await supabase.from('srs_review_logs').select('review').eq('state', 0).gte('review', since)
  if (error) throw error
  return (data ?? []).filter((r) => localDateISO(timeZone, new Date(r.review)) === today).length
}
