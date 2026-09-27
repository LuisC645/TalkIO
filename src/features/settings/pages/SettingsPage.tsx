import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Switch } from '@/components/ui/Switch'
import { useWeeklyReports, weekLabel } from '../reports'
import { GroupedList, Row } from '@/components/ui/GroupedList'
import { InterestsEditor } from '@/components/ui/InterestsEditor'
import { CheckIcon } from '@/components/ui/icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { DevPanel } from '@/features/settings/components/DevPanel'
import { cn } from '@/lib/cn'
import { DEV_TOOLS, isAdmin } from '@/lib/devTools'
import { XP_PER_MINUTE } from '@/lib/xp'
import { useAppearanceStore, type Appearance } from '@/stores/appearanceStore'
import { useAuthStore } from '@/stores/authStore'
import { useSoundStore } from '@/stores/soundStore'
import { useUiStore } from '@/stores/uiStore'
import { playSound } from '@/lib/sound'
import { useUpdateProfile, type ProfilePatch } from '../api'

const MINUTE_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60]
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

/**
 * Ajustes estilo iOS: listas agrupadas. Nombre y tiempo por sesión (con su meta en XP) se guardan
 * al cambiarlos (con confirmación "Guardado"). La apariencia sigue al sistema por defecto.
 * Cerrar sesión es destructivo: texto rojo y confirmación en dos pasos.
 */
export function SettingsPage() {
  const { data: profile } = useProfile()
  const user = useAuthStore((s) => s.user)
  const openPanel = useUiStore((s) => s.openPanel)
  const soundOn = useSoundStore((s) => s.enabled)
  const setSoundOn = useSoundStore((s) => s.setEnabled)
  const signOut = useAuthStore((s) => s.signOut)
  const appearance = useAppearanceStore((s) => s.appearance)
  const setAppearance = useAppearanceStore((s) => s.setAppearance)
  const update = useUpdateProfile()
  const reports = useWeeklyReports()
  const [confirming, setConfirming] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [notifError, setNotifError] = useState<string | null>(null)
  const [saved, setSaved] = useState<keyof ProfilePatch | null>(null)
  const savedTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(savedTimer.current), [])

  function save(patch: ProfilePatch, onError?: (err: Error & { code?: string }) => void) {
    const field = Object.keys(patch)[0] as keyof ProfilePatch
    update.mutate(patch, {
      onSuccess: () => {
        setSaved(field)
        window.clearTimeout(savedTimer.current)
        savedTimer.current = window.setTimeout(() => setSaved(null), 1800)
      },
      onError: onError as never,
    })
  }

  function saveUsername(value: string) {
    const v = value.trim().replace(/^@/, '').toLowerCase()
    if (!USERNAME_RE.test(v)) {
      setUsernameError('Usa de 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo.')
      return
    }
    setUsernameError(null)
    save({ username: v }, (err) => setUsernameError(err.code === '23505' ? 'Ese nombre de usuario ya está en uso.' : 'No se pudo guardar.'))
  }

  async function toggleBrowserNotifications(next: boolean) {
    setNotifError(null)
    if (next) {
      if (!('Notification' in window)) return setNotifError('Tu navegador no admite notificaciones.')
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') return setNotifError('Permiso denegado. Actívalo desde la configuración del navegador.')
    }
    save({ browser_notifications: next })
  }

  const savedMark = (field: keyof ProfilePatch) =>
    saved === field ? (
      <span className="appear flex items-center gap-1 text-footnote font-medium text-success">
        <CheckIcon className="size-3.5" />
        Guardado
      </span>
    ) : null

  return (
    <div className="animate-stagger mx-auto flex max-w-2xl flex-col gap-8">
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
        <Row>
          <label htmlFor="username" className="shrink-0 text-body">
            Usuario
          </label>
          <span className="flex min-w-0 items-center gap-2">
            {savedMark('username')}
            {profile && (
              <NameField
                id="username"
                key={profile.username ?? ''}
                initial={profile.username ?? ''}
                placeholder="@elige_uno"
                prefix="@"
                onSave={saveUsername}
              />
            )}
          </span>
        </Row>
        <Row label="Email" detail={<span className="block max-w-[14rem] truncate sm:max-w-none">{user?.email ?? '—'}</span>} />
      </GroupedList>
      {usernameError ? (
        <p className="-mt-6 px-4 text-footnote text-danger">{usernameError}</p>
      ) : (
        <p className="-mt-6 px-4 text-footnote text-label-2">Tus amigos te encuentran por tu usuario y ven solo tu racha y tu nivel.</p>
      )}

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
        footer={`Tu meta diaria en XP sale del tiempo por sesión (≈ ${XP_PER_MINUTE} XP por minuto). Los cambios cuentan desde tu próxima actividad.`}
      >
        <SelectRow
          id="goal-minutes"
          label="Tiempo por sesión"
          value={profile?.daily_goal_minutes}
          options={MINUTE_OPTIONS}
          format={(v) => `${v} min · ${v * XP_PER_MINUTE} XP`}
          onChange={(v) => save({ daily_goal_minutes: v, daily_goal_xp: v * XP_PER_MINUTE })}
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

      <GroupedList header="Sonido" footer="Aciertos, errores y final de lección o de repaso. Se guarda en este dispositivo.">
        <Row>
          <span className="text-body">Sonidos en lecciones y repasos</span>
          <Switch
            label="Sonidos en lecciones y repasos"
            checked={soundOn}
            onChange={(next) => {
              setSoundOn(next)
              if (next) playSound('correct')
            }}
          />
        </Row>
      </GroupedList>

      <GroupedList header="Notificaciones" footer={notifError ?? 'Recibe avisos de racha en riesgo, reportes y exámenes también fuera de la app mientras la tengas abierta en el navegador.'}>
        <Row>
          <span className="text-body">Notificaciones del navegador</span>
          <Switch
            label="Notificaciones del navegador"
            checked={!!profile?.browser_notifications}
            onChange={toggleBrowserNotifications}
            disabled={!profile}
          />
        </Row>
        <Row>
          <button type="button" onClick={() => openPanel('notifications')} className="-my-2.5 flex min-h-12 w-full items-center justify-between text-left text-body">
            Ver notificaciones
            <Chevron />
          </button>
        </Row>
      </GroupedList>

      <GroupedList
        header="Correo"
        footer={`Te enviamos tu reporte semanal y un aviso si tu racha está en riesgo (entre las 19:00 y las 22:00). Llegan a ${user?.email ?? 'tu correo'}; puedes desactivarlos cuando quieras.`}
      >
        <Row>
          <span className="text-body">Recibir correos</span>
          <span className="flex items-center gap-2">
            {savedMark('email_opt_in')}
            <Switch
              label="Recibir correos"
              checked={!!profile?.email_opt_in}
              onChange={(next) => save({ email_opt_in: next })}
              disabled={!profile}
            />
          </span>
        </Row>
      </GroupedList>

      <GroupedList header="Legal">
        <Row>
          <Link to="/privacidad" className="-my-2.5 flex min-h-12 w-full items-center justify-between text-body">
            Política de privacidad
            <Chevron />
          </Link>
        </Row>
        <Row>
          <Link to="/cookies" className="-my-2.5 flex min-h-12 w-full items-center justify-between text-body">
            Política de cookies
            <Chevron />
          </Link>
        </Row>
      </GroupedList>

      <GroupedList header="Reportes semanales" footer="Cada lunes se genera el resumen de tu semana anterior.">
        {reports.isPending ? (
          <Row label="Cargando…" />
        ) : !reports.data?.length ? (
          <Row label="Aún no hay reportes" detail="El primero llega el lunes" />
        ) : (
          reports.data.map((r) => (
            <Row key={r.id}>
              <Link to={`/settings/reports/${r.id}`} className="-my-2.5 flex min-h-12 w-full items-center justify-between gap-3 text-body">
                <span>
                  {weekLabel(r.week_start, r.week_end)}
                  {r.model?.startsWith('prueba:') && <span className="ml-2 rounded-full bg-fill px-2 py-0.5 text-footnote font-medium text-label-2">Prueba</span>}
                </span>
                <span className="flex items-center gap-2 text-label-2">
                  {(r.stats as { totals?: { xp: number } })?.totals?.xp ?? 0} XP
                  <Chevron />
                </span>
              </Link>
            </Row>
          ))
        )}
      </GroupedList>

      {DEV_TOOLS && isAdmin(user?.email) && <DevPanel />}

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

function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 fill-none stroke-label-3 stroke-2">
      <path d="m7.5 4.5 5.5 5.5-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Campo alineado a la derecha (como en Ajustes de iOS). Guarda al salir o con Enter. */
function NameField({
  initial,
  onSave,
  id = 'display-name',
  placeholder,
  prefix,
}: {
  initial: string
  onSave: (value: string) => void
  id?: string
  placeholder?: string
  prefix?: string
}) {
  const [value, setValue] = useState(initial ? `${prefix ?? ''}${initial}` : '')
  const trimmed = value.trim()
  function commit() {
    const clean = prefix && trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed
    if (!clean) return setValue(initial ? `${prefix ?? ''}${initial}` : '')
    if (clean !== initial) onSave(clean.slice(0, 60))
  }
  return (
    <input
      id={id}
      value={value}
      placeholder={placeholder}
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
