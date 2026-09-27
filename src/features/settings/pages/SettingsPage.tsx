import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GroupedList, Row } from '@/components/ui/GroupedList'
import { InterestsEditor } from '@/components/ui/InterestsEditor'
import { CheckIcon } from '@/components/ui/icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { DevPanel } from '@/features/settings/components/DevPanel'
import { cn } from '@/lib/cn'
import { DEV_TOOLS } from '@/lib/devTools'
import { useAppearanceStore, type Appearance } from '@/stores/appearanceStore'
import { useAuthStore } from '@/stores/authStore'
import { useUpdateProfile, type ProfilePatch } from '../api'

const XP_OPTIONS = [20, 30, 50, 80, 100, 150]
const MINUTE_OPTIONS = [10, 15, 20, 25, 30, 45, 60]

/**
 * Ajustes estilo iOS: listas agrupadas. Nombre, meta diaria y tiempo por sesión se guardan
 * al cambiarlos (con confirmación "Guardado"). La apariencia sigue al sistema por defecto.
 * Cerrar sesión es destructivo: texto rojo y confirmación en dos pasos.
 */
export function SettingsPage() {
  const { data: profile } = useProfile()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const appearance = useAppearanceStore((s) => s.appearance)
  const setAppearance = useAppearanceStore((s) => s.setAppearance)
  const update = useUpdateProfile()
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState<keyof ProfilePatch | null>(null)
  const savedTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(savedTimer.current), [])

  function save(patch: ProfilePatch) {
    const field = Object.keys(patch)[0] as keyof ProfilePatch
    update.mutate(patch, {
      onSuccess: () => {
        setSaved(field)
        window.clearTimeout(savedTimer.current)
        savedTimer.current = window.setTimeout(() => setSaved(null), 1800)
      },
    })
  }

  const savedMark = (field: keyof ProfilePatch) =>
    saved === field ? (
      <span className="appear flex items-center gap-1 text-footnote font-medium text-success">
        <CheckIcon className="size-3.5" />
        Guardado
      </span>
    ) : null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <PageHeader title="Ajustes" />

      <GroupedList header="Perfil">
        <Row>
          <label htmlFor="display-name" className="shrink-0 text-body">
            Nombre
          </label>
          <span className="flex min-w-0 items-center gap-2">
            {savedMark('display_name')}
            {profile && <NameField key={profile.display_name ?? ''} initial={profile.display_name ?? ''} onSave={(v) => save({ display_name: v })} />}
          </span>
        </Row>
        <Row label="Email" detail={<span className="block max-w-[14rem] truncate sm:max-w-none">{user?.email ?? '—'}</span>} />
      </GroupedList>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-footnote font-medium text-label-2">Intereses</h2>
          {savedMark('interests')}
        </div>
        <div className="rounded-[22px] bg-surface p-4">
          {profile && (
            <InterestsEditor
              value={(profile.interests as string[] | null) ?? []}
              onChange={(next) => save({ interests: next })}
            />
          )}
        </div>
      </section>

      <GroupedList
        header="Estudio"
        footer="La meta diaria define cuántos XP necesitas para mantener tu racha. Los cambios se aplican desde tu próxima actividad."
      >
        <SelectRow
          id="goal-xp"
          label="Meta diaria"
          value={profile?.daily_goal_xp}
          options={XP_OPTIONS}
          format={(v) => `${v} XP`}
          onChange={(v) => save({ daily_goal_xp: v })}
          status={savedMark('daily_goal_xp')}
        />
        <SelectRow
          id="goal-minutes"
          label="Tiempo por sesión"
          value={profile?.daily_goal_minutes}
          options={MINUTE_OPTIONS}
          format={(v) => `${v} min`}
          onChange={(v) => save({ daily_goal_minutes: v })}
          status={savedMark('daily_goal_minutes')}
        />
        <Row label="Zona horaria" detail={profile?.timezone ?? '—'} />
      </GroupedList>
      {update.isError && <p className="-mt-6 px-4 text-footnote text-danger">No se pudo guardar. Revisa tu conexión y vuelve a intentarlo.</p>}

      <GroupedList header="Apariencia" footer="Automático sigue la configuración de tu dispositivo.">
        <Row>
          <SegmentedControl<Appearance>
            label="Apariencia"
            value={appearance}
            onChange={setAppearance}
            className="w-full"
            options={[
              { value: 'system', label: 'Automático' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
            ]}
          />
        </Row>
      </GroupedList>

      <GroupedList header="Reportes semanales" footer="El reporte se genera cada lunes y lo verás aquí.">
        <Row label="Reporte de esta semana" detail="Próximamente" />
      </GroupedList>

      {DEV_TOOLS && <DevPanel />}

      <GroupedList>
        <Row>
          {confirming ? (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-body text-label-2">¿Cerrar sesión?</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="min-h-9 rounded-full px-3 text-callout font-medium text-label-2 hover:bg-fill">
                  Cancelar
                </button>
                <button type="button" onClick={signOut} className="min-h-9 rounded-full bg-danger px-4 text-callout font-semibold text-white active:scale-[0.97]">
                  Cerrar sesión
                </button>
              </span>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="-my-2.5 min-h-12 w-full text-left text-body text-danger">
              Cerrar sesión
            </button>
          )}
        </Row>
      </GroupedList>
    </div>
  )
}

/** Campo de nombre alineado a la derecha (como en Ajustes de iOS). Guarda al salir o con Enter. */
function NameField({ initial, onSave }: { initial: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  const trimmed = value.trim()
  function commit() {
    if (!trimmed) return setValue(initial)
    if (trimmed !== initial) onSave(trimmed.slice(0, 60))
  }
  return (
    <input
      id="display-name"
      value={value}
      maxLength={60}
      autoComplete="name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      className="min-h-9 w-full min-w-0 max-w-56 rounded-lg bg-transparent px-2 text-right text-body text-label-2 outline-none transition-colors duration-150 focus:bg-fill focus:text-label"
    />
  )
}

function SelectRow({
  id,
  label,
  value,
  options,
  format,
  onChange,
  status,
}: {
  id: string
  label: string
  value: number | undefined
  options: number[]
  format: (v: number) => string
  onChange: (v: number) => void
  status: ReactNode
}) {
  // Incluye el valor actual aunque no esté en la lista (p. ej. del seed)
  const all = value != null && !options.includes(value) ? [...options, value].sort((a, b) => a - b) : options
  return (
    <Row>
      <label htmlFor={id} className="text-body">
        {label}
      </label>
      <span className="flex items-center gap-2">
        {status}
        <span className="relative">
          <select
            id={id}
            value={value ?? ''}
            disabled={value == null}
            onChange={(e) => onChange(Number(e.target.value))}
            className={cn(
              'min-h-9 cursor-pointer appearance-none rounded-lg bg-transparent py-1 pr-6 pl-2 text-right text-body text-label-2 outline-none',
              'transition-colors duration-150 hover:bg-fill focus-visible:bg-fill',
            )}
          >
            {all.map((o) => (
              <option key={o} value={o}>
                {format(o)}
              </option>
            ))}
          </select>
          <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 fill-none stroke-label-3 stroke-[1.6]">
            <path d="m3 4.5 3-3 3 3M3 7.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </Row>
  )
}
