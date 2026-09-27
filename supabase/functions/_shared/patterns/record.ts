import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { CATALOG_BY_CODE } from './catalog.ts'

export type DetectedError = { code: string; wrong: string; right: string; context?: string }
type Source = 'exercise' | 'placement' | 'writing' | 'conversation'

/**
 * Registra errores detectados: por cada código (una vez por llamada) inserta la ocurrencia y
 * reinicia la racha del patrón (regla de N aciertos seguidos). Si el usuario aún no tiene ese
 * patrón pero está en el catálogo, lo crea (con su tarjeta de repaso): así los usuarios nuevos
 * van llenando su registro de errores al practicar. `skip` = patrones ya procesados por quien llama.
 */
export async function recordDetectedErrors(
  admin: SupabaseClient,
  userId: string,
  errors: DetectedError[],
  opts: { source: Source; attemptId?: string | null; skip?: Set<string> } ,
): Promise<{ created: string[]; touched: string[] }> {
  const { data: existing } = await admin.from('error_patterns').select('id, code').eq('user_id', userId)
  const byCode = new Map((existing ?? []).map((p) => [p.code, p.id as string]))
  const touched = new Set(opts.skip ?? [])
  const created: string[] = []

  // Una entrada por código (la primera ocurrencia); cada código se procesa en paralelo: sus
  // consultas no dependen de los demás, así 5 errores no suman 20 consultas en fila
  const firstByCode = new Map<string, DetectedError>()
  for (const err of errors) if (!firstByCode.has(err.code)) firstByCode.set(err.code, err)

  await Promise.all(
    [...firstByCode.values()].map(async (err) => {
      let patternId = byCode.get(err.code)
      if (!patternId) {
        const catalog = CATALOG_BY_CODE.get(err.code)
        if (!catalog) return // "other" u otro código desconocido
        const { data: inserted, error } = await admin
          .from('error_patterns')
          .insert({
            user_id: userId,
            code: catalog.code,
            title: catalog.title,
            rule: catalog.rule,
            category: catalog.category,
            skill: catalog.skill,
            priority: catalog.priority,
            last_seen_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        if (error) {
          // Carrera con otra inserción del mismo código: releer
          const { data: again } = await admin.from('error_patterns').select('id').eq('user_id', userId).eq('code', err.code).maybeSingle()
          if (!again) return
          patternId = again.id as string
        } else {
          patternId = inserted.id as string
          created.push(catalog.title)
          await admin.from('srs_cards').insert({ user_id: userId, item_type: 'pattern', pattern_id: patternId })
        }
      }
      if (touched.has(patternId)) return
      touched.add(patternId)
      await Promise.all([
        admin.from('error_occurrences').insert({
          user_id: userId,
          pattern_id: patternId,
          attempt_id: opts.attemptId ?? null,
          wrong_text: err.wrong.slice(0, 500) || '—',
          corrected_text: err.right.slice(0, 500) || '—',
          context: err.context ?? null,
          source: opts.source,
        }),
        admin.rpc('record_pattern_result', { p_pattern_id: patternId, p_correct: false }),
      ])
    }),
  )
  return { created, touched: [...touched] }
}
