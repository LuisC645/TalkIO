import { Link } from 'react-router'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { CardsIcon, CheckIcon, FlameIcon, StarIcon, TargetIcon } from '@/components/ui/icons'
import { Meter } from '@/components/ui/Meter'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { formatLong } from '@/lib/dates'
import { newAvailableToday, reviewsForToday } from '@/lib/srs'
import { useDailyActivity, useErrorPatterns, useLatestAssessment, useProgress, useReviewQueue, useUserToday, useWeeklyStats } from '../api'
import { ErrorPatterns } from '../components/ErrorPatterns'
import { SkillLevels } from '../components/SkillLevels'
import { SummaryStrip } from '../components/SummaryStrip'
import { WeekSummary } from '../components/WeekSummary'
import { XpChart } from '../components/XpChart'
import { FriendsPanel } from '@/features/friends/FriendsPanel'
import { NotificationsPanel } from '@/features/notifications/NotificationsPanel'

function greeting(timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone,
    }).format(new Date()),
  )
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

/**
 * Progreso (estilo iOS): título grande, un solo bloque de resumen, secciones con título fuera
 * de la superficie.
 */
export function DashboardPage() {
  const { data: profile } = useProfile()
  const { timeZone, today } = useUserToday()
  const progress = useProgress()
  const daily = useDailyActivity(14)
  const reviews = useReviewQueue()
  const patterns = useErrorPatterns()
  const assessment = useLatestAssessment()
  const week = useWeeklyStats()

  const p = progress.data
  const goal = p?.daily_goal_xp ?? profile?.daily_goal_xp ?? 50
  const todayXp = p?.today_xp ?? 0
  const goalMet = p?.today_goal_met ?? false
  const streak = p?.current_streak ?? 0
  const level = p?.level ?? 1
  const levelStart = p?.level_start_xp ?? 0
  const levelNext = p?.next_level_xp ?? 50
  const totalXp = p?.total_xp ?? 0
  const q = reviews.data
  const reviewCount = q ? reviewsForToday(q.dueReviews, q.newCards, q.introducedToday) : 0
  const newToday = q ? newAvailableToday(q.newCards, q.introducedToday) : 0
  const overall = assessment.data ? `${assessment.data.overall_cefr}${assessment.data.overall_plus ? '+' : ''}` : undefined
  const firstName = profile?.display_name?.split(' ')[0]
  const todayMinutes = daily.data?.find((d) => d.isToday)?.minutes ?? 0
  const goalMinutes = profile?.daily_goal_minutes ?? 25

  return (
    <div className="animate-stagger flex min-w-0 flex-col gap-10">
      <PageHeader
        eyebrow={formatLong(today)}
        title="Progreso"
        subtitle={
          <>
            {greeting(timeZone)}
            {firstName ? `, ${firstName}` : ''}.{' '}
            {goalMet
              ? 'Meta de hoy cumplida.'
              : todayXp > 0
                ? `Te faltan ${goal - todayXp} XP para la meta.`
                : 'Tu sesión de hoy te espera.'}
          </>
        }
        actions={
          <>
            <Link to="/lessons" className={buttonClasses('primary', 'lg', 'w-full sm:w-auto')}>
              Empezar lección
            </Link>
            <Link to="/review" className={buttonClasses('secondary', 'lg', 'w-full sm:w-auto')}>
              Repasar{reviewCount > 0 ? ` (${reviewCount})` : ''}
            </Link>
          </>
        }
      />

      {/* Desde xl: panel lateral fijo de amigos a la derecha; antes, se abre con el botón de amigos */}
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        <div className="animate-stagger flex min-w-0 flex-col gap-10">
          <SummaryStrip
            loading={progress.isPending}
            metrics={[
              {
                label: 'Racha',
                icon: <FlameIcon className="size-[18px] text-streak" />,
                value: streak,
                unit: streak === 1 ? 'día' : 'días',
                footer: `Récord: ${p?.longest_streak ?? 0} ${p?.longest_streak === 1 ? 'día' : 'días'}`,
              },
              {
                label: 'Meta de hoy',
                icon: goalMet ? <CheckIcon className="size-[18px] text-success" /> : <TargetIcon className="size-[18px]" />,
                value: todayXp,
                unit: `/ ${goal} XP`,
                footer: (
                  <div className="flex flex-col gap-2">
                    <Meter value={todayXp} max={goal} label="Progreso de la meta diaria" />
                    <span>
                      {goalMet ? 'Cumplida' : `${Math.max(0, goal - todayXp)} XP restantes`} · {todayMinutes} de {goalMinutes} min
                    </span>
                  </div>
                ),
              },
              {
                label: 'Nivel',
                icon: <StarIcon className="size-[18px]" />,
                value: level,
                unit: `· ${totalXp.toLocaleString('es')} XP`,
                footer: (
                  <div className="flex flex-col gap-2">
                    <Meter value={totalXp - levelStart} max={levelNext - levelStart} label={`Progreso hacia el nivel ${level + 1}`} />
                    <span>
                      {Math.max(0, levelNext - totalXp)} XP para el nivel {level + 1}
                    </span>
                  </div>
                ),
              },
              {
                label: 'Repasos para hoy',
                icon: <CardsIcon className="size-[18px]" />,
                value: reviewCount,
                unit: reviewCount === 1 ? 'tarjeta' : 'tarjetas',
                footer: q ? `${q.dueReviews} vencidas · ${newToday} nuevas` : undefined,
              },
            ]}
          />

          <section className="flex flex-col gap-3">
            <SectionHeader title="Actividad" />
            <div className="grid gap-4 xl:grid-cols-5">
              <div className="min-w-0 xl:col-span-3">
                <XpChart data={daily.data} goal={goal} loading={daily.isPending} error={daily.isError} />
              </div>
              <div className="min-w-0 xl:col-span-2">
                <WeekSummary stats={week.data} today={today} loading={week.isPending} />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Aprendizaje" />
            <div className="grid gap-4 xl:grid-cols-5">
              <div className="min-w-0 xl:col-span-3">
                <ErrorPatterns
                  active={patterns.data?.active}
                  masteredCount={patterns.data?.masteredCount ?? 0}
                  loading={patterns.isPending}
                />
              </div>
              <div className="min-w-0 xl:col-span-2">
                <SkillLevels
                  overall={overall}
                  skills={(assessment.data?.skills as Record<string, string> | undefined) ?? undefined}
                  loading={assessment.isPending}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Panel lateral: notificaciones y amigos, cada card con su propio desplazamiento */}
        <aside aria-label="Notificaciones y amigos" className="animate-stagger hidden xl:block">
          <div className="sticky top-24 flex h-[calc(100dvh-8rem)] flex-col gap-4">
            <div className="flex max-h-[30%] min-h-0 shrink-0 flex-col overflow-hidden rounded-[22px] bg-surface">
              <NotificationsPanel className="flex-1" />
            </div>
            {/* Amigos ocupa el resto de la altura para ver más a la vez */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-surface">
              <FriendsPanel className="flex-1" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
