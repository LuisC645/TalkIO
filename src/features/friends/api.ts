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

export type FriendRequest = {
  other_id: string
  username: string | null
  display_name: string | null
  direction: 'incoming' | 'outgoing'
  created_at: string
}

// Las solicitudes llegan de otras personas: se revisan cada minuto y al volver a la pestaña
const POLL_MS = 60_000

/** Amigos aceptados (en ambos sentidos) con su racha y nivel (RPC security definer: solo esos datos) */
export function useFriends() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['friends', userId],
    enabled: !!userId,
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_friends')
      if (error) throw error
      return (data ?? []) as Friend[]
    },
  })
}

/** Solicitudes pendientes: recibidas (aceptar / rechazar) y enviadas (cancelar) */
export function useFriendRequests() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['friends', 'requests', userId],
    enabled: !!userId,
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_friend_requests')
      if (error) throw error
      const all = (data ?? []) as FriendRequest[]
      return { incoming: all.filter((r) => r.direction === 'incoming'), outgoing: all.filter((r) => r.direction === 'outgoing') }
    },
  })
}

function useInvalidateFriends() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['friends'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }
}

/** Envía una solicitud; si esa persona ya te había enviado una, la acepta */
export function useAddFriend() {
  const invalidate = useInvalidateFriends()
  return useMutation({
    mutationFn: async (username: string) => {
      const { data, error } = await supabase.rpc('add_friend', { p_username: username })
      if (error) throw new Error(error.message)
      return data as { status: 'pending' | 'accepted'; username: string; display_name: string | null }
    },
    onSuccess: invalidate,
  })
}

export function useRespondRequest() {
  const invalidate = useInvalidateFriends()
  return useMutation({
    mutationFn: async ({ requesterId, accept }: { requesterId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_friend_request', { p_requester: requesterId, p_accept: accept })
      if (error) throw new Error(error.message)
    },
    onSettled: invalidate,
  })
}

/** Quitar un amigo (para los dos) o cancelar una solicitud enviada */
export function useRemoveFriend() {
  const invalidate = useInvalidateFriends()
  return useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await supabase.rpc('remove_friend', { p_other: otherId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
