import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { dayOfMonth, formatLong, formatWeekdayNarrow } from '@/lib/dates'
import type { DayActivity } from '../api'

type Props = { data: DayActivity[] | undefined; goal: number; loading?: boolean; error?: boolean }

const CHART_HEIGHT = 232 // incluye la franja del eje X (anti-patterns › fixed height)

/**
 * XP diario (una serie): columnas ≤ 24px con extremo redondeado de 4px y base recta,
 * un solo color (acento), meta como línea de referencia, rejilla hairline sólida,
 * tooltip por barra (dataviz › marks, interaction).
 */
export function XpChart({ data, goal, loading, error }: Props) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const rows = data ?? []
  const total = rows.reduce((sum, d) => sum + d.xp, 0)
  const goalDays = rows.filter((d) => d.goalMet).length
  const empty = !loading && total === 0
  const yMax = Math.max(goal * 1.25, ...rows.map((d) => d.xp)) || goal
  // Escala limpia: tope múltiplo de 20 → ticks 0 / 20 / 40 …
  const yTop = Math.ceil(yMax / 20) * 20
  const wide = useMediaQuery('(min-width: 640px)')

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-body font-semibold">XP de los últimos 14 días</h2>
          <p className="text-footnote text-label-2">
            {loading ? 'Cargando…' : `${total.toLocaleString('es')} XP · meta cumplida ${goalDays} de 14 días`}
          </p>
        </div>
      </div>

      {error ? (
        <p className="py-16 text-center text-callout text-label-2">No se pudo cargar tu actividad. Recarga la página.</p>
      ) : (
        <div className={cn('relative transition-opacity duration-200', loading && 'opacity-40')} style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: -18 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--separator)" strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: 'var(--separator)' }}
                interval={wide ? 0 : 1}
                height={40}
                tick={(props) => {
                  const x = Number(props.x)
                  const y = Number(props.y)
                  const payload = props.payload as { value: string }
                  const isToday = rows.find((d) => d.date === payload.value)?.isToday
                  return (
                    <g transform={`translate(${x},${y + 4})`}>
                      <text textAnchor="middle" y={10} fontSize={11} fill="var(--label-2)">
                        {formatWeekdayNarrow(payload.value)}
                      </text>
                      <text
                        textAnchor="middle"
                        y={26}
                        fontSize={12}
                        fontWeight={isToday ? 700 : 500}
                        fill={isToday ? 'var(--label)' : 'var(--label-2)'}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {dayOfMonth(payload.value)}
                      </text>
                    </g>
                  )
                }}
              />
              <YAxis
                domain={[0, yTop]}
                ticks={Array.from({ length: yTop / 20 + 1 }, (_, i) => i * 20)}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fontSize: 12, fill: 'var(--label-2)', style: { fontVariantNumeric: 'tabular-nums' } }}
              />
              <ReferenceLine
                y={goal}
                stroke="var(--label-3)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: `Meta ${goal}`, position: 'insideTopRight', fill: 'var(--label-2)', fontSize: 11, dy: -14 }}
              />
              <Tooltip
                cursor={{ fill: 'var(--fill)', radius: 6 }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as DayActivity | undefined
                  if (!active || !d) return null
                  return (
                    <div className="rounded-xl bg-surface px-3 py-2 shadow-[var(--shadow-card)] ring-1 ring-separator">
                      <p className="text-callout font-semibold">{d.xp} XP</p>
                      <p className="text-footnote text-label-2 first-letter:uppercase">{formatLong(d.date)}</p>
                      {d.goalMet && <p className="text-footnote text-label-2">Meta cumplida</p>}
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="xp"
                fill="var(--accent)"
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                isAnimationActive={!reduced}
                animationDuration={400}
                animationEasing="ease-out"
              >
                {/* Etiqueta selectiva: solo el valor de hoy */}
                <LabelList
                  dataKey="xp"
                  position="top"
                  content={(props) => {
                    const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number }
                    if (!rows[index]?.isToday || !value) return null
                    return (
                      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--label)">
                        {value}
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {empty && (
            <p className="absolute inset-x-6 top-[58%] text-center text-callout text-label-2">
              Aún no hay XP. Tu primera lección o repaso aparecerá aquí.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
