import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const

export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id)

  return useQuery({
    queryKey: profileQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data
    },
  })
}
