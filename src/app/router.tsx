import { createBrowserRouter, Navigate } from 'react-router'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'
import { AuthCallbackPage } from '@/features/auth/pages/AuthCallbackPage'
import { LandingPage } from '@/features/landing/pages/LandingPage'
import { RequireAuth } from './guards/RequireAuth'
import { RequireOnboarding } from './guards/RequireOnboarding'
import { AppLayout } from './layouts/AppLayout'
import { RouteError } from './RouteError'

// Las pantallas autenticadas se cargan bajo demanda (la landing queda liviana)
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <RouteError /> },
  { path: '/login', element: <Navigate to="/" replace /> },
  // Las notificaciones ahora son un cajón (campana); la ruta antigua lleva al inicio
  { path: '/notifications', element: <Navigate to="/dashboard" replace /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  // Políticas: públicas (se enlazan desde el registro, los correos y Ajustes)
  {
    path: '/privacidad',
    errorElement: <RouteError />,
    lazy: async () => ({ Component: (await import('@/features/legal/pages/PrivacyPage')).PrivacyPage }),
  },
  {
    path: '/cookies',
    errorElement: <RouteError />,
    lazy: async () => ({ Component: (await import('@/features/legal/pages/CookiesPage')).CookiesPage }),
  },
  {
    element: <RequireAuth />,
    // Cualquier error en una pantalla interna → recarga (versión nueva) o inicio de sesión
    errorElement: <RouteError />,
    HydrateFallback: FullScreenSpinner,
    children: [
      {
        path: '/onboarding',
        lazy: async () => ({ Component: (await import('@/features/onboarding/pages/PlacementPage')).PlacementPage }),
      },
      {
        element: <RequireOnboarding />,
        children: [
          // Pantallas completas (modales): sin la navegación de la app
          {
            path: '/lessons/:lessonId',
            lazy: async () => ({ Component: (await import('@/features/lessons/pages/LessonPage')).LessonPage }),
          },
          {
            path: '/review/session',
            lazy: async () => ({ Component: (await import('@/features/review/pages/ReviewSessionPage')).ReviewSessionPage }),
          },
          {
            element: <AppLayout />,
            children: [
              {
                path: '/dashboard',
                handle: { title: 'Progreso' },
                lazy: async () => ({ Component: (await import('@/features/progress/pages/DashboardPage')).DashboardPage }),
              },
              {
                path: '/lessons',
                handle: { title: 'Lecciones' },
                lazy: async () => ({ Component: (await import('@/features/lessons/pages/LessonsPage')).LessonsPage }),
              },
              {
                path: '/review',
                handle: { title: 'Repaso' },
                lazy: async () => ({ Component: (await import('@/features/review/pages/ReviewPage')).ReviewPage }),
              },
              {
                path: '/write',
                handle: { title: 'Escribir' },
                lazy: async () => ({ Component: (await import('@/features/writing/pages/WritePage')).WritePage }),
              },
              {
                path: '/settings/reports/:reportId',
                handle: { title: 'Reporte' },
                lazy: async () => ({ Component: (await import('@/features/settings/pages/ReportPage')).ReportPage }),
              },
              {
                path: '/settings',
                handle: { title: 'Ajustes' },
                lazy: async () => ({ Component: (await import('@/features/settings/pages/SettingsPage')).SettingsPage }),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
