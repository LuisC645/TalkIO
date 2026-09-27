import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/** Columnas que el usuario puede editar (la base solo permite estas por GRANT de columna) */
export type ProfilePatch = Partial<{
  display_name: string
  daily_goal_xp: number
  daily_goal_minutes: number
  interests: string[]
}>

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
