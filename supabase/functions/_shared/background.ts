declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

/**
 * Ejecuta trabajo después de responder (quien llama no espera). En Supabase Edge usa
 * EdgeRuntime.waitUntil para que la función no se detenga antes de terminar.
 */
export function inBackground(task: Promise<unknown>) {
  const safe = task.catch((err) => console.error('segundo plano:', err))
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(safe)
}
