import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

// Si el servidor rechaza la sesión (caducada o cerrada en otro dispositivo), se cierra la
// sesión local y RequireAuth lleva a iniciar sesión, en lugar de dejar errores en pantalla.
// Import diferido: evita el ciclo queryClient ↔ authStore.
function onError(error: unknown) {
  const e = error as { status?: number; code?: string; message?: string; name?: string }
  const authFailure =
    e?.status === 401 || e?.code === 'PGRST301' || e?.code === 'PGRST303' || /jwt expired|invalid jwt|refresh token/i.test(e?.message ?? '')
  if (!authFailure) return
  void import('@/stores/authStore').then(({ useAuthStore }) => {
    if (useAuthStore.getState().session) void useAuthStore.getState().signOut()
  })
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
