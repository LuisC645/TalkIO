// Panel "Pruebas": solo si está activado en el build y solo para los correos de administrador.
// Es solo visual; la función dev-tools vuelve a comprobar el correo en el servidor (ADMIN_EMAILS).
export const DEV_TOOLS = import.meta.env.VITE_DEV_TOOLS === 'true'

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdmin(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}
