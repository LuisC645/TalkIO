import type { ReactNode } from 'react'

/** **negritas** dentro de una línea */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-label">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

/**
 * Markdown mínimo para los reportes (### títulos, **negritas**, listas con "- ", párrafos).
 * Se renderiza como elementos de React: nada de HTML crudo.
 */
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-1 pl-5 marker:text-label-3">
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    )
    list = []
  }
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('- ') || line.startsWith('* ')) {
      list.push(line.slice(2))
      continue
    }
    flush()
    if (!line) continue
    if (line.startsWith('#')) {
      blocks.push(
        <h3 key={blocks.length} className="font-display text-title-2 font-bold tracking-[-0.015em] text-label">
          {inline(line.replace(/^#+\s*/, ''))}
        </h3>,
      )
    } else {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>)
    }
  }
  flush()
  return <div className="flex flex-col gap-3 text-body leading-[1.6] text-label-2">{blocks}</div>
}
