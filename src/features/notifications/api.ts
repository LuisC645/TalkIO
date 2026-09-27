import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { invokeFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export type AppNotification = {
  id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

const SYNC_EVERY_MS = 15 * 60_000
const SHOWN_KEY = 'talkio-notified-ids'

export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, kind, title, body, link, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as AppNotification[]
    },
  })
}

export function useUnreadCount() {
  const { data } = useNotifications()
  return (data ?? []).filter((n) => !n.read_at).length
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

function readShown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function writeShown(ids: Set<string>) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...ids].slice(-200)))
  } catch {
    // sin almacenamiento: puede repetirse un aviso del sistema, no es grave
  }
}

/**
 * Sincroniza con el servidor (reporte semanal, racha en riesgo, exámenes) al abrir la app y cada
 * 15 min. Si el usuario activó las notificaciones del navegador, muestra un aviso del sistema por
 * cada notificación nueva no leída (una sola vez).
 */
export function useNotificationSync() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const { data: profile } = useProfile()
  const { data: list } = useNotifications()

  useEffect(() => {
    if (!userId || !profile?.onboarding_completed) return
    let cancelled = false
    const sync = () =>
      invokeFunction('notifications', { action: 'sync' })
        .then(() => {
          if (!cancelled) queryClient.invalidateQueries({ queryKey: ['notifications'] })
        })
        .catch(() => undefined) // sin conexión: se reintenta en el próximo ciclo
    sync()
    const t = window.setInterval(sync, SYNC_EVERY_MS)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [userId, profile?.onboarding_completed, queryClient])

  useEffect(() => {
    if (!list || !profile?.browser_notifications) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const shown = readShown()
    const fresh = list.filter((n) => !n.read_at && !shown.has(n.id) && Date.now() - new Date(n.created_at).getTime() < 86_400_000)
    for (const n of fresh.slice(0, 3)) {
      const notification = new Notification(n.title, { body: n.body ?? undefined, tag: n.id, icon: '/favicon.svg' })
      notification.onclick = () => {
        window.focus()
        if (n.link) window.location.assign(n.link)
      }
    }
    list.forEach((n) => shown.add(n.id))
    writeShown(shown)
  }, [list, profile?.browser_notifications])
}
