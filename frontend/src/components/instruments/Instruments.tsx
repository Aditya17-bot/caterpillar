import { useId } from 'react'
import Icon from '../common/Icon'

export function SpeedGauge({
  speed,
  advised,
}: {
  speed: number
  advised: number
}) {
  const max = Math.max(20, Math.ceil(Math.max(speed, advised) / 10) * 10)
  const pct = Math.min(1, Math.max(0, speed / max))
  const angle = Math.PI - Math.min(1, Math.max(0, advised / max)) * Math.PI
  const danger = speed > advised * 1.25 + 1
  return (
    <div
      className="relative w-full max-w-[350px] mx-auto"
      role="img"
      aria-label={`Speed ${speed.toFixed(1)} kilometers per hour. AI advised ${advised.toFixed(1)} kilometers per hour.`}
    >
      <svg viewBox="0 0 320 205" className="w-full" aria-hidden="true">
        <path
          d="M 30 155 A 130 130 0 0 1 290 155"
          fill="none"
          stroke="#303946"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M 30 155 A 130 130 0 0 1 290 155"
          fill="none"
          stroke={danger ? '#ffb4ab' : '#ffd21c'}
          strokeWidth="13"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${pct * 100} 100`}
          className="gauge-arc"
        />
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI - (i / 10) * Math.PI
          return (
            <line
              key={i}
              x1={160 + Math.cos(a) * 110}
              y1={155 - Math.sin(a) * 110}
              x2={160 + Math.cos(a) * 116}
              y2={155 - Math.sin(a) * 116}
              stroke="#758398"
              strokeWidth="1.5"
            />
          )
        })}
        <circle
          cx={160 + Math.cos(angle) * 130}
          cy={155 - Math.sin(angle) * 130}
          r="8"
          fill="#56e5a9"
          stroke="#111720"
          strokeWidth="3"
        />
        <text x="30" y="183" fill="#b5bfce" fontSize="11">
          0
        </text>
        <text x="290" y="183" textAnchor="end" fill="#b5bfce" fontSize="11">
          {max} km/h
        </text>
      </svg>
      <div className="absolute inset-x-0 top-[35%] text-center">
        <div
          className={`speed-number instrument-value text-[64px] leading-none font-bold ${danger ? 'text-error' : 'text-on-surface'}`}
        >
          {speed.toFixed(1)}
        </div>
        <div className="text-sm text-on-surface-variant mt-2">
          km/h · current speed
        </div>
      </div>
    </div>
  )
}
export function TiltIndicator({ slope }: { slope: number }) {
  const id = useId()
  return (
    <div className="flex flex-col min-[1700px]:flex-row items-center gap-3 text-center min-[1700px]:text-left">
      <svg
        viewBox="0 0 120 100"
        className="w-28 shrink-0"
        role="img"
        aria-label={`Machine slope ${slope.toFixed(1)} degrees`}
      >
        <defs>
          <clipPath id={id}>
            <circle cx="60" cy="50" r="42" />
          </clipPath>
        </defs>
        <circle cx="60" cy="50" r="43" fill="#111720" stroke="#455064" />
        <g clipPath={`url(#${id})`}>
          <g
            style={{
              transformOrigin: '60px 50px',
              transform: `rotate(${-slope}deg)`,
              transition: 'transform .6s ease',
            }}
          >
            <rect
              x="0"
              y="50"
              width="120"
              height="60"
              fill="#ffd21c"
              fillOpacity=".13"
            />
            <path d="M0 50H120" stroke="#ffd21c" strokeWidth="2" />
            <path
              d="M45 65H75 M50 80H70 M45 35H75 M50 20H70"
              stroke="#758398"
            />
          </g>
        </g>
        <path
          d="M17 50H42L48 56H72L78 50H103"
          fill="none"
          stroke="#e8edf5"
          strokeWidth="3"
        />
        <circle cx="60" cy="50" r="3" fill="#e8edf5" />
      </svg>
      <div>
        <div
          className={`instrument-value text-4xl font-bold ${Math.abs(slope) > 25 ? 'text-error' : ''}`}
        >
          {slope.toFixed(1)}°
        </div>
        <p className="text-xs text-on-surface-variant mt-2">
          {Math.abs(slope) > 25
            ? 'Critical tilt · reposition'
            : 'Slope · critical above ±25°'}
        </p>
      </div>
    </div>
  )
}
export function ProximityRadar({ distance }: { distance?: number }) {
  const warning = distance != null && distance < 100
  return (
    <div className="flex flex-col min-[1700px]:flex-row items-center gap-3 text-center min-[1700px]:text-left">
      <svg
        viewBox="0 0 120 100"
        className="w-28 shrink-0"
        role="img"
        aria-label="Proximity range rings. Bearing is not available."
      >
        {[42, 28, 14].map((r) => (
          <circle
            key={r}
            cx="60"
            cy="50"
            r={r}
            fill={warning ? '#ffb4ab08' : '#56e5a906'}
            stroke={warning ? '#ffb4ab' : '#455064'}
            strokeDasharray={r === 14 ? undefined : '3 4'}
          />
        ))}
        <path d="M60 8V92 M18 50H102" stroke="#455064" />
        <rect x="53" y="40" width="14" height="20" rx="3" fill="#ffd21c" />
      </svg>
      <div>
        <div
          className={`instrument-value text-4xl font-bold ${warning ? 'text-error' : ''}`}
        >
          {distance == null ? '—' : (distance / 100).toFixed(1)}
          <span className="text-lg text-on-surface-variant ml-1">m</span>
        </div>
        <p className="text-xs text-on-surface-variant mt-2">
          {distance == null
            ? 'No proximity reading'
            : warning
              ? 'Obstacle nearby · keep clear'
              : 'Nearest obstacle'}
          <br />
          Bearing unavailable
        </p>
      </div>
    </div>
  )
}
export function StatusLight({
  label,
  value,
  state,
}: {
  label: string
  value: string
  state: 'ok' | 'warn' | 'unknown'
}) {
  return (
    <div className="flex items-center gap-3 bg-surface-container-low rounded-xl border border-surface-variant p-3">
      <Icon
        name={
          state === 'ok'
            ? 'check_circle'
            : state === 'warn'
              ? 'warning'
              : 'help'
        }
        className={`text-2xl ${state === 'ok' ? 'text-tertiary' : state === 'warn' ? 'text-error' : 'text-on-surface-variant'}`}
      />
      <div>
        <p className="eyebrow text-[10px]">{label}</p>
        <p className="font-semibold text-sm mt-1">{value}</p>
      </div>
    </div>
  )
}
