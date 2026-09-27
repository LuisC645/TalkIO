import { fallbacksFor, modelFor } from './models.ts'
import { AIError, type AIProvider, type GenerateJSONRequest, type GenerateJSONResult } from './provider.ts'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 60_000
// Ante saturación (429/5xx): un reintento del modelo principal y luego el modelo de respaldo
const RETRY_DELAY_MS = 1500

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    cachedContentTokenCount?: number
    thoughtsTokenCount?: number
  }
  promptFeedback?: { blockReason?: string }
  error?: { code: number; message: string }
}

// Gemini 2.x configura el razonamiento con un presupuesto de tokens; 3.x con un nivel
const THINKING_BUDGET: Record<NonNullable<GenerateJSONRequest['thinking']>, number> = {
  minimal: 0,
  low: 0, // sin razonamiento: lo más rápido y barato (Flash-Lite no razona por defecto)
  medium: 1024,
  high: -1, // dinámico
}
function thinkingConfig(model: string, level: NonNullable<GenerateJSONRequest['thinking']>) {
  return /^gemini-2\./.test(model) ? { thinkingBudget: THINKING_BUDGET[level] } : { thinkingLevel: level }
}

/** Gemini vía REST generateContent con salida JSON restringida por JSON Schema. */
export class GeminiProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generateJSON(req: GenerateJSONRequest): Promise<GenerateJSONResult> {
    // Interruptor de emergencia: con AI_DISABLED=true no se llama a Gemini y cada función
    // usa su alternativa sin IA (ver _shared/grading y _shared/lesson/fallback.ts)
    if (Deno.env.get('AI_DISABLED') === 'true') throw new AIError('IA desactivada (AI_DISABLED)', undefined, 503)
    const primary = modelFor(req.tier)
    const plan = [primary, primary, ...fallbacksFor(req.tier)]
    let lastError: unknown
    for (let i = 0; i < plan.length; i++) {
      try {
        return await this.once(req, plan[i])
      } catch (err) {
        lastError = err
        // Modelo no disponible para este proyecto (404, p. ej. 2.5 en proyectos nuevos): se pasa
        // directo al siguiente de la lista, sin reintentar el mismo
        if (err instanceof AIError && err.status === 404 && i < plan.length - 1) {
          while (plan[i + 1] === plan[i]) i++
          continue
        }
        if (!(err instanceof AIError) || !err.transient) throw err
        // Timeout / sin red: no seguir probando modelos (cada uno esperaría el timeout completo)
        if (err.message.startsWith('Gemini sin respuesta')) throw err
        if (i === 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    }
    throw lastError
  }

  private async once(req: GenerateJSONRequest, model: string): Promise<GenerateJSONResult> {
    const started = Date.now()

    let res: Response
    try {
      res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.input }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: req.responseSchema,
            temperature: req.temperature ?? 0.7,
            maxOutputTokens: req.maxOutputTokens ?? 8192,
            ...(req.thinking ? { thinkingConfig: thinkingConfig(model, req.thinking) } : {}),
          },
        }),
      })
    } catch (err) {
      // Timeout o red caída: se trata como saturación (transitorio) para activar respaldos/alternativas
      throw new AIError(
        `Gemini sin respuesta: ${err instanceof Error ? err.message : err}`,
        { model, latencyMs: Date.now() - started },
        503,
      )
    }

    const body = (await res.json().catch(() => ({}))) as GeminiResponse
    const meta = body.usageMetadata ?? {}
    const usage = {
      model,
      inputTokens: meta.promptTokenCount ?? 0,
      // Los tokens de razonamiento se facturan como salida
      outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
      cachedTokens: meta.cachedContentTokenCount ?? 0,
      latencyMs: Date.now() - started,
    }

    if (!res.ok || body.error) {
      throw new AIError(`Gemini ${res.status}: ${body.error?.message ?? res.statusText}`, usage, res.status)
    }
    if (body.promptFeedback?.blockReason) {
      throw new AIError(`Gemini bloqueó la solicitud: ${body.promptFeedback.blockReason}`, usage)
    }

    const candidate = body.candidates?.[0]
    const text = candidate?.content?.parts?.filter((p) => !p.thought && p.text).map((p) => p.text).join('') ?? ''
    if (!text) throw new AIError(`Gemini no devolvió texto (finishReason: ${candidate?.finishReason ?? 'desconocido'})`, usage)

    try {
      return { data: JSON.parse(text), usage }
    } catch {
      throw new AIError(`Gemini devolvió JSON inválido (finishReason: ${candidate?.finishReason})`, usage)
    }
  }
}
