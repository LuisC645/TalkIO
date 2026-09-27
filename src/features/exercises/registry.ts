import type { ComponentType } from 'react'
import { ErrorDetectionCard } from './cards/ErrorDetectionCard'
import { FillBlankCard } from './cards/FillBlankCard'
import { FreeWritingCard } from './cards/FreeWritingCard'
import { MultipleChoiceCard } from './cards/MultipleChoiceCard'
import { ReorderCard } from './cards/ReorderCard'
import { TransformCard } from './cards/TransformCard'
import type { CardProps } from './shared'

/**
 * Registro tipo → tarjeta. `type` es texto libre en la BD: agregar un tipo nuevo
 * (p. ej. speaking_prompt con audio en fase 2) es agregar una entrada aquí.
 * speaking_prompt usa por ahora la tarjeta de escritura (MVP sin voz).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EXERCISE_CARDS: Record<string, ComponentType<CardProps<any>>> = {
  multiple_choice: MultipleChoiceCard,
  fill_blank: FillBlankCard,
  tense_contrast: FillBlankCard,
  reorder: ReorderCard,
  transform: TransformCard,
  error_detection: ErrorDetectionCard,
  free_writing: FreeWritingCard,
  speaking_prompt: FreeWritingCard,
}

