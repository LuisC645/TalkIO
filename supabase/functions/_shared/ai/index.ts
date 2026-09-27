import { GeminiProvider } from './gemini.ts'
import type { AIProvider } from './provider.ts'

let provider: AIProvider | undefined

/** Punto único para obtener el proveedor. Cambiar de proveedor = cambiar esta función. */
export function getAIProvider(): AIProvider {
  if (!provider) {
    const key = Deno.env.get('GEMINI_API_KEY')
    if (!key) throw new Error('Falta el secreto GEMINI_API_KEY')
    provider = new GeminiProvider(key)
  }
  return provider
}

export * from './provider.ts'
export * from './models.ts'
