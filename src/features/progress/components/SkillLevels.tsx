import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const SKILL_LABELS: Record<string, string> = {
  listening: 'Comprensión auditiva',
  reading: 'Lectura',
  writing: 'Escritura',
  speaking: 'Expresión oral',
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
}

/** "A2+" → { index: 1, plus: true } */
function parseLevel(level: string) {
  const plus = level.trim().endsWith('+')
  const minus = level.trim().endsWith('-')
  const base = level.replace(/[+-]$/, '').trim().toUpperCase()
  return { index: CEFR.indexOf(base as (typeof CEFR)[number]), plus, minus }
}

type Props = {
  overall?: string
  skills?: Record<string, string>
  loading?: boolean
}

/**
 * Escala ordinal A1–C2 por habilidad: 6 segmentos separados por un hueco de 2px
 * (dataviz › surface gap). Relleno en acento, pista en un paso más claro del mismo tono;
 * un "+" rellena media barra del siguiente nivel. El nivel se lee también como texto.
 */
export function SkillLevels({ overall, skills, loading }: Props) {
  const entries = Object.entries(skills ?? {})
  const overallIndex = overall ? parseLevel(overall).index : -1
  const next = overallIndex >= 0 && overallIndex < CEFR.length - 1 ? CEFR[overallIndex + 1] : null

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-body font-semibold">Tu nivel</h2>
          <p className="text-footnote text-label-2">{next ? `En camino a ${next}` : 'Marco europeo (MCER)'}</p>
        </div>
        <p className={cn('text-[2rem] leading-none font-semibold tracking-[-0.02em]', loading && 'opacity-40')}>
          {loading ? '—' : (overall ?? '—')}
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {entries.map(([skill, level]) => {
          const { index, plus } = parseLevel(level)
          return (
            <li key={skill} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-footnote">
                <span className="font-medium text-label">{SKILL_LABELS[skill] ?? skill}</span>
                <span className="font-semibold text-label-2">{level}</span>
              </div>
              <div
                role="img"
                aria-label={`${SKILL_LABELS[skill] ?? skill}: ${level}`}
                className="grid grid-cols-6 gap-0.5"
              >
                {CEFR.map((step, i) => {
                  const fill = i <= index ? 1 : i === index + 1 && plus ? 0.5 : 0
                  return (
                    <span key={step} className="relative h-2 overflow-hidden bg-accent/15 dark:bg-accent/30 first:rounded-l-full last:rounded-r-full">
                      <span
                        className="absolute inset-0 origin-left bg-accent transition-transform duration-500 ease-out motion-reduce:transition-none"
                        style={{ transform: `scaleX(${fill})` }}
                      />
                    </span>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>

      <div aria-hidden className="grid grid-cols-6 gap-0.5 text-center text-[0.6875rem] font-medium text-label-2">
        {CEFR.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
    </Card>
  )
}
