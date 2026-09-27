import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '../authErrors'

type Mode = 'signin' | 'signup'

// Panel de acceso: Liquid Glass grueso (capa funcional con mucho texto → variante más opaca)
const PANEL = 'glass-thick rounded-[28px]'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

type UsernameStatus = 'idle' | 'checking' | 'free' | 'taken'

/** "Sofía Pérez" → "sofia_perez" (mismo criterio que el servidor) */
function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
}

function cleanUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}

const COPY: Record<Mode, { submit: string; passwordAutocomplete: string }> = {
  signin: { submit: 'Iniciar sesión', passwordAutocomplete: 'current-password' },
  signup: { submit: 'Crear cuenta', passwordAutocomplete: 'new-password' },
}

export function AuthCard({ redirectTo = '/dashboard' }: { redirectTo?: string }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  // @usuario: se sugiere desde el nombre hasta que la persona lo edita
  const [username, setUsername] = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  // Consentimiento para correos: desmarcado por defecto (se cambia luego en Ajustes)
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [checked, setChecked] = useState<{ username: string; free: boolean | null } | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Email: se valida al salir del campo (text-fields.md › Validate fields when it makes sense)
  function validateEmail(value = email) {
    const error = !value ? 'Escribe tu email.' : EMAIL_RE.test(value) ? null : 'Revisa el formato del email (ej. nombre@correo.com).'
    setEmailError(error)
    return !error
  }

  // Contraseña nueva: se valida mientras se escribe, antes de salir del campo
  function validatePassword(value = password) {
    let error: string | null = null
    if (!value) error = 'Escribe tu contraseña.'
    else if (mode === 'signup' && value.length < MIN_PASSWORD) error = `Usa al menos ${MIN_PASSWORD} caracteres.`
    setPasswordError(error)
    return !error
  }

  function validateName(value = name) {
    const error = value.trim().length < 2 ? 'Escribe tu nombre.' : null
    setNameError(error)
    return !error
  }

  // Disponibilidad en vivo (con pausa de 400 ms para no consultar en cada tecla)
  const candidate = cleanUsername(username)
  const checkable = mode === 'signup' && USERNAME_RE.test(candidate)
  const usernameStatus: UsernameStatus = !checkable
    ? 'idle'
    : checked?.username !== candidate
      ? 'checking'
      : checked.free === null
        ? 'idle'
        : checked.free
          ? 'free'
          : 'taken'

  useEffect(() => {
    if (!checkable) return
    let cancelled = false
    const t = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_username: candidate })
      // Si la consulta falla, el servidor asigna uno libre igualmente al crear la cuenta
      if (!cancelled) setChecked({ username: candidate, free: error ? null : !!data })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [candidate, checkable])

  function validateUsername(value = username) {
    const u = cleanUsername(value)
    const error = !u
      ? 'Elige un nombre de usuario.'
      : USERNAME_RE.test(u)
        ? null
        : 'Usa de 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo.'
    setUsernameError(error)
    return !error
  }

  function onNameChange(value: string) {
    setName(value)
    if (nameError) validateName(value)
    if (!usernameEdited) {
      setUsername(slugify(value))
      setUsernameError(null)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setFormError(null)
    setPasswordError(null)
    setNameError(null)
    setUsernameError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const okName = mode === 'signup' ? validateName() : true
    const okUsername = mode === 'signup' ? validateUsername() : true
    const okEmail = validateEmail()
    const okPassword = validatePassword()
    if (!okName || !okUsername || !okEmail || !okPassword) return
    if (mode === 'signup' && usernameStatus === 'taken') return setUsernameError('Ese nombre de usuario ya está en uso.')

    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return setFormError(authErrorMessage(error))
        navigate(redirectTo, { replace: true })
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Nombre y @usuario llegan al perfil desde el alta (trigger handle_new_user). Si el
          // @usuario se ocupó justo antes, el servidor asigna uno libre parecido.
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { display_name: name.trim().replace(/\s+/g, ' ').slice(0, 60), username: cleanUsername(username), email_opt_in: emailOptIn },
          },
        })
        if (error) return setFormError(authErrorMessage(error))
        // Con confirmación de email activa, un email ya registrado devuelve un usuario sin identidades
        if (data.user && data.user.identities?.length === 0) {
          return setFormError('Ya existe una cuenta con este email. Inicia sesión.')
        }
        if (data.session) navigate(redirectTo, { replace: true })
        else setSentTo(email)
      }
    } catch (err) {
      setFormError(authErrorMessage(err as Error))
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <div className={cn(PANEL, 'appear p-7 sm:p-9')}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-fill text-accent">
            <svg aria-hidden viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
              <path d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="font-display text-title-2 font-semibold">Revisa tu email</h2>
          <p className="text-callout text-label-2">
            Enviamos un enlace de confirmación a <span className="font-medium text-label">{sentTo}</span>. Ábrelo para activar tu cuenta.
          </p>
          <Button variant="plain" onClick={() => { setSentTo(null); switchMode('signin') }}>
            Volver a iniciar sesión
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(PANEL, 'p-6 sm:p-9')}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="space-y-1">
          <h2 className="font-display text-title-2 font-semibold">
            {mode === 'signin' ? 'Continúa donde lo dejaste' : 'Empieza tu plan'}
          </h2>
          <p className="text-callout text-label-2">
            {mode === 'signin'
              ? 'Tu racha, tus errores y tus repasos te esperan.'
              : 'Tu cuenta guarda tu progreso, tus errores y tus repasos.'}
          </p>
        </div>

        <SegmentedControl
          label="Tipo de acceso"
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'signin', label: 'Inicio de sesión' },
            { value: 'signup', label: 'Registro' },
          ]}
        />

        {mode === 'signup' && (
          <TextField
            label="Nombre"
            autoComplete="given-name"
            autoCapitalize="words"
            placeholder="¿Cómo te llamas?"
            maxLength={60}
            value={name}
            error={nameError}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => name && validateName()}
          />
        )}

        {mode === 'signup' && (
          <TextField
            label="Usuario"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="tu_usuario"
            maxLength={21}
            value={username}
            error={usernameError ?? (usernameStatus === 'taken' ? 'Ese nombre de usuario ya está en uso. Prueba otro.' : null)}
            hint={
              usernameStatus === 'checking'
                ? 'Comprobando…'
                : usernameStatus === 'free'
                  ? `@${cleanUsername(username)} está disponible. Tus amigos te agregan con él.`
                  : 'Tus amigos te agregan con él. Puedes cambiarlo en Ajustes.'
            }
            onChange={(e) => {
              const v = e.target.value.replace(/\s/g, '').toLowerCase()
              setUsername(v)
              setUsernameEdited(true)
              if (usernameError) validateUsername(v)
            }}
            onBlur={() => username && validateUsername()}
          />
        )}

        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nombre@correo.com"
          value={email}
          error={emailError}
          onChange={(e) => {
            setEmail(e.target.value)
            if (emailError) validateEmail(e.target.value)
          }}
          onBlur={() => email && validateEmail()}
        />

        <TextField
          label="Contraseña"
          type="password"
          autoComplete={COPY[mode].passwordAutocomplete}
          placeholder={mode === 'signup' ? `Mínimo ${MIN_PASSWORD} caracteres` : undefined}
          value={password}
          error={passwordError}
          hint={mode === 'signup' ? `Al menos ${MIN_PASSWORD} caracteres.` : undefined}
          onChange={(e) => {
            setPassword(e.target.value)
            if (passwordError || mode === 'signup') {
              if (passwordError || e.target.value.length >= MIN_PASSWORD) validatePassword(e.target.value)
            }
          }}
        />

        {mode === 'signup' && (
          <label className="flex cursor-pointer items-start gap-3 text-footnote text-label-2">
            <input
              type="checkbox"
              checked={emailOptIn}
              onChange={(e) => setEmailOptIn(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md accent-[var(--accent)]"
            />
            <span>
              Acepto recibir por correo mi reporte semanal y recordatorios de racha. Puedes cambiarlo cuando quieras en Ajustes.
            </span>
          </label>
        )}

        {mode === 'signup' && (
          <p className="-mt-2 text-footnote text-label-2">
            Al crear tu cuenta aceptas la{' '}
            <Link to="/privacidad" target="_blank" className="font-medium text-link">
              política de privacidad
            </Link>{' '}
            y la de{' '}
            <Link to="/cookies" target="_blank" className="font-medium text-link">
              cookies
            </Link>
            .
          </p>
        )}

        {formError && (
          <p role="alert" className="appear rounded-xl bg-danger/10 px-4 py-3 text-callout text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {COPY[mode].submit}
        </Button>
      </form>
    </div>
  )
}
