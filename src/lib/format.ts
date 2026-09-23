export function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0')
  const m = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function formatMin(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  return `${m}m ${Math.floor(totalSeconds % 60)}s`
}
