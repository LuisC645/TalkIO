import { cn } from '@/lib/cn'

// Formas ya corregidas de tus errores reales (docs/user_seed.json). Algunas llevan
// el color de "correcto" para que el vidrio tenga color que refractar.
const ROWS: { words: { text: string; tone?: 'success' | 'accent' }[]; offset: string }[] = [
  { offset: '-8%', words: [{ text: 'went', tone: 'success' }, { text: 'degree' }, { text: 'brush' }, { text: 'I’m' }] },
  { offset: '4%', words: [{ text: 'an airline pilot' }, { text: 'step up', tone: 'accent' }, { text: 'last week' }] },
  { offset: '-14%', words: [{ text: 'anything else' }, { text: 'young people', tone: 'success' }, { text: 'don’t' }] },
  { offset: '-2%', words: [{ text: 'I am taking' }, { text: 'be more successful' }, { text: 'Valorant', tone: 'accent' }] },
  { offset: '-10%', words: [{ text: 'work at NASA' }, { text: 'all my family', tone: 'success' }, { text: 'in the evening' }] },
]

/**
 * Fondo de la pantalla de acceso (capa de contenido, sin vidrio): un muro tenue de tus
 * correcciones. Es estático a propósito: backdrop-filter sobre contenido animado es costoso.
 */
export function CorrectionWall({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden select-none',
        // Se desvanece arriba/abajo; en escritorio además a la izquierda, donde va el texto
        '[mask-image:linear-gradient(to_bottom,transparent,black_14%,black_80%,transparent)]',
        'lg:[mask-image:linear-gradient(to_bottom,transparent,black_14%,black_80%,transparent),linear-gradient(to_right,transparent_28%,black_56%)] lg:[mask-composite:intersect]',
        className,
      )}
    >
      {/* Luz ambiental con los colores de corrección, detrás del panel de acceso */}
      <div className="absolute inset-0 bg-[radial-gradient(38%_48%_at_78%_46%,color-mix(in_srgb,var(--accent)_24%,transparent),transparent_72%),radial-gradient(32%_40%_at_12%_88%,color-mix(in_srgb,var(--success)_16%,transparent),transparent_70%)]" />
      <div className="absolute inset-0 flex flex-col justify-center gap-[2vh]">
        {ROWS.map((row, i) => (
          <p
            key={i}
            style={{ transform: `translateX(${row.offset})` }}
            className="font-display text-[clamp(3.25rem,7.5vw,8rem)] leading-none font-bold tracking-[-0.04em] whitespace-nowrap"
          >
            {row.words.map((w, j) => (
              <span
                key={j}
                className={cn(
                  'mr-[0.45em]',
                  w.tone === 'success' && 'text-success/15 dark:text-success/25',
                  w.tone === 'accent' && 'text-accent/15 dark:text-accent/35',
                  !w.tone && 'text-label/[0.035] dark:text-label/[0.055]',
                )}
              >
                {w.text}
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  )
}
