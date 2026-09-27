import { useLayoutEffect } from 'react'

/**
 * Color de fondo de la página completa (body) y de la interfaz del navegador (theme-color).
 * Safari pinta la zona de la Dynamic Island y la barra de la URL con estos colores: si no
 * coinciden con el fondo de la pantalla, aparecen franjas. La app usa el fondo agrupado; la
 * landing, el fondo liso.
 */
export type Surface = 'grouped' | 'plain'

/** Copia el fondo real del body a las etiquetas theme-color (tras aplicar tema o superficie). */
export function syncThemeColor() {
  requestAnimationFrame(() => {
    const color = getComputedStyle(document.body).backgroundColor
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = color
  })
}

export function setSurface(surface: Surface) {
  if (surface === 'plain') document.documentElement.dataset.surface = 'plain'
  else delete document.documentElement.dataset.surface
  syncThemeColor()
}

/** La pantalla que lo usa pone su superficie mientras está montada. */
export function useSurface(surface: Surface) {
  useLayoutEffect(() => {
    setSurface(surface)
    return () => setSurface('grouped')
  }, [surface])
}

/** Si el tema del sistema cambia con la app abierta, se vuelve a sincronizar. */
export function watchSystemTheme() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor)
  syncThemeColor()
}
