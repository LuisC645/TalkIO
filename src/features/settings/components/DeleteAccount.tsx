import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { GroupedList, Row } from '@/components/ui/GroupedList'
import { SlideToConfirm } from '@/components/ui/SlideToConfirm'
import { invokeFunction } from '@/lib/functions'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

/**
 * Eliminar cuenta: fila roja que despliega qué se borra y un "deslizar para eliminar" como
 * segunda confirmación (acción irreversible: el gesto deliberado evita tocarlo por accidente).
 */
export function DeleteAccount() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0) // reinicia el control si falla
  const panel = useRef<HTMLDivElement>(null)

  // Al abrir, la confirmación se centra en pantalla (si no, la barra de pestañas la tapa)
  useEffect(() => {
    if (!open) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, [open])

  async function remove() {
    setLoading(true)
    setError(null)
    try {
      await invokeFunction('delete-account', { confirm: 'ELIMINAR' })
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      queryClient.clear()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta. Inténtalo de nuevo.')
      setAttempt((n) => n + 1)
      setLoading(false)
    }
  }

  return (
    <GroupedList footer={open ? undefined : 'Borra tu cuenta y todos tus datos de TalkIO.'}>
      <Row>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="-my-2.5 min-h-12 w-full text-left text-body text-danger">
            Eliminar cuenta
          </button>
        ) : (
          <div ref={panel} className="appear flex w-full scroll-mb-28 flex-col gap-4 py-2">
            <div>
              <p className="text-body font-semibold">¿Eliminar tu cuenta?</p>
              <p className="mt-1 text-footnote text-label-2">
                Se borrarán para siempre tu progreso, racha y XP, lecciones, repasos, errores, textos, reportes, amigos y notificaciones. No se puede
                deshacer.
              </p>
            </div>
            <SlideToConfirm key={attempt} label="Desliza para eliminar" onConfirm={remove} loading={loading} />
            {error && (
              <p role="alert" className="appear text-footnote font-medium text-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              disabled={loading}
              className="min-h-11 self-center rounded-full px-4 text-callout font-medium text-link hover:bg-fill disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </Row>
    </GroupedList>
  )
}
