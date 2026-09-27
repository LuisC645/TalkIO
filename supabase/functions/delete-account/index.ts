import { z } from 'npm:zod@4'
import { HttpError, json, serve } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

const Body = z.object({ confirm: z.literal('ELIMINAR') })

/**
 * POST /delete-account { confirm: 'ELIMINAR' } → elimina la cuenta de quien llama.
 * Al borrar el usuario de Auth, la base de datos borra en cascada todos sus datos (perfil,
 * progreso, lecciones, repasos, errores, textos, reportes, amigos, notificaciones, correos).
 * El registro de uso de IA se conserva anonimizado (sin usuario ni contenido).
 */
serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  if (!Body.safeParse(await req.json().catch(() => null)).success) {
    throw new HttpError(400, 'Falta la confirmación para eliminar la cuenta.')
  }
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) throw new HttpError(500, 'No se pudo eliminar la cuenta. Inténtalo de nuevo.')
  return json({ deleted: true })
})
