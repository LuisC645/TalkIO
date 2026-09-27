import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Wordmark } from '@/components/ui/Wordmark'
import { CONTACT_EMAIL, LEGAL_UPDATED } from './constants'

/**
 * Página legal: lectura cómoda (columna estrecha, secciones cortas), pública, sin la
 * navegación de la app. Enlaces entre ambas políticas al final.
 */
export function LegalLayout({ title, intro, children, other }: { title: string; intro: string; children: ReactNode; other: { to: string; label: string } }) {
  return (
    <div className="min-h-dvh bg-bg-grouped">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
        <Link to="/" aria-label="TalkIO, inicio" className="flex items-center rounded-full py-2">
          <Wordmark />
        </Link>
        <Link to="/" className="min-h-11 content-center rounded-full px-3 text-callout font-medium text-link hover:bg-fill">
          Volver
        </Link>
      </header>
      <main className="animate-stagger mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6">
        <div>
          <p className="text-footnote font-medium text-label-2">Actualizada el {LEGAL_UPDATED}</p>
          <h1 className="mt-1 font-display text-[2.125rem] leading-[1.12] font-bold tracking-[-0.03em] md:text-[2.5rem]">{title}</h1>
          <p className="mt-3 text-body text-label-2">{intro}</p>
        </div>
        <article className="flex flex-col gap-7 rounded-[22px] bg-surface p-5 text-callout leading-relaxed sm:p-8 [&_a]:font-medium [&_a]:text-link [&_h2]:mb-2 [&_h2]:text-body [&_h2]:font-semibold [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_p+p]:mt-2 [&_ul+p]:mt-3 [&_p+ul]:mt-2">
          {children}
        </article>
        <p className="px-1 text-footnote text-label-2">
          Consulta también la <Link to={other.to} className="font-medium text-link">{other.label}</Link>. ¿Dudas? Escríbenos a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-link">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  )
}
