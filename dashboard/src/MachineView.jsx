// Live side view of the machine tilting with the terrain, plus a proximity radar.
// Plain SVG, no libraries.

export function TiltView({ slopeDeg = 0, type = "excavator", danger }) {
  const tilt = Math.max(-35, Math.min(35, slopeDeg));
  const color = Math.abs(tilt) > 25 ? "#c0392b" : Math.abs(tilt) > 15 ? "#e0a800" : "#ffcd11";
  return (
    <svg viewBox="-150 -110 300 170" className="twin">
      <g transform={`rotate(${-tilt})`}>
        <line x1="-160" y1="30" x2="160" y2="30" stroke="#8d6e63" strokeWidth="8" />
        {/* tracks */}
        <rect x="-70" y="12" width="140" height="18" rx="9" fill="#333" />
        {[...Array(6)].map((_, i) => (
          <circle key={i} cx={-55 + i * 22} cy="21" r="5" fill="#666" />
        ))}
        {/* body */}
        <rect x="-60" y="-25" width="90" height="37" rx="4" fill={color} stroke="#111" />
        <rect x="-10" y="-55" width="38" height="32" rx="3" fill={color} stroke="#111" />
        <rect x="-4" y="-50" width="26" height="18" fill="#9fd3f5" stroke="#111" />
        {type === "excavator" && (
          <>
            <line x1="25" y1="-15" x2="85" y2="-70" stroke="#111" strokeWidth="9" strokeLinecap="round" />
            <line x1="85" y1="-70" x2="115" y2="0" stroke="#111" strokeWidth="7" strokeLinecap="round" />
            <path d="M105 0 L130 0 L120 20 Z" fill="#555" />
          </>
        )}
        {type === "loader" && (
          <>
            <line x1="25" y1="-10" x2="85" y2="0" stroke="#111" strokeWidth="8" />
            <path d="M80 -15 L110 -15 L110 25 L80 20 Z" fill="#555" />
          </>
        )}
        {type === "dozer" && <path d="M30 -25 L45 -25 L55 30 L35 30 Z" fill="#555" />}
      </g>
      <text x="0" y="55" textAnchor="middle" fontSize="16" fill={danger ? "#c0392b" : "currentColor"}>
        {tilt > 0 ? "uphill" : tilt < 0 ? "downhill" : "level"} {Math.abs(tilt).toFixed(1)}°
      </text>
    </svg>
  );
}

export function Radar({ obstacleCm = 400, personNear }) {
  // rings at 0.5 m, 1 m, 2 m, 4 m; blip placed along the rear direction
  const scale = (cm) => Math.min(95, (Math.min(cm, 400) / 400) * 95);
  const r = scale(obstacleCm);
  const color = obstacleCm < 50 ? "#c0392b" : obstacleCm < 100 ? "#e0a800" : "#1e8449";
  return (
    <svg viewBox="-110 -110 220 235" className="twin">
      {[50, 100, 200, 400].map((cm) => (
        <g key={cm}>
          <circle r={scale(cm)} fill="none" stroke={cm === 100 ? "#e0a800" : cm === 50 ? "#c0392b" : "#bbb"} strokeDasharray="4 3" />
          <text x={scale(cm) + 2} y="-2" fontSize="9" fill="#888">{cm / 100} m</text>
        </g>
      ))}
      <rect x="-8" y="-12" width="16" height="24" fill="#ffcd11" stroke="#111" />
      <circle cx="0" cy={r} r="7" fill={color}>
        {obstacleCm < 100 && <animate attributeName="r" values="6;10;6" dur="0.8s" repeatCount="indefinite" />}
      </circle>
      {personNear && <text x="0" y="-98" textAnchor="middle" fontSize="12" fill="#c0392b">PERSON (camera)</text>}
      <text x="0" y="118" textAnchor="middle" fontSize="14" fill={color}>
        nearest object {(obstacleCm / 100).toFixed(2)} m
      </text>
    </svg>
  );
}
