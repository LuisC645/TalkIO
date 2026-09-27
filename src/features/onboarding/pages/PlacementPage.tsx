import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { InterestsEditor } from '@/components/ui/InterestsEditor'
import { CheckIcon } from '@/components/ui/icons'
import { Meter } from '@/components/ui/Meter'
import { Spinner } from '@/components/ui/Spinner'
import { Wordmark } from '@/components/ui/Wordmark'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { countWords, liveHints } from '@/lib/writingChecklist'
import { usePlacementQuestions, useSubmitPlacement, type PlacementResult } from '../api'

const stagger = (n: number) => ({ '--stagger': n }) as CSSProperties
const LETTERS = ['A', 'B', 'C', 'D']

type Step = 'welcome' | 'interests' | 'questions' | 'writing' | 'result'

/**
 * Test de nivel para usuarios nuevos (sin contexto). ~5 minutos: intereses → 15 preguntas
 * (A1–C1, con "No lo sé" para no adivinar) → texto corto corregido por IA → nivel y primeros
 * errores. Al terminar, el perfil queda listo y las lecciones se personalizan desde ahí.
 */
export function PlacementPage() {
  const { data: profile, isPending: profilePending } = useProfile()
  const questions = usePlacementQuestions()
  const submit = useSubmitPlacement()
  const [step, setStep] = useState<Step>('welcome')
  const [interests, setInterests] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [writing, setWriting] = useState('')
  const [result, setResult] = useState<PlacementResult | null>(null)

  const qs = questions.data?.questions ?? []
  const current = qs[index]

  const choose = useCallback(
    (choice: number | null) => {
      setAnswers((a) => {
        const next = [...a]
        next[index] = choice
        return next
      })
      if (index < qs.length - 1) setIndex(index + 1)
      else setStep('writing')
    },
    [index, qs.length],
  )

  // Teclado en las preguntas: 1–4 / A–D eligen, 0 o N = "No lo sé"
  useEffect(() => {
    if (step !== 'questions' || !current) return
    function onKey(e: KeyboardEvent) {
      const n = Number(e.key) - 1
      const l = LETTERS.indexOf(e.key.toUpperCase())
      const i = n >= 0 && n < current.options.length ? n : l >= 0 && l < current.options.length ? l : -1
      if (i >= 0) choose(i)
      else if (e.key === '0' || e.key.toLowerCase() === 'n') choose(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, current, choose])

  if (profilePending) return <FullScreenSpinner />
  if (profile?.onboarding_completed && step !== 'result') return <Navigate to="/dashboard" replace />

  function finish() {
    const filled = qs.map((_, i) => answers[i] ?? null)
    submit.mutate({ answers: filled, writing, interests }, { onSuccess: (r) => { setResult(r); setStep('result') } })
  }

  const total = qs.length + 2 // intereses + preguntas + escritura
  const progress = step === 'welcome' ? 0 : step === 'interests' ? 1 : step === 'questions' ? 1 + index : step === 'writing' ? qs.length + 1 : total
  const words = countWords(writing)
  const minWords = questions.data?.writing.min_words ?? 25

  return (
    <div className="flex min-h-dvh flex-col bg-bg-grouped">
      <header className="glass-bar sticky top-0 z-30 border-b border-separator pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4 sm:px-6">
          <Wordmark />
          {step !== 'welcome' && step !== 'result' && (
            <div className="flex flex-1 items-center gap-3">
              <Meter value={progress} max={total} label="Progreso del test" className="flex-1" />
              <span className="text-footnote text-label-2 tabular-nums">
                {progress}/{total}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
        {step === 'welcome' && (
          <div className="flex flex-col gap-6">
            <h1 style={stagger(0)} className="animate-enter font-display text-[clamp(2.125rem,1.6rem+2vw,3rem)] leading-[1.08] font-bold tracking-[-0.03em] text-balance">
              Hola{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}. Veamos tu nivel.
            </h1>
            <p style={stagger(1)} className="animate-enter text-body text-label-2">
              Un test corto de unos 5 minutos: 15 preguntas y un texto breve en inglés. Con eso ubicamos tu nivel y
              empezamos a registrar lo que más te cuesta, para que cada lección sea para ti.
            </p>
            <ul style={stagger(2)} className="animate-enter flex flex-col overflow-hidden rounded-[22px] bg-surface">
              {['Elige tus intereses', '15 preguntas de gramática y vocabulario', 'Escribe unas líneas sobre ti'].map((t, i) => (
                <li key={t} className="relative flex items-center gap-3 px-4 py-3.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-fill text-footnote font-semibold">{i + 1}</span>
                  <span className="text-body">{t}</span>
                  {i < 2 && <span aria-hidden className="absolute right-0 bottom-0 left-14 h-px bg-separator" />}
                </li>
              ))}
            </ul>
            <Button style={stagger(3)} size="lg" className="animate-enter w-full sm:w-fit sm:min-w-52" onClick={() => setStep('interests')}>
              Empezar
            </Button>
          </div>
        )}

        {step === 'interests' && (
          <div className="animate-card flex flex-col gap-6">
            <div>
              <h1 className="font-display text-title-1 font-bold">¿Qué te interesa?</h1>
              <p className="mt-1 text-body text-label-2">Elige de la lista o escribe los tuyos: tus lecciones hablarán de lo que te gusta.</p>
            </div>
            <InterestsEditor value={interests} onChange={setInterests} />
            <Button
              size="lg"
              className="w-full sm:w-fit sm:min-w-52"
              disabled={questions.isPending}
              loading={questions.isPending}
              onClick={() => setStep('questions')}
            >
              {interests.length ? 'Continuar' : 'Omitir'}
            </Button>
            {questions.isError && <p className="text-callout text-danger">{questions.error.message}</p>}
          </div>
        )}

        {step === 'questions' && current && (
          <div key={current.id} className="animate-card flex flex-col gap-6">
            <p className="text-footnote font-medium text-label-2">
              Pregunta {index + 1} de {qs.length} · {current.prompt}
            </p>
            <p className="font-display text-[clamp(1.5rem,1.25rem+1vw,2rem)] leading-[1.3] font-semibold" lang="en">
              {current.sentence.split('___').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="mx-1 inline-block min-w-16 border-b-2 border-accent align-baseline">&nbsp;</span>}
                </span>
              ))}
            </p>
            <div className="flex flex-col gap-2.5" role="group" aria-label="Opciones">
              {current.options.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => choose(i)}
                  className="flex min-h-13 items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left text-body transition-[transform,background-color] duration-150 ease-out hover:bg-fill/60 active:scale-[0.98]"
                >
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-footnote font-semibold text-label-2">
                    {LETTERS[i]}
                  </span>
                  <span lang="en">{o}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => choose(null)}
                className="min-h-11 self-start rounded-full px-3 text-callout font-medium text-link hover:underline"
              >
                No lo sé
              </button>
            </div>
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="self-start text-footnote text-label-2 hover:text-label">
                ← Pregunta anterior
              </button>
            )}
          </div>
        )}

        {step === 'writing' && questions.data && (
          <div className="animate-card flex flex-col gap-5">
            <div>
              <p className="text-footnote font-medium text-label-2">Último paso</p>
              <h1 className="mt-1 font-display text-[clamp(1.5rem,1.25rem+1vw,2rem)] leading-[1.25] font-semibold" lang="en">
                {questions.data.writing.prompt}
              </h1>
              <p className="mt-2 text-callout text-label-2">{questions.data.writing.guidance}</p>
            </div>
            <textarea
              aria-label="Tu texto en inglés"
              value={writing}
              onChange={(e) => setWriting(e.target.value)}
              lang="en"
              rows={7}
              placeholder="Write in English…"
              className="w-full resize-y rounded-2xl border border-field-border bg-surface px-4 py-3.5 text-body leading-[1.6] outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-footnote text-label-2">
              <span className="tabular-nums">{words} palabras</span>
              {liveHints(writing).map((h) => (
                <span key={h.id} className="rounded-full bg-streak/10 px-3 py-1 font-medium text-streak">
                  {h.label}
                </span>
              ))}
            </div>
            {submit.isError && (
              <p role="alert" className="appear rounded-xl bg-danger/10 px-4 py-3 text-callout text-danger">
                {submit.error.message}
              </p>
            )}
            {submit.isPending ? (
              <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-4" aria-live="polite">
                <Spinner className="size-5 text-accent-text" />
                <span className="text-callout">Analizando tus respuestas y tu texto…</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button size="lg" className="w-full sm:w-auto sm:min-w-52" disabled={words < Math.min(10, minWords)} onClick={finish}>
                  Ver mi nivel
                </Button>
                <Button size="lg" variant="plain" onClick={finish}>
                  Omitir el texto
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'result' && result && <Result result={result} />}
      </main>
    </div>
  )
}

const SKILLS: Record<string, string> = { grammar: 'Gramática', vocabulary: 'Vocabulario', writing: 'Escritura' }

function Result({ result }: { result: PlacementResult }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  async function goToDashboard() {
    setLeaving(true)
    await queryClient.invalidateQueries() // perfil con onboarding completo + nivel + errores nuevos
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex flex-col gap-7">
      <div style={stagger(0)} className="animate-enter flex flex-col items-center gap-3 text-center">
        <p className="text-callout font-medium text-label-2">Tu nivel de inglés</p>
        <p className="text-[5rem] leading-none font-bold tracking-[-0.04em]">{result.level}</p>
        <p className="text-callout text-label-2">
          {result.correct} de {result.total} preguntas correctas
        </p>
        {result.summary && <p className="max-w-md text-body text-label">{result.summary}</p>}
      </div>

      <section style={stagger(1)} className="animate-enter flex flex-col gap-2">
        <h2 className="px-4 text-footnote font-medium text-label-2">Por habilidad</h2>
        <ul className="overflow-hidden rounded-[22px] bg-surface">
          {Object.entries(result.skills).map(([k, v]) => (
            <li key={k} className="group/row relative flex min-h-12 items-center justify-between px-4">
              <span className="text-body">{SKILLS[k] ?? k}</span>
              <span className="text-body font-semibold">{v}</span>
              <span aria-hidden className="absolute right-0 bottom-0 left-4 h-px bg-separator group-last/row:hidden" />
            </li>
          ))}
        </ul>
      </section>

      {result.strengths.length > 0 && (
        <section style={stagger(2)} className="animate-enter flex flex-col gap-2">
          <h2 className="px-4 text-footnote font-medium text-label-2">Lo que ya haces bien</h2>
          <ul className="flex flex-col gap-2 rounded-[22px] bg-surface p-4">
            {result.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2 text-callout">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.errors.length > 0 && (
        <section style={stagger(3)} className="animate-enter flex flex-col gap-2">
          <h2 className="px-4 text-footnote font-medium text-label-2">Por dónde empezamos</h2>
          <ul className="overflow-hidden rounded-[22px] bg-surface">
            {result.errors.slice(0, 4).map((e, i) => (
              <li key={i} className="group/row relative px-4 py-3">
                <p className="text-callout" lang="en">
                  <span className="text-danger line-through decoration-2">{e.fragment}</span>
                  <span aria-hidden className="mx-2 text-label-3">→</span>
                  <span className="font-semibold text-success">{e.correction}</span>
                </p>
                <p className="text-footnote text-label-2">{e.explanation}</p>
                <span aria-hidden className="absolute right-0 bottom-0 left-4 h-px bg-separator group-last/row:hidden" />
              </li>
            ))}
          </ul>
          {result.focus.length > 0 && (
            <p className="px-4 text-footnote text-label-2">Ya están en tu registro de errores: {result.focus.join(' · ')}.</p>
          )}
        </section>
      )}

      <Button style={stagger(4)} size="lg" loading={leaving} onClick={goToDashboard} className="animate-enter w-full sm:w-fit sm:min-w-52">
        Ir a mi progreso
      </Button>
    </div>
  )
}
