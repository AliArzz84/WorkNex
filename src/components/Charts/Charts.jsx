import { motion } from 'framer-motion'
import { Icon } from '../ui/ui.jsx'

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

/* Vertical monthly columns: per month an Income column and a stacked Outgoing
   column (Expenses red + Salaries orange), with the net printed under each month. */
function CLegend({ color, label }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
    <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label}</span>
}
export function ColumnsV({ data, fmt = v => v, height = 150 }) {
  const hasExtra = data.some(d => d.extra)
  const max = Math.max(1, ...data.map(d => Math.max(d.income || 0, (d.expense || 0) + (d.salary || 0) + (d.extra || 0))))
  const h = (v) => `${Math.max(0, (v / max) * 100)}%`
  // four faint horizontal reference lines behind the columns (a "report" look)
  const ticks = [1, 0.75, 0.5, 0.25]
  return (
    <div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <CLegend color="#34c759" label="Income" />
        <CLegend color="#ff6b6b" label="Expenses" />
        <CLegend color="#ff9f0a" label="Salaries" />
        {hasExtra && <CLegend color="#a78bfa" label="Extra costs" />}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", minWidth: "100%" }}>
          {/* gridlines + the top value label, sitting behind the bars */}
          <div style={{ position: "absolute", inset: `0 0 42px 0`, pointerEvents: "none" }}>
            {ticks.map((t, i) => (
              <div key={i} style={{ position: "absolute", left: 0, right: 0, bottom: `${t * height}px`, height: 1, background: "var(--line)", opacity: t === 1 ? 0 : 1 }} />
            ))}
            <span style={{ position: "absolute", top: 0, insetInlineEnd: 0, fontSize: 10.5, color: "var(--muted)", background: "var(--panel)", padding: "0 4px" }}>{fmt(max)}</span>
          </div>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 12, minWidth: "100%", padding: "0 2px" }}>
          {data.map((d, i) => {
            const out = (d.expense || 0) + (d.salary || 0) + (d.extra || 0)
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "1 0 40px", minWidth: 40 }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, height, width: "100%" }}>
                  <div title={`Income ${fmt(d.income || 0)}`} style={{ width: 13, display: "flex", alignItems: "flex-end", height: "100%" }}>
                    <motion.div initial={{ height: 0 }} animate={{ height: h(d.income || 0) }} transition={{ duration: 0.6, delay: i * 0.03 }}
                      style={{ width: "100%", background: "#34c759", borderRadius: "4px 4px 0 0" }} />
                  </div>
                  <div title={`Outgoing ${fmt(out)}`} style={{ width: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    {(d.extra || 0) > 0 && <motion.div initial={{ height: 0 }} animate={{ height: h(d.extra || 0) }} transition={{ duration: 0.6, delay: i * 0.03 }}
                      style={{ width: "100%", background: "#a78bfa", borderRadius: "4px 4px 0 0" }} />}
                    <motion.div initial={{ height: 0 }} animate={{ height: h(d.salary || 0) }} transition={{ duration: 0.6, delay: i * 0.03 }}
                      style={{ width: "100%", background: "#ff9f0a", borderRadius: (d.extra || 0) > 0 ? 0 : "4px 4px 0 0" }} />
                    <motion.div initial={{ height: 0 }} animate={{ height: h(d.expense || 0) }} transition={{ duration: 0.6, delay: i * 0.03 }}
                      style={{ width: "100%", background: "#ff6b6b" }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{d.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: (d.net || 0) < 0 ? "var(--red-ink)" : "var(--green-ink)" }}>{fmt(d.net || 0)}</div>
              </div>
            )
          })}
        </div>
        </div>
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
