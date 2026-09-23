import Icon from './Icon'

export default function EmptyState({
  title,
  description,
  icon = 'inbox',
}: {
  title: string
  description: string
  icon?: string
}) {
  return (
    <div className="empty-state" role="status">
      <Icon name={icon} className="text-3xl text-primary" />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}
export function Skeleton({
  label = 'Loading live readings',
}: {
  label?: string
}) {
  return (
    <div className="panel p-6" role="status" aria-label={label}>
      <p className="text-on-surface-variant mb-4">{label}…</p>
      <div className="skeleton h-8 w-2/3 mb-4" />
      <div className="skeleton h-24" />
    </div>
  )
}
