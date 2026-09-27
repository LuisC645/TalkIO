import type { ReactNode } from 'react'
import type { Attempt } from '@/features/lessons/types'

/** Resalta la pista temporal dentro de la oración (tense_contrast) */
export function highlight(text: string, fragment: string | null | undefined): ReactNode {
  if (!fragment) return text
  const i = text.toLowerCase().indexOf(fragment.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-accent/12 px-0.5 text-inherit underline decoration-accent/60 decoration-2 underline-offset-4">
        {text.slice(i, i + fragment.length)}
      </mark>
      {text.slice(i + fragment.length)}
    </>
  )
}

/** Divide una oración en torno a "___" (el primero) */
export function splitBlank(sentence: string): [string, string] {
  const i = sentence.indexOf('___')
  if (i < 0) return [sentence, '']
  return [sentence.slice(0, i), sentence.slice(i).replace(/^_+/, '')]
}

export const sentenceClass = 'font-display text-[clamp(1.1875rem,1.05rem+0.6vw,1.5rem)] leading-[1.6] font-medium tracking-[-0.01em]'

/** Estilo del estado calificado de un campo de texto */
export function resultTone(attempt: Attempt | null) {
  if (!attempt) return ''
  return attempt.is_correct ? 'border-success text-success' : 'border-danger text-danger'
}
