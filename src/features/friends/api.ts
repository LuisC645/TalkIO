import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export type Friend = {
  friend_id: string
  username: string | null
  display_name: string | null
  current_streak: number
  level: number
  cefr: string
  active_today: boolean
}

/** Amigos con su racha y nivel (RPC security definer: solo expone esos datos) */
export function useFriends() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['friends', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_friends')
      if (error) throw error
      return (data ?? []) as Friend[]
    },
  })
}

export function useAddFriend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (username: string) => {
      const { error } = await supabase.rpc('add_friend', { p_username: username })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
  })
}

export function useRemoveFriend() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  return useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase.from('friendships').delete().eq('user_id', userId!).eq('friend_id', friendId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
  })
}
