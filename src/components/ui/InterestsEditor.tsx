import { useState } from 'react'
import { cn } from '@/lib/cn'
import { CheckIcon } from './icons'
import { MAX_INTEREST_LENGTH as MAX_LENGTH, MAX_INTERESTS, SUGGESTED_INTERESTS } from '@/lib/interests'


/**
 * Intereses del usuario: sugerencias que se activan con un toque + campo para escribir los
 * propios (Enter o "Agregar"). Las lecciones, exámenes y la escritura usan estos temas.
 */
export function InterestsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const lower = value.map((v) => v.toLowerCase())
  const full = value.length >= MAX_INTERESTS
  const custom = value.filter((v) => !SUGGESTED_INTERESTS.includes(v))

  function toggle(item: string) {
    if (lower.includes(item.toLowerCase())) onChange(value.filter((v) => v.toLowerCase() !== item.toLowerCase()))
    else if (!full) onChange([...value, item])
  }

  function addCustom() {
    const item = draft.trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH)
    if (!item || full) return
    if (!lower.includes(item.toLowerCase())) onChange([...value, item])
    setDraft('')
  }

  // Móvil: cuadrícula de 2 columnas con chips del mismo ancho (36px de alto, texto centrado);
  // desde sm: chips compactos de 32px que fluyen en línea
  const chip =
    'flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-full px-3 text-footnote font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] sm:min-h-8 sm:justify-start'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5" role="group" aria-label="Intereses sugeridos">
        {[...SUGGESTED_INTERESTS, ...custom].map((it) => {
          const on = lower.includes(it.toLowerCase())
          return (
            <button
              key={it}
              type="button"
              aria-pressed={on}
              title={it}
              disabled={!on && full}
              onClick={() => toggle(it)}
              className={cn(chip, on ? 'bg-accent text-white' : 'bg-fill text-label hover:bg-label/10 disabled:opacity-40')}
            >
              {on && <CheckIcon className="-ml-0.5 size-3 shrink-0" />}
              <span className="truncate">{it}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <label htmlFor="custom-interest" className="sr-only">
          Agregar un interés propio
        </label>
        <input
          id="custom-interest"
          value={draft}
          maxLength={MAX_LENGTH}
          disabled={full}
          placeholder={full ? `Máximo ${MAX_INTERESTS} intereses` : 'Otro interés, p. ej. cocina'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          className="h-11 min-w-0 flex-1 rounded-full border border-field-border bg-surface px-4 text-callout outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-label-2/80 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!draft.trim() || full}
          className="min-h-11 shrink-0 rounded-full bg-fill px-4 text-callout font-semibold text-label transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
      <p className="text-footnote text-label-2">
        {value.length} de {MAX_INTERESTS} · Usamos tus intereses para las oraciones de tus lecciones, exámenes e ideas para escribir.
      </p>
    </div>
  )
}
