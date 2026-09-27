import { cn } from '@/lib/cn'
import { useUiStore } from '@/stores/uiStore'
import { useUnreadCount } from './api'

/**
 * Campana con contador de no leídas: abre el cajón de notificaciones. `floating`: botón
 * flotante de 56px (móvil, encima del de amigos); sin él, botón de barra de 44px (escritorio).
 */
export function Bell({ floating }: { floating?: boolean }) {
  const unread = useUnreadCount()
  const open = useUiStore((s) => s.panel === 'notifications')
  const openPanel = useUiStore((s) => s.openPanel)
  return (
    <button
      type="button"
      onClick={() => openPanel('notifications')}
      aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
      aria-haspopup="dialog"
      title="Notificaciones"
      className={cn(
        'relative flex items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
        floating ? 'glass size-14' : 'size-11 hover:bg-fill',
        open ? 'text-accent-text' : 'text-label',
      )}
    >
      <svg aria-hidden viewBox="0 0 20 20" className={cn('fill-none stroke-current stroke-[1.6]', floating ? 'size-6' : 'size-[22px]')}>
        <path d="M10 3a4.5 4.5 0 0 0-4.5 4.5c0 3.2-1.2 5-2 6h13c-.8-1-2-2.8-2-6A4.5 4.5 0 0 0 10 3ZM8.2 16a1.9 1.9 0 0 0 3.6 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {unread > 0 && (
        <span
          className={cn(
            'absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] font-bold text-white',
            floating ? 'top-1.5 right-1.5' : 'top-1 right-1',
          )}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
