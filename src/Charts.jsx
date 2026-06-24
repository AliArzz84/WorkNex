import { motion } from 'framer-motion'
import { Icon } from './ui.jsx'

/* Donut chart with legend */
export function Donut({ data, size = 150, thickness = 18, centerLabel, centerSub, centerIcon, centerColor = "var(--txt)", fmt = v => v }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  let acc = 0
  const segs = data.filter(d => d.value > 0).map((d, i) => {
    const len = (d.value / total) * circ
    const seg = { ...d, len, offset: -acc }
    acc += len
    return seg
  })
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <motion.svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          initial={{ opacity: 0, rotate: -12 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={thickness} />
            {segs.map((s, i) => (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={s.color} strokeWidth={thickness}
                strokeDasharray={`${s.len} ${circ - s.len}`} strokeDashoffset={s.offset} />
            ))}
          </g>
          {centerLabel != null && <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 24, fontWeight: 700, fill: "var(--txt)" }}>{centerLabel}</text>}
          {centerSub && !centerIcon && <text x="50%" y="63%" textAnchor="middle" style={{ fontSize: 11, fill: "var(--muted)" }}>{centerSub}</text>}
        </motion.svg>
        {centerIcon && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ color: centerColor, display: "grid", placeItems: "center" }}><Icon name={centerIcon} size={24} /></span>
              {centerSub && <small style={{ fontSize: 11, color: "var(--muted)" }}>{centerSub}</small>}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 120 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flex: "0 0 auto" }} />
            <span style={{ color: "var(--muted)" }}>{d.label}</span>
            <b style={{ marginInlineStart: "auto" }}>{fmt(d.value)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Horizontal bars */
export function BarsH({ data, fmt = v => v }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flex: "0 0 auto" }} />{d.label}
            </span>
            <b className="money">{fmt(d.value)}</b>
          </div>
          <div className="prog" style={{ minWidth: 0, height: 8 }}>
            <motion.span initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.05 }}
              style={{ display: "block", height: "100%", background: d.color, borderRadius: 20 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* Budget vs spent row */
export function BudgetBar({ budget, spent, color }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  return (
    <div className="prog" style={{ minWidth: 0, height: 8 }}>
      <motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
        style={{ display: "block", height: "100%", background: color, borderRadius: 20 }} />
    </div>
  )
}
