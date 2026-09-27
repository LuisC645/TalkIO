import { useState, type FormEvent, type ReactNode } from 'react'
import { FlameIcon, StarIcon } from '@/components/ui/icons'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { cn } from '@/lib/cn'
import { useAddFriend, useFriendRequests, useFriends, useRemoveFriend, useRespondRequest } from './api'

/**
 * Amigos por solicitud: agregar por @usuario envía una solicitud; quien la recibe la acepta o
 * la rechaza. Aceptada, los dos ven la racha y el nivel del otro (solo eso). Quitar un amigo
 * pide confirmación (el botón cambia a "¿Quitar?" y se confirma con un segundo toque).
 * Se usa en el panel lateral del Progreso y en el cajón que abre el botón de amigos.
 */
export function FriendsPanel({ onClose, className }: { onClose?: () => void; className?: string }) {
  const { data: profile } = useProfile()
  const friends = useFriends()
  const requests = useFriendRequests()
  const add = useAddFriend()
  const respond = useRespondRequest()
  const remove = useRemoveFriend()
  const [username, setUsername] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const incoming = requests.data?.incoming ?? []
  const outgoing = requests.data?.outgoing ?? []
  const activeCount = friends.data?.filter((f) => f.active_today).length ?? 0
  const friendCount = friends.data?.length ?? 0

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const u = username.trim().replace(/^@/, '').toLowerCase()
    if (!u) return
    add.mutate(u, { onSuccess: () => setUsername('') })
  }

  async function copyUsername() {
    if (!profile?.username) return
    try {
      await navigator.clipboard.writeText(`@${profile.username}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // sin permiso de portapapeles: el usuario puede seleccionarlo a mano
    }
  }

  const summary = [
    friendCount ? `${friendCount} ${friendCount === 1 ? 'amigo' : 'amigos'} · ${activeCount} ${activeCount === 1 ? 'activo' : 'activos'} hoy` : null,
    incoming.length ? `${incoming.length} ${incoming.length === 1 ? 'solicitud' : 'solicitudes'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <PanelHeader title="Amigos" onClose={onClose} subtitle={summary || 'Mira la racha y el nivel de tus amigos.'} />

      {/* Tu usuario: lo que compartes para que te agreguen (en PC sin botón de copiar) */}
      {profile?.username && (
        <div className="mx-5 mb-3 flex items-center gap-3 rounded-2xl bg-fill px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-footnote text-label-2">Tu usuario</span>
            <span className="block truncate text-callout font-semibold">@{profile.username}</span>
          </span>
          <button
            type="button"
            onClick={copyUsername}
            className="min-h-9 shrink-0 rounded-full px-3 text-footnote font-semibold text-link transition-[background-color,transform] duration-150 ease-out hover:bg-surface active:scale-[0.97] md:hidden"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 px-5 pb-3">
        <label htmlFor="friend-username" className="sr-only">
          Usuario de tu amigo
        </label>
        <input
          id="friend-username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (add.isSuccess || add.isError) add.reset()
          }}
          placeholder="@usuario de tu amigo"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-full border border-field-border bg-surface px-4 text-callout outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-label-2/80 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
        />
        <button
          type="submit"
          disabled={!username.trim() || add.isPending}
          className="flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-callout font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {add.isPending && <Spinner className="size-4" />}
          Agregar
        </button>
      </form>
      {add.isError && <p className="appear px-6 pb-2 text-footnote text-danger">{add.error.message}</p>}
      {add.isSuccess && (
        <p role="status" className="appear px-6 pb-2 text-footnote text-success">
          {add.data.status === 'accepted'
            ? `Ahora eres amigo de @${add.data.username}.`
            : `Solicitud enviada a @${add.data.username}. Cuando la acepte, verán la racha y el nivel del otro.`}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-separator">
        {/* Solicitudes recibidas: primero, porque piden una acción */}
        {incoming.length > 0 && (
          <Group title="Solicitudes">
            {incoming.map((r) => {
              const busy = respond.isPending && respond.variables?.requesterId === r.other_id
              return (
                <PersonRow key={r.other_id} name={r.display_name ?? r.username} detail={`@${r.username}`}>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond.mutate({ requesterId: r.other_id, accept: false })}
                      aria-label={`Rechazar a ${r.username}`}
                      className="min-h-8 rounded-full bg-fill px-3 text-footnote font-semibold text-label transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond.mutate({ requesterId: r.other_id, accept: true })}
                      aria-label={`Aceptar a ${r.username}`}
                      className="min-h-8 rounded-full bg-accent px-3 text-footnote font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
                    >
                      Aceptar
                    </button>
                  </div>
                </PersonRow>
              )
            })}
          </Group>
        )}
        {respond.isError && <p className="appear px-6 pt-2 text-footnote text-danger">{respond.error.message}</p>}

        {friends.isPending ? (
          <p className="px-5 py-8 text-center text-callout text-label-2">Cargando…</p>
        ) : !friendCount ? (
          !incoming.length && (
            <p className="px-6 py-8 text-center text-callout text-label-2">
              Aún no tienes amigos. Envía una solicitud con su @usuario; cuando la acepten, verán la racha y el nivel del otro.
            </p>
          )
        ) : (
          <Group title={incoming.length || outgoing.length ? 'Tus amigos' : undefined}>
            {friends.data!.map((f) => {
              const armed = confirm === f.friend_id
              return (
                <PersonRow
                  key={f.friend_id}
                  name={f.display_name ?? f.username}
                  detail={`@${f.username}${f.cefr && f.cefr !== '—' ? ` · ${f.cefr}` : ''}`}
                  active={f.active_today}
                >
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-footnote font-semibold tabular-nums">
                    <span className="flex items-center gap-1" aria-label={`Racha de ${f.current_streak} días`}>
                      <FlameIcon className="size-3.5 text-streak" />
                      {f.current_streak}
                    </span>
                    <span className="flex items-center gap-1 text-label-2" aria-label={`Nivel ${f.level}`}>
                      <StarIcon className="size-3.5" />
                      Nv. {f.level}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => (armed ? remove.mutate(f.friend_id) : setConfirm(f.friend_id))}
                    onBlur={() => armed && setConfirm(null)}
                    aria-label={armed ? `Confirmar quitar a ${f.username}` : `Quitar a ${f.username}`}
                    className={cn(
                      'flex min-h-8 shrink-0 items-center justify-center rounded-full text-footnote font-semibold transition-colors duration-150',
                      armed ? 'bg-danger px-3 text-white' : 'size-8 text-label-3 hover:bg-fill hover:text-label',
                    )}
                  >
                    {armed ? '¿Quitar?' : <XIcon />}
                  </button>
                </PersonRow>
              )
            })}
          </Group>
        )}

        {/* Enviadas: esperan respuesta; se pueden cancelar */}
        {outgoing.length > 0 && (
          <Group title="Enviadas">
            {outgoing.map((r) => (
              <PersonRow key={r.other_id} name={r.display_name ?? r.username} detail={`@${r.username} · Pendiente`} muted>
                <button
                  type="button"
                  onClick={() => remove.mutate(r.other_id)}
                  aria-label={`Cancelar solicitud a ${r.username}`}
                  className="min-h-8 shrink-0 rounded-full px-3 text-footnote font-semibold text-link transition-[background-color,transform] duration-150 ease-out hover:bg-fill active:scale-[0.97]"
                >
                  Cancelar
                </button>
              </PersonRow>
            ))}
          </Group>
        )}
      </div>
    </div>
  )
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h3 className="px-5 pt-3 pb-1 text-footnote font-medium text-label-2">{title}</h3>}
      <ul className={title ? 'pb-1' : 'py-1'}>{children}</ul>
    </section>
  )
}

function PersonRow({
  name,
  detail,
  active,
  muted,
  children,
}: {
  name: string | null
  detail: string
  active?: boolean
  muted?: boolean
  children: ReactNode
}) {
  return (
    <li className="group/row relative flex items-center gap-3 px-4 py-2.5">
      <span
        className={cn(
          'relative flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-callout font-semibold',
          muted && 'text-label-2',
        )}
      >
        {(name ?? '?').charAt(0).toUpperCase()}
        {active && <span aria-label="Activo hoy" className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-surface bg-success" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout font-semibold">{name}</span>
        <span className="block truncate text-footnote text-label-2">{detail}</span>
      </span>
      {children}
      <span aria-hidden className="absolute right-0 bottom-0 left-17 h-px bg-separator group-last/row:hidden" />
    </li>
  )
}

function XIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-3.5 fill-none stroke-current stroke-2">
      <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  )
}
