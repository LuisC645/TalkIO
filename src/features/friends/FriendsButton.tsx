import { PeopleIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useUiStore } from '@/stores/uiStore'
import { useFriends } from './api'

/**
 * Botón de amigos: abre el cajón de amigos. `floating`: botón flotante (móvil), en color de
 * acento para que destaque. Sin `floating`: botón de barra junto a la campana (escritorio).
 * El punto verde indica que algún amigo ya estudió hoy.
 */
export function FriendsButton({ floating, className }: { floating?: boolean; className?: string }) {
  const openPanel = useUiStore((s) => s.openPanel)
  const friends = useFriends()
  const someoneActive = friends.data?.some((f) => f.active_today) ?? false
  return (
    <button
      type="button"
      onClick={() => openPanel('friends')}
      aria-label={someoneActive ? 'Amigos, alguien estudió hoy' : 'Amigos'}
      aria-haspopup="dialog"
      title="Amigos"
      className={cn(
        'relative flex items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
        floating
          ? 'size-14 bg-accent text-white shadow-[0_6px_20px_color-mix(in_srgb,var(--accent)_40%,transparent),0_1px_3px_rgb(0_0_0/0.15)]'
          : 'size-11 text-label hover:bg-fill',
        className,
      )}
    >
      <PeopleIcon className={floating ? 'size-7' : 'size-[22px]'} />
      {someoneActive && (
        <span
          aria-hidden
          className={cn(
            'absolute rounded-full bg-success',
            floating ? 'top-1 right-1 size-3.5 border-2 border-white' : 'top-2 right-2 size-2.5 border-2 border-bg-grouped',
          )}
        />
      )}
    </button>
  )
}
