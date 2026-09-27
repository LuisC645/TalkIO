import type { CSSProperties } from 'react'
import { Navigate, useLocation } from 'react-router'
import { AppearanceControl } from '@/components/ui/AppearanceControl'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { Wordmark } from '@/components/ui/Wordmark'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useSurface } from '@/lib/surface'
import { useAuthStore } from '@/stores/authStore'
import { CorrectionDemo } from '../components/CorrectionDemo'
import { CorrectionWall } from '../components/CorrectionWall'

const STEPS = [
  {
    title: 'Diagnóstico',
    body: 'Un test inicial ubica tu nivel (A1–C2) y registra los errores que más repites al escribir.',
  },
  {
    title: 'Lecciones a tu medida',
    body: 'Cada sesión de 20 minutos ataca tus errores activos: una regla clara y ejercicios en tarjetas.',
  },
  {
    title: 'Repaso que no se olvida',
    body: 'El repaso espaciado te devuelve cada palabra justo antes de olvidarla. Un error sale del registro con 3 aciertos seguidos.',
  },
]

const stagger = (n: number) => ({ '--stagger': n }) as CSSProperties

export function LandingPage() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
  useSurface('plain')

  if (!initialized) return <FullScreenSpinner />
  if (session) return <Navigate to={from ?? '/dashboard'} replace />

  return (
    <div className="relative min-h-dvh bg-bg">
      {/* Efecto de borde de desplazamiento: el contenido se desvanece bajo la barra
          en lugar de chocar con ella (liquid-glass.md › Review checklist, 6) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-bg/70 to-transparent backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]"
      />

      {/* Barra de navegación: Liquid Glass flotante, capa funcional */}
      <header className="fixed inset-x-0 top-3 z-30 px-3 sm:top-4 sm:px-6">
        <nav
          aria-label="Principal"
          className="glass mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 rounded-full pr-2.5 pl-5 sm:pl-6"
        >
          <a href="#inicio" className="rounded-full" aria-label="TalkIO, inicio">
            <Wordmark size="lg" />
          </a>
          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="#como-funciona"
              className="hidden min-h-11 items-center rounded-full px-3 text-callout font-medium text-label-2 transition-colors duration-150 hover:text-label sm:flex"
            >
              Cómo funciona
            </a>
            <AppearanceControl />
          </div>
        </nav>
      </header>

      <main>
        {/* Pantalla de acceso: ocupa el 100% de la ventana */}
        <section id="inicio" className="relative isolate flex min-h-dvh items-center overflow-hidden">
          <CorrectionWall className="-z-10" />

          <div
            className={[
              'mx-auto grid w-full max-w-7xl justify-items-center gap-8 px-4 pt-28 pb-12 sm:px-6 sm:pt-32 lg:justify-items-stretch lg:gap-x-16 lg:px-10 lg:pb-16 xl:gap-x-20',
              "[grid-template-areas:'intro'_'auth'_'demo']",
              "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:[grid-template-areas:'intro_auth'_'demo_auth']",
            ].join(' ')}
          >
            <div className="flex w-full max-w-xl flex-col gap-5 [grid-area:intro] lg:max-w-none lg:self-end">
              <h1
                style={stagger(0)}
                className="animate-enter font-display text-[clamp(2.5rem,1.5rem+3vw,4rem)] leading-[1.05] font-bold tracking-[-0.035em] text-balance"
              >
                Inglés que aprende de tus errores.
              </h1>
              <p
                style={stagger(1)}
                className="animate-enter max-w-xl text-[clamp(1.0625rem,0.95rem+0.4vw,1.3125rem)] leading-[1.5] text-label-2 text-pretty"
              >
                TalkIO convierte cada error que cometes en tu próxima lección. Veinte minutos al día, a tu nivel, con
                repaso espaciado para que lo que corriges no se olvide.
              </p>
            </div>

            <div
              style={stagger(2)}
              className="animate-enter w-full max-w-xl [grid-area:auth] lg:ml-auto lg:max-w-md lg:self-center xl:max-w-[30rem]"
            >
              <AuthCard />
            </div>

            <div style={stagger(3)} className="animate-enter w-full max-w-xl [grid-area:demo] lg:max-w-2xl lg:self-start">
              <CorrectionDemo />
            </div>
          </div>

          <a
            href="#como-funciona"
            className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-2 text-footnote font-medium text-label-2 transition-colors duration-150 hover:text-label lg:flex [@media(max-height:760px)]:hidden"
          >
            Cómo funciona
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current stroke-2">
              <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>

        <section id="como-funciona" className="scroll-mt-24 bg-bg-grouped">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <h2 className="font-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.025em]">
              Cómo funciona
            </h2>
            {/* Es una secuencia real, por eso va numerada */}
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8 lg:gap-12">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-label text-callout font-semibold text-bg"
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-body font-semibold">{step.title}</h3>
                  <p className="text-callout text-label-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-separator bg-bg-grouped">
        <p className="mx-auto max-w-7xl px-4 py-8 text-footnote text-label-2 sm:px-6 lg:px-10">
          TalkIO · Proyecto personal de aprendizaje de inglés.
        </p>
      </footer>
    </div>
  )
}
