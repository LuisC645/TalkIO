import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { useAuthStore } from '@/stores/authStore'

const TIMEOUT_MS = 8000

/** Destino de los enlaces de confirmación de email. supabase-js lee la sesión de la URL. */
export function AuthCallbackPage() {
  const session = useAuthStore((s) => s.session)
  const [timedOut, setTimedOut] = useState(false)
  const errorDescription = new URLSearchParams(window.location.hash.slice(1) || window.location.search).get(
    'error_description',
  )

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [])

  if (session) return <Navigate to="/dashboard" replace />

  if (errorDescription || timedOut) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-title-2 font-semibold">No pudimos confirmar tu email</h1>
        <p className="max-w-sm text-callout text-label-2">
          El enlace puede haber expirado o ya se usó. Inicia sesión; si tu cuenta no está confirmada, regístrate de
          nuevo para recibir otro enlace.
        </p>
        <Link to="/" replace className="mt-2 text-callout font-medium text-link hover:underline">
          Ir al inicio de sesión
        </Link>
      </div>
    )
  }

  return <FullScreenSpinner />
}
