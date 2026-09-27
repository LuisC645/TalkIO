import { Navigate, Outlet, useLocation } from 'react-router'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { useAuthStore } from '@/stores/authStore'

export function RequireAuth() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const location = useLocation()

  if (!initialized) return <FullScreenSpinner />
  // El acceso vive en la landing ("/"); se recuerda a dónde quería ir
  if (!session) return <Navigate to="/" replace state={{ from: location }} />
  return <Outlet />
}
