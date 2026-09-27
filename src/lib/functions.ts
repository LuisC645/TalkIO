import { supabase } from './supabase'

export class FunctionError extends Error {
  readonly code?: string
  readonly status?: number

  constructor(message: string, code?: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

/**
 * Llama a una Edge Function y convierte sus errores en mensajes para el usuario
 * (las funciones responden { error, code } en español).
 */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data as T

  const context = (error as { context?: Response }).context
  if (context && typeof context.json === 'function') {
    const payload = (await context.json().catch(() => null)) as { error?: string; code?: string } | null
    if (payload?.error) throw new FunctionError(payload.error, payload.code, context.status)
  }
  if (/fetch|network/i.test(error.message)) {
    throw new FunctionError('No hay conexión. Revisa tu internet y vuelve a intentarlo.')
  }
  throw new FunctionError('No se pudo completar. Vuelve a intentarlo.')
}
