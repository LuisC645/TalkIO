import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Reglas de desbloqueo de exámenes (una sola fuente: las usa la función `exams`)
export const WEEKLY_REQUIRED_LESSONS = 2
export const LEVEL_REQUIRED_LESSONS = 5
export const LEVEL_MIN_AVG = 70
export const LEVEL_PASS = 80
export const WEEKLY_PASS = 70
export const LEVEL_COOLDOWN_DAYS = 3
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function localDate(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function mondayOf(iso: string): string {
  const day = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(iso, -day)
}
export function nextLevel(level: string | null): string | null {
  const i = LEVELS.indexOf(level ?? 'A1')
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null
}

type ExamRow = { id: string; status: string; score: number | null; meta: Record<string, unknown>; completed_at: string | null; generated_at: string }

export async function examStatus(admin: SupabaseClient, userId: string) {
  const [profileRes, lessonsRes, examsRes, assessRes] = await Promise.all([
    admin.from('profiles').select('timezone, cefr_level, cefr_plus, learner_context').eq('id', userId).single(),
    admin
      .from('lessons')
      .select('id, score, completed_at')
      .eq('user_id', userId)
      .eq('kind', 'lesson')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(100),
    admin
      .from('lessons')
      .select('id, kind, status, score, meta, completed_at, generated_at')
      .eq('user_id', userId)
      .in('kind', ['weekly_exam', 'level_exam'])
      .order('generated_at', { ascending: false })
      .limit(30),
    admin.from('level_assessments').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (profileRes.error) throw profileRes.error
  const profile = profileRes.data
  const tz = profile.timezone ?? 'UTC'
  const today = localDate(tz)
  const weekStart = mondayOf(today)
  const devUnlock = !!(profile.learner_context as Record<string, unknown> | null)?.dev_unlock_exams
  const lessons = lessonsRes.data ?? []
  const exams = (examsRes.data ?? []) as (ExamRow & { kind: string })[]

  // ── Semanal ──
  const thisWeek = lessons.filter((l) => l.completed_at && localDate(tz, new Date(l.completed_at)) >= weekStart)
  const weeklyExam = exams.find((e) => e.kind === 'weekly_exam' && e.meta?.week_start === weekStart) ?? null
  const weekly = {
    week_start: weekStart,
    lessons_this_week: thisWeek.length,
    required: WEEKLY_REQUIRED_LESSONS,
    available: !weeklyExam && (thisWeek.length >= WEEKLY_REQUIRED_LESSONS || devUnlock),
    exam: weeklyExam ? summarize(weeklyExam) : null,
    history: exams.filter((e) => e.kind === 'weekly_exam' && e.status === 'completed').slice(0, 8).map(summarize),
  }

  // ── Nivel ──
  const current = `${profile.cefr_level ?? 'A1'}${profile.cefr_plus ? '+' : ''}`
  const target = nextLevel(profile.cefr_level)
  const since = assessRes.data?.created_at ?? '1970-01-01'
  const sinceLessons = lessons.filter((l) => l.completed_at && l.completed_at > since)
  const avg = sinceLessons.length ? Math.round(sinceLessons.reduce((s, l) => s + Number(l.score ?? 0), 0) / sinceLessons.length) : 0
  const activeLevel = exams.find((e) => e.kind === 'level_exam' && e.status !== 'completed') ?? null
  const lastLevel = exams.find((e) => e.kind === 'level_exam' && e.status === 'completed') ?? null
  const cooldownUntil =
    lastLevel && !lastLevel.meta?.passed && lastLevel.completed_at
      ? new Date(new Date(lastLevel.completed_at).getTime() + LEVEL_COOLDOWN_DAYS * 86_400_000).toISOString()
      : null
  const inCooldown = !!cooldownUntil && new Date(cooldownUntil) > new Date()
  const meetsProgress = sinceLessons.length >= LEVEL_REQUIRED_LESSONS && avg >= LEVEL_MIN_AVG
  const level = {
    current,
    target,
    lessons_since: sinceLessons.length,
    required: LEVEL_REQUIRED_LESSONS,
    average: avg,
    min_average: LEVEL_MIN_AVG,
    pass_threshold: LEVEL_PASS,
    cooldown_until: inCooldown ? cooldownUntil : null,
    available: !!target && !activeLevel && ((meetsProgress && !inCooldown) || devUnlock),
    exam: activeLevel ? summarize(activeLevel) : null,
    last: lastLevel ? summarize(lastLevel) : null,
  }

  return { today, weekly, level, dev_unlock: devUnlock }
}

function summarize(e: ExamRow) {
  return {
    id: e.id,
    status: e.status,
    score: e.score,
    passed: (e.meta?.passed as boolean | undefined) ?? null,
    target_level: (e.meta?.target_level as string | undefined) ?? null,
    new_level: (e.meta?.new_level as string | undefined) ?? null,
    week_start: (e.meta?.week_start as string | undefined) ?? null,
    completed_at: e.completed_at,
  }
}
