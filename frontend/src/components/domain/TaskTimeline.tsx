import type { ScheduledTask } from '../../types/domain'
import { getTaskTimePrediction } from '../../services/predictionService'
import Icon from '../common/Icon'

const minutes = (clock: string) => {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}
export default function TaskTimeline({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: ScheduledTask[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  if (!tasks.length) return null
  const start = Math.min(...tasks.map((t) => minutes(t.startTime)))
  const end = Math.max(
    ...tasks.map(
      (t) =>
        minutes(t.startTime) +
        (t.predictedHigh ?? getTaskTimePrediction(t).aiEstimateMin),
    ),
  )
  const span = Math.max(60, end - start)
  return (
    <section className="panel bg-surface-container-low rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-bold text-lg">Shift plan</h2>
        <span className="text-xs text-on-surface-variant">
          Solid: AI estimate · outline: upper estimate
        </span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => {
          const estimate =
            task.predictedMin ?? getTaskTimePrediction(task).aiEstimateMin
          const high = task.predictedHigh ?? estimate
          return (
            <button
              key={task.id}
              onClick={() => onSelect(task.id)}
              aria-pressed={task.id === selectedId}
              className={`w-full text-left rounded-xl p-3 border transition-colors ${task.id === selectedId ? 'border-primary/60 bg-primary/5' : 'border-surface-variant hover:bg-surface-container-high'}`}
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold">{task.title}</span>
                <span className="text-primary flex items-center gap-1">
                  <Icon name="auto_awesome" className="text-base" />
                  {Math.round(estimate)} min
                  {task.predictedLow != null && task.predictedHigh != null
                    ? ` · ${Math.round(task.predictedLow)}–${Math.round(task.predictedHigh)} min range`
                    : ''}
                </span>
              </div>
              <div
                className="h-3 relative rounded bg-surface-container-high my-3"
                aria-hidden="true"
              >
                <div
                  className="absolute h-full border border-primary/70 rounded"
                  style={{
                    left: `${((minutes(task.startTime) - start) / span) * 100}%`,
                    width: `${(high / span) * 100}%`,
                  }}
                />
                <div
                  className={`absolute h-full rounded ${task.status === 'completed' ? 'bg-tertiary' : 'bg-primary'}`}
                  style={{
                    left: `${((minutes(task.startTime) - start) / span) * 100}%`,
                    width: `${(estimate / span) * 100}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                <span>
                  {task.startTime} ·{' '}
                  {task.status === 'active' ? 'In progress' : task.status}
                </span>
                {task.pace && (
                  <span>
                    Live pace: {Math.round(task.pace.progressPct)}%
                    {task.pace.deltaMin != null
                      ? ` · ${task.pace.deltaMin > 0 ? '+' : ''}${Math.round(task.pace.deltaMin)} min vs estimate`
                      : ''}
                  </span>
                )}
                {task.factors?.slice(0, 2).map((f) => (
                  <span key={f.factor}>
                    {f.label} {f.deltaMin > 0 ? '+' : ''}
                    {Math.round(f.deltaMin)} min
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
