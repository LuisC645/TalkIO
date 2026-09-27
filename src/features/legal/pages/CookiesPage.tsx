import { LegalLayout } from '../LegalLayout'

const STORAGE: { name: string; purpose: string }[] = [
  { name: 'Sesión de inicio (Supabase)', purpose: 'Mantenerte con la sesión iniciada en este dispositivo.' },
  { name: 'Apariencia', purpose: 'Recordar si elegiste modo claro, oscuro o automático.' },
  { name: 'Sonido', purpose: 'Recordar si activaste los sonidos de lecciones y repasos.' },
  { name: 'Avisos mostrados', purpose: 'No repetir la misma notificación del navegador.' },
  { name: 'Actualización', purpose: 'Recargar una sola vez cuando hay una versión nueva de la app.' },
]

export function CookiesPage() {
  return (
    <LegalLayout
      title="Política de cookies"
      intro="TalkIO no usa cookies de publicidad ni de analítica. Solo guarda en tu navegador lo imprescindible para funcionar."
      other={{ to: '/privacidad', label: 'política de privacidad' }}
    >
      <section>
        <h2>Qué guardamos en tu navegador</h2>
        <p>En lugar de cookies de seguimiento, la app usa el almacenamiento local de tu navegador solo para esto:</p>
        <ul>
          {STORAGE.map((s) => (
            <li key={s.name}>
              <strong>{s.name}:</strong> {s.purpose}
            </li>
          ))}
        </ul>
        <p>Son técnicos y necesarios, por eso no pedimos permiso para usarlos: sin ellos la app no podría mantener tu sesión ni tus preferencias.</p>
      </section>

      <section>
        <h2>Servicios de terceros</h2>
        <ul>
          <li>
            <strong>Google Fonts</strong>: la tipografía se descarga de los servidores de Google, que pueden registrar tu dirección IP como parte de la
            conexión. No se usa para publicidad.
          </li>
          <li>
            <strong>Netlify</strong> (alojamiento) y <strong>Supabase</strong> (datos) pueden guardar registros técnicos de las conexiones, como la
            dirección IP, por seguridad.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cómo borrarlos</h2>
        <p>
          Al cerrar sesión se borra la sesión guardada. Para borrar todo lo demás, elimina los datos del sitio desde la configuración de tu navegador; la
          app seguirá funcionando y solo perderás esas preferencias en este dispositivo.
        </p>
      </section>
    </LegalLayout>
  )
}
