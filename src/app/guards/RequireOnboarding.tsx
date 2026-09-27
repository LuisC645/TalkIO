import { Navigate, Outlet } from 'react-router'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { useProfile } from '@/features/auth/hooks/useProfile'

/** Si el usuario no ha completado el test de nivel, lo envía a /onboarding antes del dashboard. */
export function RequireOnboarding() {
  const { data: profile, isPending, isError } = useProfile()

  if (isPending) return <FullScreenSpinner />
  // Si el perfil no carga, no se bloquea la app: las páginas muestran su propio error
  if (!isError && !profile.onboarding_completed) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
