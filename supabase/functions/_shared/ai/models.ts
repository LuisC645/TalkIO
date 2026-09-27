// Tiers de modelo. Los IDs viven en variables de entorno para poder cambiarlos
// (o cambiar de proveedor) sin tocar código. Todos usan 3.1 Flash-Lite: el más simple y barato disponible.
export type ModelTier = 'lite' | 'standard' | 'pro'

const DEFAULTS: Record<ModelTier, string> = {
  lite: 'gemini-3.1-flash-lite',
  standard: 'gemini-3.1-flash-lite',
  pro: 'gemini-3.1-flash-lite',
}

const ENV_KEYS: Record<ModelTier, string> = {
  lite: 'AI_MODEL_LITE',
  standard: 'AI_MODEL_STANDARD',
  pro: 'AI_MODEL_PRO',
}

export function modelFor(tier: ModelTier): string {
  return Deno.env.get(ENV_KEYS[tier]) || DEFAULTS[tier]
}

// Respaldos, en orden, si el modelo principal sigue saturado (429/5xx) tras un reintento
// o no está disponible para el proyecto de la clave (404).
// Se pueden cambiar con AI_MODEL_<TIER>_FALLBACK="modelo1,modelo2".
const FALLBACKS: Record<ModelTier, string[]> = {
  lite: ['gemini-3.5-flash-lite'],
  standard: ['gemini-3.5-flash-lite'],
  pro: ['gemini-3.5-flash-lite'],
}

export function fallbacksFor(tier: ModelTier): string[] {
  const env = Deno.env.get(`${ENV_KEYS[tier]}_FALLBACK`)
  const list = env ? env.split(',').map((m) => m.trim()).filter(Boolean) : FALLBACKS[tier]
  return list.filter((m) => m !== modelFor(tier))
}
