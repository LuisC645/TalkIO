import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

/** Error de sesión inválida (no un fallo de red: sin conexión se conserva la sesión) */
export function isInvalidSession(error: { status?: number; name?: string; message?: string; code?: string }) {
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.name === 'AuthSessionMissingError' ||
    /jwt expired|invalid jwt|refresh token|session.*not.*found|user.*not.*found/i.test(`${error.code ?? ''} ${error.message ?? ''}`)
  )
}

type AuthState = {
  session: Session | null
  user: User | null
  initialized: boolean
  init: () => () => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  initialized: false,

  // Se llama una vez al montar la app; devuelve la función para desuscribirse.
  init: () => {
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        // La sesión guardada puede haber caducado o cerrado en otro dispositivo: se confirma con
        // el servidor antes de entrar. Si no es válida → sin sesión (RequireAuth lleva al inicio).
        if (data.session) {
          const { error } = await supabase.auth.getUser()
          if (error && isInvalidSession(error)) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
            return set({ session: null, user: null, initialized: true })
          }
        }
        set({ session: data.session, user: data.session?.user ?? null, initialized: true })
      })
      // Almacenamiento bloqueado (navegación privada estricta, iframes): se sigue sin sesión
      .catch(() => set({ session: null, user: null, initialized: true }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, initialized: true })
    })
    return () => data.subscription.unsubscribe()
  },

  signOut: async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  },
}))
