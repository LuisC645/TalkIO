import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

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
      .then(({ data }) => {
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
