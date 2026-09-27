import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { reloadOnce } from '@/lib/chunkReload'
import { watchSystemTheme } from '@/lib/surface'
import './index.css'

watchSystemTheme()

// Tras un nuevo despliegue, una pestaña abierta pide archivos que ya no existen: se recarga
// una vez para traer la versión nueva en lugar de mostrar un error
window.addEventListener('vite:preloadError', (event) => {
  const next = router.state.navigation.location
  if (reloadOnce(next ? next.pathname + next.search : undefined)) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
)
