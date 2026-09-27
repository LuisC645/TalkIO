import { useEffect, useState, type ComponentType, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { BookIcon, CardsIcon, ChartIcon, GearIcon, PencilIcon } from '@/components/ui/icons'
import { Wordmark } from '@/components/ui/Wordmark'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { FriendsButton } from '@/features/friends/FriendsButton'
import { useNotificationSync } from '@/features/notifications/api'
import { Bell } from '@/features/notifications/Bell'
import { cn } from '@/lib/cn'
import { Panels } from './Panels'

const NAV: { to: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { to: '/dashboard', label: 'Progreso', icon: ChartIcon },
  { to: '/lessons', label: 'Lecciones', icon: BookIcon },
  { to: '/review', label: 'Repaso', icon: CardsIcon },
  { to: '/write', label: 'Escribir', icon: PencilIcon },
  { to: '/settings', label: 'Ajustes', icon: GearIcon },
]

/**
 * Navegación (capa funcional, Liquid Glass):
 * - ≥ md: barra superior de ancho completo, sin borde perimetral (solo una línea fina al desplazarse).
 * - < md: barra de pestañas flotante fija arriba, con margen lateral y del área segura; abajo a la
 *   derecha, botones flotantes de notificaciones y amigos (zona del pulgar).
 */
export function AppLayout() {
  const location = useLocation()
  const { data: profile } = useProfile()
  const [scrolled, setScrolled] = useState(false)
  useNotificationSync()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  // Tocar el logo o la pestaña de la pantalla actual sube arriba del todo (convención de iOS)
  function scrollTopIfActive(e: MouseEvent, to: string) {
    if (location.pathname !== to) return
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const initial = (profile?.display_name ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div className="min-h-dvh bg-bg-grouped">
      {/* ── Escritorio / tablet ancho: barra superior ── */}
      <header
        className={cn(
          'glass-bar glass-nav sticky top-0 z-30 hidden border-b transition-[border-color] duration-200 md:block',
          scrolled ? 'border-separator' : 'border-transparent',
        )}
      >
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 lg:px-10">
          <NavLink
            to="/dashboard"
            aria-label="TalkIO, progreso"
            // Ya en Progreso: el logo sube arriba del todo (como tocar la barra de estado en iOS)
            onClick={(e) => scrollTopIfActive(e, '/dashboard')}
            className="flex w-fit items-center self-stretch rounded-full"
          >
            <Wordmark size="lg" />
          </NavLink>
          <nav aria-label="Secciones">
            <ul className="flex items-center gap-1 rounded-full bg-fill p-1">
              {NAV.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={(e) => scrollTopIfActive(e, to)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-9 items-center rounded-full px-4 text-callout transition-[background-color,color] duration-150',
                        isActive
                          ? 'bg-thumb font-semibold text-label shadow-[0_1px_2px_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.06)]'
                          : 'font-medium text-label-2 hover:text-label',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-1 justify-self-end">
            <FriendsButton />
            <Bell />
            <NavLink
              to="/settings"
              aria-label="Ajustes y cuenta"
              title="Ajustes y cuenta"
              className="flex size-10 items-center justify-center rounded-full bg-fill text-callout font-semibold text-label transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {initial}
            </NavLink>
          </div>
        </div>
      </header>

      {/* Móvil: borde de desplazamiento; el contenido se desvanece bajo la barra en vez de chocar.
          Fondo sólido del color de la página + máscara (no un degradado): Safari toma el color
          de fondo del elemento fijo que toca el borde superior para pintar la Dynamic Island. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[calc(2.25rem+env(safe-area-inset-top))] bg-bg-grouped [mask-image:linear-gradient(to_bottom,black_45%,transparent)] md:hidden"
      />

      {/* ── Móvil: barra de pestañas flotante, fija arriba ── */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-30 flex justify-center px-4 md:hidden"
      >
        <ul className="glass glass-nav grid h-16 w-full max-w-lg grid-cols-5 rounded-full p-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={(e) => scrollTopIfActive(e, to)}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]',
                    isActive ? 'bg-fill font-semibold text-accent-text' : 'font-medium text-label',
                  )
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Móvil: botones flotantes abajo a la derecha (notificaciones encima de amigos) */}
      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-3 md:hidden">
        <Bell floating />
        <FriendsButton floating />
      </div>
      <Panels />

      {/* key → fundido corto al cambiar de pantalla (frecuente: solo opacidad, 180ms) */}
      <main
        key={location.pathname}
        className="animate-page mx-auto max-w-7xl px-4 pt-[calc(7.5rem+env(safe-area-inset-top))] pb-[calc(10rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-12 md:pb-16 lg:px-10"
      >
        <Outlet />
      </main>

    </div>
  )
}
