import { Drawer } from '@/components/ui/Drawer'
import { FriendsPanel } from '@/features/friends/FriendsPanel'
import { NotificationsPanel } from '@/features/notifications/NotificationsPanel'
import { useUiStore } from '@/stores/uiStore'

/** Cajones de la capa funcional: amigos y notificaciones (uno a la vez). */
export function Panels() {
  const panel = useUiStore((s) => s.panel)
  const closePanel = useUiStore((s) => s.closePanel)
  return (
    <Drawer
      open={!!panel}
      onClose={closePanel}
      label={panel === 'notifications' ? 'Notificaciones' : 'Amigos'}
      // Nace del botón del banner: amigos a la izquierda, notificaciones a la derecha
      origin={panel === 'notifications' ? 'calc(100% - 26px) 28px' : '26px 28px'}
    >
      {(dismiss) =>
        panel === 'notifications' ? (
          <NotificationsPanel onClose={dismiss} className="min-h-[62dvh] flex-1 md:min-h-0" />
        ) : (
          <FriendsPanel onClose={dismiss} className="min-h-[62dvh] flex-1 md:min-h-0" />
        )
      }
    </Drawer>
  )
}
