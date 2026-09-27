import type { AuthError } from '@supabase/supabase-js'

// Qué salió mal y cómo arreglarlo, sin disculpas (writing.md).
const BY_CODE: Record<string, string> = {
  invalid_credentials: 'El email o la contraseña no son correctos.',
  email_not_confirmed: 'Confirma tu email con el enlace que te enviamos y vuelve a intentarlo.',
  user_already_exists: 'Ya existe una cuenta con este email. Inicia sesión.',
  email_exists: 'Ya existe una cuenta con este email. Inicia sesión.',
  weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  over_email_send_rate_limit: 'Enviamos demasiados correos seguidos. Espera un minuto y vuelve a intentarlo.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  signup_disabled: 'El registro de cuentas nuevas está desactivado.',
  email_address_invalid: 'Ese email no es válido.',
}

export function authErrorMessage(error: AuthError | Error): string {
  const code = 'code' in error ? (error.code as string | undefined) : undefined
  if (code && BY_CODE[code]) return BY_CODE[code]
  if (/fetch|network/i.test(error.message)) return 'No hay conexión. Revisa tu internet y vuelve a intentarlo.'
  return 'No se pudo completar. Vuelve a intentarlo.'
}
