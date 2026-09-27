const ENDPOINT = 'https://api.resend.com/emails'

export type EmailMessage = { to: string; subject: string; html: string; text: string; unsubscribeUrl?: string }

// Sin dominio propio, Resend solo permite el remitente de prueba onboarding@resend.dev y solo
// entrega al correo dueño de la cuenta de Resend; al resto responde 403 (queda registrado como
// fallido en email_log). Con un dominio verificado basta con definir RESEND_FROM.
const FROM_DEFAULT = 'TalkIO <onboarding@resend.dev>'

/**
 * Envía un correo con Resend al email con el que se registró el usuario. Devuelve el id del
 * proveedor o lanza un Error con el motivo (p. ej. la restricción de Resend sin dominio).
 */
export async function sendEmail(msg: EmailMessage): Promise<{ id: string; deliveredTo: string }> {
  // Con Brevo configurado se envía por Brevo (llega a cualquier usuario sin dominio propio);
  // si no, Resend (sin dominio: solo al dueño de la cuenta)
  if (Deno.env.get('BREVO_API_KEY')) return (await import('./brevo.ts')).sendViaBrevo(msg)
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('Falta el secreto RESEND_API_KEY')
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || FROM_DEFAULT,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      // Baja con un clic (Gmail / Yahoo la exigen a los remitentes masivos)
      ...(msg.unsubscribeUrl
        ? { headers: { 'List-Unsubscribe': `<${msg.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
        : {}),
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string }
  if (!res.ok || !body.id) throw new Error(`Resend ${res.status}: ${body.message ?? body.name ?? res.statusText}`)
  return { id: body.id, deliveredTo: msg.to }
}

// ─── Baja de correos con un enlace firmado (sin iniciar sesión) ──────────────
async function hmac(value: string): Promise<string> {
  const secret = Deno.env.get('EMAIL_UNSUBSCRIBE_SECRET')
  if (!secret) throw new Error('Falta el secreto EMAIL_UNSUBSCRIBE_SECRET')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

export async function unsubscribeUrl(userId: string): Promise<string> {
  const base = Deno.env.get('SUPABASE_URL')
  return `${base}/functions/v1/email-unsubscribe?u=${userId}&t=${await hmac(userId)}`
}

export async function verifyUnsubscribe(userId: string, token: string): Promise<boolean> {
  const expected = await hmac(userId)
  if (expected.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}
