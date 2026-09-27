import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CheckIcon } from '@/components/ui/icons'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { cn } from '@/lib/cn'
import { countWords, liveHints } from '@/lib/writingChecklist'
import { useWritingFeedback, useWritingHistory, type WritingEntry, type WritingFeedback } from '../api'

const MIN_WORDS = 5

// Ideas para empezar (se mezclan con los intereses del perfil)
const BASE_PROMPTS = [
  'What did you do last weekend?',
  'Describe your typical day.',
  'What would you do with unlimited money?',
  'Tell me about a trip you remember.',
  'What is your dream job and why?',
  'Describe a person who inspires you.',
  'What is the best advice you have ever received?',
  'Tell me about a mistake you learned from.',
  'What would you change about your city?',
  'Describe your perfect weekend.',
  'What is a skill you want to learn this year?',
  'Tell me about your favorite meal and how to make it.',
  'Is social media good or bad for young people? Why?',
  'Describe a movie or series you recommend.',
  'What did you do yesterday, from morning to night?',
  'Where would you like to live in ten years?',
  'Tell me about a difficult day and how you handled it.',
  'What makes a good friend?',
  'Describe a technology you could not live without.',
  'What is something you are proud of?',
]

// Intereses del test de nivel (en español) → tema en inglés para la consigna
const INTEREST_EN: Record<string, string> = {
  Viajes: 'a trip you would like to take',
  Trabajo: 'your job or the job you want',
  Tecnología: 'a piece of technology you use every day',
  Videojuegos: 'your favorite video game',
  Deportes: 'a sport you like',
  Música: 'the music you listen to',
  'Películas y series': 'a movie or series you recommend',
  Ciencia: 'a scientific topic that interests you',
  Negocios: 'a business idea you have',
  Comida: 'your favorite food',
  Salud: 'your healthy habits',
  Estudios: 'what you are studying or want to study',
}

/**
 * Escribir: práctica libre. El usuario escribe lo que quiera en inglés y recibe corrección:
 * texto corregido, errores explicados, checklist de escritura y puntuación. Los errores entran
 * a su registro (y se crean patrones nuevos cuando aparecen por primera vez).
 */
export function WritePage() {
  const { data: profile } = useProfile()
  const history = useWritingHistory()
  const review = useWritingFeedback()
  const [text, setText] = useState('')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [shown, setShown] = useState<{ entry: Pick<WritingEntry, 'text' | 'score' | 'feedback' | 'prompt'>; xp?: number; newPatterns?: string[] } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const interests = (profile?.interests as string[] | undefined) ?? []
  // Sugerencia aleatoria (solo una recomendación): banco general + temas de tus intereses
  const pool = [...interests.map((i) => `Write about ${INTEREST_EN[i] ?? i}.`), ...BASE_PROMPTS]
  const [suggestion, setSuggestion] = useState(() => pool[Math.floor(Math.random() * pool.length)])
  function nextSuggestion() {
    const others = pool.filter((p) => p !== suggestion)
    setSuggestion(others[Math.floor(Math.random() * others.length)] ?? suggestion)
  }
  const words = countWords(text)
  const hints = liveHints(text)

  function submit() {
    if (words < MIN_WORDS || review.isPending) return
    review.mutate(
      { text, prompt },
      {
        onSuccess: (r) => {
          setShown({ entry: { text, score: r.score, feedback: r.feedback, prompt }, xp: r.xp_awarded, newPatterns: r.new_patterns })
          requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        },
      },
    )
  }

  function startNew() {
    setText('')
    setPrompt(null)
    setShown(null)
    review.reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="animate-stagger mx-auto flex max-w-3xl flex-col gap-10">
      <PageHeader title="Escribir" subtitle="Escribe lo que quieras en inglés y recibe corrección al instante." />

      <section className="flex flex-col gap-4">
        {/* Sugerencia aleatoria: solo una recomendación; se puede escribir sobre cualquier cosa */}
        {!prompt && (
          <div className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="text-footnote font-medium text-label-2">Sugerencia (opcional)</p>
              <p key={suggestion} className="appear mt-0.5 text-callout font-semibold" lang="en">
                {suggestion}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={nextSuggestion}
                className="min-h-10 rounded-full bg-fill px-4 text-footnote font-semibold text-label transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                Otra idea
              </button>
              <button
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="min-h-10 rounded-full px-4 text-footnote font-semibold text-link transition-[background-color,transform] duration-150 ease-out hover:bg-fill active:scale-[0.97]"
              >
                Usar este tema
              </button>
            </div>
          </div>
        )}
        <p className="-mt-2 px-1 text-footnote text-label-2">Es solo una recomendación: puedes escribir sobre lo que quieras.</p>

        <div className="overflow-hidden rounded-[22px] bg-surface">
          {prompt && (
            <div className="flex items-center gap-3 border-b border-separator px-5 pt-4 pb-3">
              <p className="min-w-0 flex-1 text-callout font-semibold" lang="en">
                {prompt}
              </p>
              <button type="button" onClick={() => setPrompt(null)} className="min-h-9 shrink-0 rounded-full px-3 text-footnote font-medium text-link hover:bg-fill">
                Quitar tema
              </button>
            </div>
          )}
          <textarea
            aria-label="Tu texto en inglés"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit()}
            lang="en"
            rows={8}
            maxLength={4000}
            placeholder="Start writing in English…"
            className="block w-full resize-y bg-transparent px-5 py-4 text-body leading-[1.65] outline-none placeholder:text-label-2/80"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-separator px-5 py-3">
            <span className="text-footnote text-label-2 tabular-nums">{words} palabras</span>
            {hints.map((h) => (
              <span key={h.id} className="rounded-full bg-streak/10 px-3 py-1 text-footnote font-medium text-streak">
                {h.label}
              </span>
            ))}
          </div>
        </div>

        {review.isError && (
          <p role="alert" className="appear rounded-xl bg-danger/10 px-4 py-3 text-callout text-danger">
            {review.error.message}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button size="lg" onClick={submit} disabled={words < MIN_WORDS} loading={review.isPending} className="w-full sm:w-auto sm:min-w-44">
            Revisar
          </Button>
          <p className="text-footnote text-label-2">
            {review.isPending ? (
              'Revisando tu texto…'
            ) : words < MIN_WORDS ? (
              `Escribe al menos ${MIN_WORDS} palabras.`
            ) : (
              <span className="hidden [@media(hover:hover)]:inline">Ctrl + Enter para revisar</span>
            )}
          </p>
        </div>
      </section>

      {shown && (
        <div ref={resultRef} className="scroll-mt-24">
          <FeedbackView entry={shown.entry} xp={shown.xp} newPatterns={shown.newPatterns} onNew={startNew} />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Tus textos" />
        {!history.data?.length ? (
          <p className="rounded-[22px] bg-surface px-5 py-8 text-center text-callout text-label-2">
            {history.isPending ? 'Cargando…' : 'Aquí aparecerán los textos que revises.'}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[22px] bg-surface">
            {history.data.map((e) => (
              <li key={e.id} className="group/row relative">
                <button
                  type="button"
                  onClick={() => {
                    setShown({ entry: e })
                    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                  }}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-fill/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-medium" lang="en">
                      {e.text}
                    </span>
                    <span className="block text-footnote text-label-2">
                      {new Date(e.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {e.feedback.words ?? countWords(e.text)} palabras
                    </span>
                  </span>
                  <span className="shrink-0 text-callout font-semibold tabular-nums">
                    {e.score != null ? Math.round(e.score * 100) : '—'}
                    <span className="text-footnote font-medium text-label-2">/100</span>
                  </span>
                </button>
                <span aria-hidden className="absolute right-0 bottom-0 left-5 h-px bg-separator group-last/row:hidden" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function FeedbackView({
  entry,
  xp,
  newPatterns,
  onNew,
}: {
  entry: { text: string; score: number | null; feedback: WritingFeedback; prompt: string | null }
  xp?: number
  newPatterns?: string[]
  onNew: () => void
}) {
  const f = entry.feedback
  const score = Math.round((entry.score ?? 0) * 100)
  const tone = score >= 70 ? 'text-success' : score >= 50 ? 'text-streak' : 'text-danger'
  return (
    <section className="animate-card flex flex-col gap-4" aria-live="polite">
      <SectionHeader title="Corrección" detail={xp ? <span className="font-semibold text-accent-text">+{xp} XP</span> : undefined} />

      <div className="flex flex-col gap-4 rounded-[22px] bg-surface p-5 sm:p-6">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-[2.75rem] leading-none font-bold tracking-[-0.03em]', tone)}>{score}</span>
          <span className="text-callout font-medium text-label-2">/100</span>
        </div>
        <p className="text-body text-label">{f.explanation}</p>
      </div>

      {f.errors.length > 0 && (
        <ul className="overflow-hidden rounded-[22px] bg-surface">
          {f.errors.map((e, i) => (
            <li key={i} className="group/row relative px-5 py-3.5">
              <p className="text-callout" lang="en">
                <span className="text-danger line-through decoration-2">{e.fragment}</span>
                {e.correction && (
                  <>
                    <span aria-hidden className="mx-2 text-label-3">→</span>
                    <span className="font-semibold text-success">{e.correction}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-footnote text-label-2">{e.explanation}</p>
              <span aria-hidden className="absolute right-0 bottom-0 left-5 h-px bg-separator group-last/row:hidden" />
            </li>
          ))}
        </ul>
      )}

      {f.checklist?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.checklist.map((c) => (
            <span key={c.code} className="rounded-full bg-streak/10 px-3 py-1 text-footnote font-medium text-streak">
              {c.label}
            </span>
          ))}
        </div>
      )}

      {f.corrected && (
        <div className="rounded-[22px] bg-surface p-5 sm:p-6">
          <p className="mb-2 flex items-center gap-1.5 text-footnote font-medium text-label-2">
            <CheckIcon className="size-4 text-success" />
            Texto corregido
          </p>
          <p className="text-body leading-[1.65] whitespace-pre-wrap" lang="en">
            {f.corrected}
          </p>
        </div>
      )}

      {!!newPatterns?.length && (
        <p className="px-1 text-footnote text-label-2">Nuevo en tu registro de errores: {newPatterns.join(' · ')}.</p>
      )}

      <Button variant="secondary" size="lg" onClick={onNew} className="w-full sm:w-fit">
        Escribir otro texto
      </Button>
    </section>
  )
}
