import { tokenTextClass, type ColorToken } from '../../lib/statusColors'

interface SparklineProps {
  points: number[]
  token?: ColorToken
  height?: number
}

export default function Sparkline({ points, token = 'primary', height = 32 }: SparklineProps) {
  const width = 120
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const step = width / (points.length - 1)
  const path = points
    .map((p, i) => {
      const x = i * step
      const y = height - ((p - min) / range) * (height - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`w-full h-full ${tokenTextClass[token]}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
