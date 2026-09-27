import type { EmailMessage } from './resend.ts'

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

/**
 * Envío con Brevo (plan gratis: 300 correos al día). A diferencia de Resend sin dominio, llega
 * a cualquier destinatario: el remitente (BREVO_SENDER) es un correo verificado en Brevo.
 */
export async function sendViaBrevo(msg: EmailMessage): Promise<{ id: string; deliveredTo: string }> {
  const key = Deno.env.get('BREVO_API_KEY')
  if (!key) throw new Error('Falta el secreto BREVO_API_KEY')
  const sender = Deno.env.get('BREVO_SENDER') || 'talkioapp.dev@gmail.com'
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': key },
    body: JSON.stringify({
      sender: { name: 'TalkIO', email: sender },
      to: [{ email: msg.to }],
      subject: msg.subject,
      htmlContent: msg.html,
      textContent: msg.text,
      // Baja con un clic (Gmail / Yahoo la exigen a los remitentes masivos)
      ...(msg.unsubscribeUrl
        ? { headers: { 'List-Unsubscribe': `<${msg.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
        : {}),
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string }
  if (!res.ok || !body.messageId) throw new Error(`Brevo ${res.status}: ${body.message ?? body.code ?? res.statusText}`)
  return { id: body.messageId, deliveredTo: msg.to }
}
