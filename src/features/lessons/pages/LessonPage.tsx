import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { EXERCISE_CARDS } from '@/features/exercises/registry'
import { ExerciseShell } from '@/features/exercises/shared'
import { useLessonSession } from '@/stores/lessonSessionStore'
import { lessonKeys, useGradeAttempt, useLesson, useLessonPatterns, useRetakeLesson } from '../api'
import { ExamCompletionStage, ExamIntroStage } from '../components/ExamStages'
import { FeedbackSheet } from '../components/FeedbackSheet'
import { PlayerBar } from '../components/PlayerBar'
import { CompletionStage, IntroStage, RuleStage } from '../components/Stages'
import type { ExerciseResponse, GradeResult } from '../types'
import { playSound } from '@/lib/sound'

/**
 * Reproductor de lección (pantalla completa, sin la navegación de la app):
 * intro → regla → una tarjeta por ejercicio con retroalimentación inmediata → cierre.
 * Modo examen (kind ≠ lesson): sin regla, sin pistas y sin retroalimentación hasta el final.
 * Retoma donde quedó: el avance vive en el servidor (exercise_attempts, por ronda).
 */
export function LessonPage() {
  const { lessonId = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: lesson, isPending, isError } = useLesson(lessonId)
  const patterns = useLessonPatterns(lesson?.focus_pattern_ids)
  const grade = useGradeAttempt(lessonId)
  const retake = useRetakeLesson(lessonId)
  const session = useLessonSession()
  const isExam = !!lesson && lesson.kind !== 'lesson'
  const [draft, setDraft] = useState<ExerciseResponse | null>(null)

  const exercises = useMemo(() => lesson?.exercises ?? [], [lesson])
  const firstPending = exercises.findIndex((e) => !lesson?.attempts.has(e.id))

  // Iniciar / retomar la sesión al abrir esta lección
  useEffect(() => {
    if (!lesson || session.lessonId === lesson.id) return
    const started = lesson.attempts.size > 0
    if (lesson.status === 'completed') session.start(lesson.id, 'done', exercises.length - 1)
    else session.start(lesson.id, 'intro', started ? Math.max(0, firstPending) : 0)
  }, [lesson, session, firstPending, exercises.length])

  const current = exercises[session.index]
  const attempt = current ? (lesson?.attempts.get(current.id) ?? null) : null
  const isLast = session.index >= exercises.length - 1

  const advance = useCallback((completed?: boolean) => {
    setDraft(null)
    grade.reset()
    if (isLast || completed || session.result?.lesson.completed) {
      queryClient.invalidateQueries({ queryKey: lessonKeys.detail(lessonId) })
      patterns.refetch()
      playSound('complete')
      session.setStage('done')
      return
    }
    const next = exercises.findIndex((e, i) => i > session.index && !lesson?.attempts.has(e.id))
    session.next(next >= 0 ? next : session.index + 1)
    window.scrollTo({ top: 0 })
  }, [isLast, session, exercises, lesson, queryClient, lessonId, patterns, grade])

  const submit = useCallback(() => {
    if (!current || !draft || attempt || grade.isPending) return
    grade.mutate(
      { exercise_id: current.id, response: draft, duration_ms: Date.now() - session.shownAt },
      {
        onSuccess: (result: GradeResult) => {
          // En examen no se revela si acertó: sonido neutro al registrar la respuesta
          if (!isExam) playSound(result.is_correct ? 'correct' : 'wrong')
          else if (!result.lesson.completed) playSound('flip')
          session.showResult(result)
          // En examen no hay retroalimentación por pregunta: se pasa directo a la siguiente
          if (isExam) advance(result.lesson.completed)
        },
      },
    )
  }, [current, draft, attempt, grade, session, isExam, advance])

  function onRetake() {
    retake.mutate(undefined, {
      onSuccess: () => {
        session.start(lessonId, 'exercise', 0)
        window.scrollTo({ top: 0 })
      },
    })
  }

  // Enter: comprobar / continuar (los campos manejan su propio Enter)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLButtonElement) return
      if (session.result && !isExam) advance()
      else submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.result, advance, submit, isExam])

  if (isPending) return <FullScreenSpinner />
  if (isError || !lesson) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg-grouped px-6 text-center">
        <h1 className="font-display text-title-2 font-semibold">No encontramos esta lección</h1>
        <Link to="/lessons" className={buttonClasses('primary', 'md')}>
          Volver a lecciones
        </Link>
      </div>
    )
  }

  // En examen el progreso no revela aciertos (true = respondida, sin color de resultado)
  const results = exercises.map((e) => {
    const a = lesson.attempts.get(e.id)
    return a ? !!a.is_correct : null
  })
  const meta = lesson.meta as { pass_threshold?: number; target_level?: string; passed?: boolean; from_level?: string; new_level?: string | null }
  const correctCount = results.filter((r) => r === true).length
  const Card = current ? EXERCISE_CARDS[current.type] : undefined

  return (
    <div className="min-h-dvh bg-bg-grouped">
      <PlayerBar
        total={exercises.length}
        results={results}
        current={session.index}
        neutral={isExam && session.stage !== 'done'}
        xp={session.stage === 'done' ? lesson.xp_earned || session.sessionXp : session.sessionXp}
      />

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-[calc(16rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        {session.stage === 'intro' && isExam && (
          <ExamIntroStage
            kind={lesson.kind}
            title={lesson.title}
            covers={lesson.covers}
            summary={lesson.summary}
            count={exercises.length}
            threshold={meta.pass_threshold ?? (lesson.kind === 'level_exam' ? 80 : 70)}
            targetLevel={meta.target_level ?? null}
            resuming={lesson.attempts.size > 0}
            onStart={() => session.setStage('exercise')}
          />
        )}

        {session.stage === 'intro' && !isExam && (
          <IntroStage
            title={lesson.title}
            focus={(patterns.data ?? []).map((p) => p.title)}
            exercises={exercises}
            resuming={lesson.attempts.size > 0}
            onStart={() => session.setStage(lesson.attempts.size > 0 || !lesson.rule ? 'exercise' : 'rule')}
          />
        )}

        {session.stage === 'rule' && lesson.rule && <RuleStage rule={lesson.rule} vocabulary={lesson.vocabulary} onContinue={() => session.setStage('exercise')} />}

        {session.stage === 'exercise' && current && (
          <div key={current.id} className="animate-card">
            <ExerciseShell
              phase={current.phase}
              type={current.type}
              instruction={String(current.payload.instruction ?? '')}
              hint={(current.payload.hint as string | null) ?? null}
              passage={(current.payload.passage as string | undefined) ?? null}
            >
              {Card ? (
                <Card payload={current.payload} value={draft} onChange={setDraft} attempt={attempt} onSubmit={submit} />
              ) : (
                <p className="text-callout text-label-2">Este tipo de ejercicio aún no está disponible.</p>
              )}
            </ExerciseShell>
          </div>
        )}

        {session.stage === 'done' && isExam && (
          <ExamCompletionStage
            kind={lesson.kind}
            score={lesson.score ?? session.result?.lesson.score ?? 0}
            threshold={meta.pass_threshold ?? session.result?.lesson.pass_threshold ?? 70}
            passed={meta.passed ?? session.result?.lesson.passed ?? false}
            fromLevel={meta.from_level ?? session.result?.lesson.from_level ?? null}
            newLevel={meta.new_level ?? session.result?.lesson.new_level ?? null}
            targetLevel={meta.target_level ?? null}
            xp={lesson.xp_earned || session.result?.lesson.xp_earned || session.sessionXp}
            exercises={exercises}
            attempts={lesson.attempts}
          />
        )}

        {session.stage === 'done' && !isExam && (
          <CompletionStage
            round={lesson.round}
            onRetake={onRetake}
            retaking={retake.isPending}
            score={lesson.score ?? session.result?.lesson.score ?? 0}
            xp={lesson.xp_earned || session.result?.lesson.xp_earned || session.sessionXp}
            correct={correctCount}
            total={exercises.length}
            patterns={(patterns.data ?? []).map((p) => ({
              title: p.title,
              streak: Math.min(p.correct_streak, p.mastery_threshold),
              threshold: p.mastery_threshold,
              mastered: p.status === 'mastered',
            }))}
          />
        )}
      </main>

      {/* Barra de acción inferior (capa funcional) o, tras calificar, la hoja de retroalimentación */}
      {session.stage === 'exercise' && current && !session.result && (
        <div className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t border-separator pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-footnote text-label-2" aria-live="polite">
              {grade.isError
                ? <span className="font-medium text-danger">{grade.error.message}</span>
                : grade.isPending && current.grading === 'ai'
                  ? 'Revisando tu respuesta…'
                  : `${isExam ? 'Pregunta' : 'Ejercicio'} ${session.index + 1} de ${exercises.length}`}
            </p>
            {attempt ? (
              <Button size="lg" onClick={() => advance()} className="w-full sm:w-auto sm:min-w-44">
                Siguiente
              </Button>
            ) : (
              <Button size="lg" onClick={submit} disabled={!draft} loading={grade.isPending} className="w-full sm:w-auto sm:min-w-44">
                {isExam ? (isLast ? 'Terminar examen' : 'Siguiente') : 'Comprobar'}
              </Button>
            )}
          </div>
        </div>
      )}

      {session.stage === 'exercise' && current && session.result && !isExam && (
        <FeedbackSheet
          result={session.result}
          exerciseType={current.type}
          onContinue={() => advance()}
          continueLabel={isLast || session.result.lesson.completed ? 'Ver resultados' : 'Continuar'}
        />
      )}

    </div>
  )
}
