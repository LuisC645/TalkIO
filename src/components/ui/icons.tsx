// Iconos de línea (20×20, trazo 1.6) — un solo lenguaje visual (icons.md).
const base = { 'aria-hidden': true, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const FlameIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M10 17.5c3 0 5-2.1 5-5 0-3.6-3-5.4-3.6-9-1.9 1.3-2.7 3.4-2.6 5.3C7.7 8 7 6.9 6.8 5.8 5.6 7.3 5 9 5 12.5c0 2.9 2 5 5 5Z" />
  </svg>
)
export const TargetIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="10" cy="10" r="7" />
    <circle cx="10" cy="10" r="3.5" />
    <circle cx="10" cy="10" r="0.6" fill="currentColor" />
  </svg>
)
export const StarIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="m10 2.8 2.2 4.5 4.9.7-3.6 3.5.9 4.9L10 14.1l-4.4 2.3.9-4.9L2.9 8l4.9-.7L10 2.8Z" />
  </svg>
)
export const CardsIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <rect x="3" y="6" width="11" height="11" rx="2.5" />
    <path d="M6.5 3h8A2.5 2.5 0 0 1 17 5.5v8" />
  </svg>
)
export const CheckIcon = ({ className }: { className?: string }) => (
  <svg {...base} strokeWidth={2} className={className}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </svg>
)
export const ChartIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M4 16V9M8.5 16V4M13 16v-5M17 16h-14" />
  </svg>
)
export const BookIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M10 5.5C8.6 4.4 6.6 4 3.5 4v11c3.1 0 5.1.4 6.5 1.5 1.4-1.1 3.4-1.5 6.5-1.5V4c-3.1 0-5.1.4-6.5 1.5Zm0 0v11" />
  </svg>
)
export const GearIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" />
  </svg>
)
export const SignOutIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8M12.5 13.5 16 10l-3.5-3.5M16 10H8" />
  </svg>
)
export const PencilIcon = ({ className }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M12.5 4.5 15.5 7.5M4 16l.9-3.6 8.9-8.9a1.4 1.4 0 0 1 2 0l.7.7a1.4 1.4 0 0 1 0 2l-8.9 8.9L4 16Z" />
  </svg>
)
