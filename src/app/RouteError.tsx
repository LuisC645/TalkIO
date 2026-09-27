import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { isChunkError, isReloading, reloadOnce } from '@/lib/chunkReload'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

/**
 * Pantalla de error de rutas. Si la app se actualizó mientras estaba abierta (archivos viejos),
 * recarga para traer la versión nueva. Ante cualquier otro error, cierra la sesión en este
 * dispositivo y lleva a iniciar sesión: nunca se queda en una pantalla rota.
 */
export function RouteError() {
  const error = useRouteError()

  useEffect(() => {
    // Recarga en curso (archivos de una versión anterior): se espera a la versión nueva
    if (isReloading() || (isChunkError(error) && reloadOnce())) return
    console.error(error)
    void supabase.auth
      .signOut({ scope: 'local' })
      .catch(() => undefined)
      .finally(() => {
        queryClient.clear()
        window.location.replace('/')
      })
  }, [error])

  return <FullScreenSpinner />
}
