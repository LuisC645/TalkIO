import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta el runtime de Edge Functions.
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Valida el JWT del usuario (verify_jwt está desactivado en config.toml; se verifica aquí). */
export async function requireUser(req: Request, admin: SupabaseClient) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Falta la sesión.')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sesión inválida o expirada.')
  return data.user
}
