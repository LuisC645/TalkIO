import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invokeFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export type WritingFeedback = {
  explanation: string
  corrected: string
  errors: { fragment: string; correction: string; code: string; explanation: string }[]
  checklist: { code: string; label: string; examples: string[] }[]
  words: number
}

export type WritingEntry = {
  id: string
  prompt: string | null
  text: string
  score: number | null
  feedback: WritingFeedback
  created_at: string
}

export type WritingResult = {
  id: string
  created_at: string
  score: number
  feedback: WritingFeedback
  xp_awarded: number
  new_patterns: string[]
}

export function useWritingHistory() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['writing', 'history', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('writing_entries')
        .select('id, prompt, text, score, feedback, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as unknown as WritingEntry[]
    },
  })
}

export function useWritingFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { text: string; prompt: string | null }) => invokeFunction<WritingResult>('writing-feedback', vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writing', 'history'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
