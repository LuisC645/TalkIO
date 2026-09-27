type Props = { title: string; description?: string }

export function PagePlaceholder({ title, description }: Props) {
  return (
    <section className="space-y-2">
      <h1 className="font-display text-title-1 font-bold text-label">{title}</h1>
      {description && <p className="text-body text-label-2">{description}</p>}
    </section>
  )
}
