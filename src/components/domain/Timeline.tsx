import type { ReactNode } from 'react'
import Icon from '../common/Icon'

export interface TimelineEntry {
  id: string
  time: string
  title: string
  detail?: string
  state: 'done' | 'active' | 'upcoming'
  tag?: string
}

function StateDot({ state }: { state: TimelineEntry['state'] }) {
  if (state === 'active') {
    return (
      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container z-10 ring-4 ring-primary-container/20 shrink-0">
        <Icon name="sync" className="text-[18px] animate-spin" />
      </div>
    )
  }
  if (state === 'done') {
    return (
      <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-tertiary z-10 shrink-0">
        <Icon name="check" className="text-[18px]" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant z-10 shrink-0">
      <Icon name="schedule" className="text-[16px]" />
    </div>
  )
}

export default function Timeline({ entries, extra }: { entries: TimelineEntry[]; extra?: (e: TimelineEntry) => ReactNode }) {
  return (
    <div className="relative flex flex-col gap-space-md pl-4">
      <div className="absolute left-[31px] top-4 bottom-4 w-0.5 bg-surface-container-highest" />
      {entries.map((e) => (
        <div key={e.id} className="relative flex items-start gap-space-md">
          <StateDot state={e.state} />
          <div className={`flex-1 p-space-md rounded-xl ${e.state === 'active' ? 'bg-surface-container-high shadow-sm' : 'bg-surface-container'}`}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <span
                  className={`font-label-sm text-label-sm font-bold ${
                    e.state === 'active' ? 'text-primary' : e.state === 'done' ? 'text-tertiary' : 'text-on-surface-variant'
                  }`}
                >
                  {e.time}
                </span>
                <div className={`font-headline-md text-body-lg font-bold mt-0.5 ${e.state === 'active' ? 'text-primary' : 'text-on-surface'}`}>
                  {e.title}
                </div>
              </div>
              {e.tag && (
                <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant shrink-0">
                  {e.tag}
                </span>
              )}
            </div>
            {e.detail && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{e.detail}</p>}
            {extra?.(e)}
          </div>
        </div>
      ))}
    </div>
  )
}
