import { CONTACT_EMAIL } from '../constants'
import { LegalLayout } from '../LegalLayout'

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Política de privacidad"
      intro="Qué datos guarda TalkIO, para qué los usa y cómo puedes controlarlos. Sin letra pequeña."
      other={{ to: '/cookies', label: 'política de cookies' }}
    >
      <section>
        <h2>Quién es responsable</h2>
        <p>
          TalkIO es un proyecto personal de aprendizaje de inglés desarrollado por Luis Castillo. Para cualquier asunto sobre tus datos escribe a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2>Qué datos guardamos</h2>
        <ul>
          <li><strong>Tu cuenta:</strong> email, nombre, @usuario y contraseña (se guarda cifrada; nadie puede leerla).</li>
          <li><strong>Tu estudio:</strong> respuestas, textos que escribes, errores detectados, repasos, XP, racha, nivel y reportes semanales.</li>
          <li><strong>Tus preferencias:</strong> zona horaria, intereses, meta diaria y si quieres notificaciones o correos.</li>
          <li><strong>Amigos:</strong> a quién agregaste y las solicitudes pendientes.</li>
        </ul>
        <p>No pedimos datos sensibles ni de pago.</p>
      </section>

      <section>
        <h2>Para qué los usamos</h2>
        <ul>
          <li>Hacer funcionar la app: guardar tu progreso y sincronizarlo entre dispositivos.</li>
          <li>Personalizar tus lecciones, correcciones y exámenes a partir de tus errores e intereses.</li>
          <li>Enviarte tu reporte semanal y recordatorios de racha por correo, <strong>solo si lo activas</strong>.</li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad.</p>
      </section>

      <section>
        <h2>Con quién se comparten</h2>
        <ul>
          <li><strong>Supabase</strong>: base de datos e inicio de sesión.</li>
          <li><strong>Google (Gemini)</strong>: procesa tus respuestas y textos para corregirlos y generar lecciones. Recibe tu texto, tu nivel y tu nombre de pila, nunca tu email ni tu contraseña.</li>
          <li><strong>Brevo</strong>: envía los correos, si los activaste.</li>
          <li><strong>Netlify</strong>: aloja la aplicación.</li>
          <li><strong>Tus amigos</strong>: solo ven tu nombre, @usuario, racha y nivel, y solo si aceptaste su solicitud.</li>
        </ul>
      </section>

      <section>
        <h2>Cuánto tiempo</h2>
        <p>Mientras tengas tu cuenta. Si pides eliminarla, borramos tus datos de estudio y tu perfil.</p>
      </section>

      <section>
        <h2>Tus derechos</h2>
        <p>
          Puedes conocer, corregir y pedir que eliminemos tus datos, y retirar tu consentimiento de correos en cualquier momento desde Ajustes o con el
          enlace de baja de cada correo. Para lo demás, escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. En Colombia estos derechos
          están protegidos por la Ley 1581 de 2012 (habeas data).
        </p>
      </section>

      <section>
        <h2>Cambios</h2>
        <p>Si cambiamos esta política, actualizaremos la fecha de arriba y te avisaremos en la app si el cambio es importante.</p>
      </section>
    </LegalLayout>
  )
}
