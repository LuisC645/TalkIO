// Plantillas de correo: HTML simple con estilos en línea (los clientes de correo ignoran CSS
// externo), tema claro, tipografía del sistema y un solo botón. Siempre con versión en texto.

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Markdown mínimo del reporte (### títulos, **negrita**, listas "- ") → HTML seguro */
export function markdownToHtml(md: string): string {
  const inline = (s: string) => escape(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const out: string[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) out.push(`<ul style="margin:0 0 16px;padding-left:20px">${list.join('')}</ul>`)
    list = []
  }
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith('- ')) { list.push(`<li style="margin:0 0 6px">${inline(line.slice(2))}</li>`); continue }
    flush()
    const h = line.match(/^#{1,4}\s+(.*)$/)
    if (h) out.push(`<h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#1d1d1f">${inline(h[1])}</h2>`)
    else out.push(`<p style="margin:0 0 14px">${inline(line)}</p>`)
  }
  flush()
  return out.join('\n')
}

const appLink = (path: string) => {
  const base = Deno.env.get('APP_URL')?.replace(/\/$/, '')
  return base ? `${base}${path}` : null
}

function layout(opts: { preheader: string; bodyHtml: string; cta?: { label: string; url: string }; unsubscribeUrl: string }) {
  const button = opts.cta
    ? `<p style="margin:24px 0 8px"><a href="${escape(opts.cta.url)}" style="display:inline-block;background:#0071e3;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:980px">${escape(opts.cta.label)}</a></p>`
    : ''
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>TalkIO</title></head>
<body style="margin:0;padding:0;background:#f5f5f7">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:4px 8px 16px;font:600 20px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;letter-spacing:-0.02em">TalkIO</td></tr>
<tr><td style="background:#ffffff;border-radius:22px;padding:28px 24px;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">
${opts.bodyHtml}
${button}
</td></tr>
<tr><td style="padding:16px 8px;font:12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#86868b">
Recibes este correo porque activaste los correos de TalkIO. <a href="${escape(opts.unsubscribeUrl)}" style="color:#86868b">Dejar de recibirlos</a> · también puedes cambiarlo en Ajustes.${appLink('/privacidad') ? ` · <a href="${escape(appLink('/privacidad')!)}" style="color:#86868b">Privacidad</a>` : ''}
</td></tr>
</table>
</td></tr></table>
</body></html>`
}


export function weeklyReportEmail(opts: { name: string | null; contentMd: string; xp: number; unsubscribeUrl: string; reportId: string | null; test?: boolean }) {
  const url = appLink(opts.reportId ? `/settings/reports/${opts.reportId}` : '/settings')
  const subject = `${opts.test ? '[Prueba] ' : ''}Tu semana en TalkIO: ${opts.xp} XP`
  const html = layout({
    preheader: 'Tu resumen semanal: lo que mejoró y en qué enfocarte.',
    bodyHtml: markdownToHtml(opts.contentMd),
    cta: url ? { label: 'Ver el reporte completo', url } : undefined,
    unsubscribeUrl: opts.unsubscribeUrl,
  })
  const text = `${opts.contentMd.replace(/\*\*/g, '').replace(/^#+\s*/gm, '')}\n\n${url ? `Ver el reporte: ${url}\n` : ''}Dejar de recibir correos: ${opts.unsubscribeUrl}`
  return { subject, html, text }
}

export function streakReminderEmail(opts: { name: string | null; streak: number; missingXp: number; unsubscribeUrl: string; test?: boolean }) {
  const days = `${opts.streak} ${opts.streak === 1 ? 'día' : 'días'}`
  const url = appLink('/review')
  const subject = `${opts.test ? '[Prueba] ' : ''}Tu racha de ${days} está en riesgo`
  const hello = opts.name ? `${escape(opts.name)}, ` : ''
  const html = layout({
    preheader: `Te faltan ${opts.missingXp} XP para la meta de hoy.`,
    bodyHtml: `<h2 style="margin:0 0 12px;font-size:20px;line-height:1.3">🔥 ${escape(days)} seguidos</h2>
<p style="margin:0 0 14px">${hello}hoy todavía no cumples tu meta: te faltan <strong>${opts.missingXp} XP</strong>. Un repaso corto de unos minutos basta para no perder la racha.</p>`,
    cta: url ? { label: 'Repasar ahora', url } : undefined,
    unsubscribeUrl: opts.unsubscribeUrl,
  })
  const text = `Tu racha de ${days} está en riesgo. Te faltan ${opts.missingXp} XP para la meta de hoy; un repaso corto basta.\n${url ? `Repasar: ${url}\n` : ''}Dejar de recibir correos: ${opts.unsubscribeUrl}`
  return { subject, html, text }
}
