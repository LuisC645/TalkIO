import { verifyUnsubscribe } from '../_shared/email/resend.ts'
import { adminClient } from '../_shared/supabase.ts'

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f5f5f7;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">
<main style="max-width:440px;margin:15vh auto;padding:28px 24px;background:#fff;border-radius:22px">
<p style="margin:0 0 16px;font-weight:600;font-size:20px">TalkIO</p>
<h1 style="margin:0 0 8px;font-size:22px">${title}</h1><p style="margin:0;color:#6e6e73">${body}</p></main></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

/**
 * GET/POST /email-unsubscribe?u=<usuario>&t=<firma> → desactiva los correos de TalkIO.
 * Enlace firmado (HMAC): no hace falta iniciar sesión y nadie puede dar de baja a otra persona.
 * POST = baja con un clic desde el cliente de correo (List-Unsubscribe-Post).
 */
Deno.serve(async (req) => {
  const url = new URL(req.url)
  const userId = url.searchParams.get('u') ?? ''
  const token = url.searchParams.get('t') ?? ''
  const valid = /^[0-9a-f-]{36}$/.test(userId) && token.length > 0 && (await verifyUnsubscribe(userId, token).catch(() => false))
  if (!valid) return page('Enlace no válido', 'Este enlace de baja no es válido. Puedes desactivar los correos en Ajustes de TalkIO.', 400)

  const { error } = await adminClient().from('profiles').update({ email_opt_in: false }).eq('id', userId)
  if (error) return page('No se pudo completar', 'Inténtalo de nuevo en un momento o desactívalos en Ajustes.', 500)
  if (req.method === 'POST') return new Response(null, { status: 204 })
  return page('Listo, ya no recibirás correos', 'Puedes volver a activarlos cuando quieras en Ajustes → Notificaciones.')
})
