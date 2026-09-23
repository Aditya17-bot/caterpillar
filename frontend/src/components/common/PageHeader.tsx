import type { ReactNode } from 'react'

export default function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading">
    <div>{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h1>{title}</h1><p className="text-on-surface-variant mt-2 max-w-2xl">{description}</p></div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
}
