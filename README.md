# TalkIO

App web personal para aprender inglés: lecciones generadas con IA según nivel y errores recurrentes, repetición espaciada (FSRS), XP, racha y reportes semanales.

**Stack:** Vite + React + TypeScript · Tailwind CSS v4 · React Router · TanStack Query (datos del servidor) + Zustand (estado de cliente) · Supabase (Auth, Postgres, Edge Functions) · Gemini vía `AIProvider` · Recharts · ts-fsrs.

## Puesta en marcha

```bash
npm install
cp .env.example .env          # completar claves
npm run db:start              # Supabase local (requiere Docker)
npm run dev
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (http://localhost:5173) |
| `npm run build` | Typecheck + build de producción |
| `npm run lint` | oxlint |
| `npm run db:reset` | Recrea la BD local aplicando `supabase/migrations` |
| `npm run db:types` | Regenera `src/types/database.types.ts` |
| `npm run seed:user` | Carga el perfil inicial desde `docs/user_seed.json` |

## Estructura

```
src/app/          router, providers, layouts, guards
src/features/     auth, onboarding, lessons, exercises, review, progress, gamification, settings
src/lib/          clientes (supabase, query), utilidades
src/stores/       zustand (solo estado de cliente)
supabase/         config, migraciones, Edge Functions (_shared/ai = capa AIProvider)
scripts/          scripts locales (seed)
docs/             seed del usuario y documentación
```
