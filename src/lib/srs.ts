import { fsrs, generatorParameters, Rating, State, type Card, type Grade, type RecordLogItem } from 'ts-fsrs'

// Límite de cartas nuevas por día: el seed crea ~57 cartas que vencen el mismo día;
// sin tope, la primera sesión de repaso sería inmanejable.
export const NEW_CARDS_PER_DAY = 15

/** Tarjetas para hoy = vencidas + nuevas que aún caben en el cupo diario */
export function reviewsForToday(dueReviews: number, newCards: number, newIntroducedToday = 0): number {
  return dueReviews + newAvailableToday(newCards, newIntroducedToday)
}

export function newAvailableToday(newCards: number, newIntroducedToday: number): number {
  return Math.max(0, Math.min(newCards, NEW_CARDS_PER_DAY - newIntroducedToday))
}

// Planificador FSRS (parámetros por defecto, fuzz activado, pasos cortos de aprendizaje)
export const scheduler = fsrs(generatorParameters({ enable_fuzz: true, enable_short_term: true }))

export { Rating, State }
export type { Grade }

/** Fila de srs_cards → Card de ts-fsrs */
export type SrsRow = {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: string | null
}

export function toCard(row: SrsRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

/** Resultado de ts-fsrs → payload JSON para la RPC record_review */
export function toRecordPayload(item: RecordLogItem) {
  const { card, log } = item
  return {
    card: {
      due: card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      last_review: (card.last_review ?? new Date()).toISOString(),
    },
    log: {
      rating: log.rating,
      state: log.state,
      due: log.due.toISOString(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsed_days: log.elapsed_days,
      last_elapsed_days: log.last_elapsed_days,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      review: log.review.toISOString(),
    },
  }
}

/** "1 min", "10 min", "1 h", "3 d", "2 mes" — intervalo hasta el próximo repaso */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} mes`
  return `${Math.round(months / 12)} a`
}
