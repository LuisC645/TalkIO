import { AIError } from './ai/provider.ts'
import { corsHeaders } from './cors.ts'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Envuelve un handler: CORS, JSON y errores con mensaje para el usuario (en español). */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
    try {
      return await handler(req)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status)
      if (err instanceof AIError && err.transient) {
        console.error(err.message)
        return json({ error: 'El servicio de IA está saturado en este momento. Vuelve a intentarlo en un minuto.', code: 'ai_busy' }, 503)
      }
      console.error(err)
      return json({ error: 'Algo falló en el servidor. Vuelve a intentarlo en un momento.' }, 500)
    }
  })
}
