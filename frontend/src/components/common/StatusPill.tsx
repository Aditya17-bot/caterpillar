import { tokenClasses, type ColorToken } from '../../lib/statusColors'

interface StatusPillProps {
  label: string
  token: ColorToken
  pulse?: boolean
  size?: 'sm' | 'md'
}

export default function StatusPill({ label, token, pulse, size = 'sm' }: StatusPillProps) {
  const c = tokenClasses[token]
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-space-md py-1'
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${padding} rounded ${c.bg} ${c.text} font-label-sm text-label-sm font-bold uppercase tracking-wider`}
    >
      {pulse && <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />}
      {label}
    </span>
  )
}
