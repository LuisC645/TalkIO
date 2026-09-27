import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AIError, getAIProvider, type GenerateJSONRequest } from './ai/index.ts'

/**
 * Llama a la IA y registra el uso en ai_usage (éxito o fallo), para medir costo real.
 * Devuelve el JSON crudo; quien llama lo valida con zod.
 */
export async function callAI(
  admin: SupabaseClient,
  ctx: { userId: string; functionName: string },
  req: GenerateJSONRequest,
): Promise<{ data: unknown; model: string }> {
  try {
    const { data, usage } = await getAIProvider().generateJSON(req)
    await admin.from('ai_usage').insert({
      user_id: ctx.userId,
      function_name: ctx.functionName,
      tier: req.tier,
      model: usage.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cached_tokens: usage.cachedTokens,
      latency_ms: usage.latencyMs,
      success: true,
    })
    return { data, model: usage.model }
  } catch (err) {
    const usage = err instanceof AIError ? err.usage : undefined
    await admin.from('ai_usage').insert({
      user_id: ctx.userId,
      function_name: ctx.functionName,
      tier: req.tier,
      model: usage?.model ?? 'desconocido',
      input_tokens: usage?.inputTokens ?? 0,
      output_tokens: usage?.outputTokens ?? 0,
      cached_tokens: usage?.cachedTokens ?? 0,
      latency_ms: usage?.latencyMs ?? null,
      success: false,
      error: String(err instanceof Error ? err.message : err).slice(0, 500),
    })
    throw err
  }
}

/** Límite diario de llamadas por función (protege el costo si algo entra en bucle). */
export async function assertDailyLimit(admin: SupabaseClient, userId: string, functionName: string, max: number) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('created_at', since)
  if (error) throw error
  return (count ?? 0) < max
}
