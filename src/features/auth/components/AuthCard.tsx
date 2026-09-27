import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
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

const COPY: Record<Mode, { submit: string; passwordAutocomplete: string }> = {
  signin: { submit: 'Iniciar sesión', passwordAutocomplete: 'current-password' },
  signup: { submit: 'Crear cuenta', passwordAutocomplete: 'new-password' },
}

export function AuthCard({ redirectTo = '/dashboard' }: { redirectTo?: string }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
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

  function switchMode(next: Mode) {
    setMode(next)
    setFormError(null)
    setPasswordError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const okEmail = validateEmail()
    const okPassword = validatePassword()
    if (!okEmail || !okPassword) return

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
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
