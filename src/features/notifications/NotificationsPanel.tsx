import { useNavigate } from 'react-router'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useMarkRead, useNotifications, type AppNotification } from './api'

const ICON: Record<string, string> = {
  streak_risk: '🔥',
  report_ready: '📊',
  exam_available: '📝',
  level_up: '⭐',
  friend_added: '👋',
  goal_met: '✅',
  system: 'ℹ️',
}

function when(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60_000
  if (diff < 1) return 'ahora'
  if (diff < 60) return `hace ${Math.round(diff)} min`
  if (diff < 60 * 24) return `hace ${Math.round(diff / 60)} h`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

/**
 * Notificaciones: nuevas arriba (con punto azul), anteriores debajo. Tocar una la marca como
 * leída y abre su pantalla (cerrando el cajón). Mismo formato que el panel de amigos.
 */
export function NotificationsPanel({ onClose, className }: { onClose?: () => void; className?: string }) {
  const { data, isPending } = useNotifications()
  const markRead = useMarkRead()
  const navigate = useNavigate()
  const unread = (data ?? []).filter((n) => !n.read_at)
  const earlier = (data ?? []).filter((n) => n.read_at)

  function open(n: AppNotification) {
    if (!n.read_at) markRead.mutate([n.id])
    if (n.link) {
      onClose?.()
      navigate(n.link)
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <PanelHeader
        title="Notificaciones"
        onClose={onClose}
        subtitle={unread.length ? `${unread.length} sin leer` : 'Estás al día.'}
        action={
          unread.length > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate(unread.map((n) => n.id))}
              className="min-h-9 shrink-0 rounded-full px-3 text-footnote font-semibold text-link transition-[background-color,transform] duration-150 ease-out hover:bg-fill active:scale-[0.97]"
            >
              Marcar leídas
            </button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-separator">
        {isPending ? (
          <div className="flex h-32 items-center justify-center text-label-2">
            <Spinner />
          </div>
        ) : !data?.length ? (
          <p className="px-6 py-8 text-center text-callout text-label-2">
            No tienes notificaciones. Aquí verás tu racha en riesgo, reportes, exámenes y amigos.
          </p>
        ) : (
          <>
            {unread.length > 0 && <List title="Nuevas" items={unread} onOpen={open} />}
            {earlier.length > 0 && <List title="Anteriores" items={earlier} onOpen={open} />}
          </>
        )}
      </div>
    </div>
  )
}

function List({ title, items, onOpen }: { title: string; items: AppNotification[]; onOpen: (n: AppNotification) => void }) {
  return (
    <section>
      <h3 className="px-5 pt-3 pb-1 text-footnote font-medium text-label-2">{title}</h3>
      <ul>
        {items.map((n) => (
          <li key={n.id} className="group/row relative">
            <button
              type="button"
              onClick={() => onOpen(n)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-fill/50"
            >
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-[1.0625rem]">
                {ICON[n.kind] ?? 'ℹ️'}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-callout', n.read_at ? 'font-medium' : 'font-semibold')}>{n.title}</span>
                {n.body && <span className="block text-footnote text-label-2">{n.body}</span>}
                <span className="mt-0.5 block text-footnote text-label-3">{when(n.created_at)}</span>
              </span>
              {!n.read_at && <span aria-label="No leída" className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" />}
            </button>
            <span aria-hidden className="absolute right-0 bottom-0 left-16 h-px bg-separator group-last/row:hidden" />
          </li>
        ))}
      </ul>
    </section>
  )
}
