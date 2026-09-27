const RELOAD_KEY = 'talkio-chunk-reload'
let reloading = false

/** Hay una recarga en curso: no hacer nada más (p. ej. no cerrar la sesión) */
export const isReloading = () => reloading

/** Archivos de una versión anterior que ya no existen en el servidor (tras un nuevo despliegue) */
export function isChunkError(error: unknown) {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Failed to fetch/i.test(msg)
}

/**
 * Recarga la página una sola vez por minuto (evita bucles si el servidor sigue fallando).
 * Con `target`, carga directamente esa ruta (la pantalla a la que se estaba yendo).
 */
export function reloadOnce(target?: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // sin almacenamiento: se recarga igual (una vez por carga de página)
  }
  reloading = true
  if (target && target !== window.location.pathname + window.location.search) window.location.assign(target)
  else window.location.reload()
  return true
}
