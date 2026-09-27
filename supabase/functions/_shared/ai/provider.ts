import type { ModelTier } from './models.ts'

// Contrato que cumple cualquier proveedor de IA (Gemini hoy; otro mañana).
// Las Edge Functions dependen solo de esta interfaz, nunca del SDK concreto.

export type GenerateJSONRequest = {
  tier: ModelTier
  /** Parte estable del prompt (instrucciones + perfil). Va primero para aprovechar el caché implícito. */
  system: string
  /** Parte variable (errores activos del día, cartas vencidas, respuesta del usuario…). */
  input: string
  /** JSON Schema de la salida esperada; la respuesta además se valida con zod en quien llama. */
  responseSchema: Record<string, unknown>
  temperature?: number
  maxOutputTokens?: number
  /** Esfuerzo de razonamiento del modelo; más bajo = más rápido y barato */
  thinking?: 'minimal' | 'low' | 'medium' | 'high'
}

export type AIUsage = {
  model: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  latencyMs: number
}

export type GenerateJSONResult = {
  data: unknown
  usage: AIUsage
}

export interface AIProvider {
  generateJSON(req: GenerateJSONRequest): Promise<GenerateJSONResult>
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly usage?: Partial<AIUsage>,
    /** Código HTTP del proveedor; 429/5xx = transitorio (saturación, límite) */
    readonly status?: number,
  ) {
    super(message)
  }

  get transient() {
    return this.status === 429 || (this.status !== undefined && this.status >= 500)
  }
}
