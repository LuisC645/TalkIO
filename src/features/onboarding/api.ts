import { useMutation, useQuery } from '@tanstack/react-query'
import { invokeFunction } from '@/lib/functions'

export type PlacementQuestion = {
  id: string
  level: string
  skill: 'grammar' | 'vocabulary'
  prompt: string
  sentence: string
  options: string[]
}

export type PlacementResult = {
  level: string
  skills: Record<string, string>
  correct: number
  total: number
  summary: string | null
  strengths: string[]
  focus: string[]
  errors: { fragment: string; correction: string; code: string; explanation: string }[]
}

export function usePlacementQuestions() {
  return useQuery({
    queryKey: ['placement', 'questions'],
    staleTime: Infinity,
    queryFn: () =>
      invokeFunction<{ questions: PlacementQuestion[]; writing: { prompt: string; guidance: string; min_words: number } }>('placement', {
        action: 'questions',
      }),
  })
}

// Nota: el perfil se refresca al salir de la pantalla de resultado (no aquí), para que
// la página no redirija al dashboard antes de mostrar el nivel.
export function useSubmitPlacement() {
  return useMutation({
    mutationFn: (vars: { answers: (number | null)[]; writing: string; interests: string[] }) =>
      invokeFunction<PlacementResult>('placement', {
        action: 'submit',
        ...vars,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
  })
}
