import { useEffect, useState, useRef } from 'react'
import { motion, animate, AnimatePresence } from 'framer-motion'
import { colorFor, initials, CURRENCIES } from '../../lib/data.js'
import { useStore } from '../../lib/store.jsx'
import styles from './ui.module.css'

/* ---------- Line icons (SF-Symbols-like) ---------- */
const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.6" /><rect x="14" y="3" width="7" height="7" rx="1.6" /><rect x="14" y="14" width="7" height="7" rx="1.6" /><rect x="3" y="14" width="7" height="7" rx="1.6" /></>,
  employees: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  projects: <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" />,
  meetings: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  payroll: <><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></>,
  teams: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  undo: <><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  executive: <><path d="M3 3v18h18" /><rect x="7" y="10" width="3" height="7" rx="1" /><rect x="12" y="6" width="3" height="11" rx="1" /><rect x="17" y="13" width="3" height="4" rx="1" /></>,
  print: <><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></>,
  trending: <><path d="M22 7 13.5 15.5 8.5 10.5 2 17" /><path d="M16 7h6v6" /></>,
  tasks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6l.8.8 1.7-1.7M4.5 12l.8.8 1.7-1.7M4.5 18l.8.8 1.7-1.7" /></>,
  finance: <><rect x="2" y="6" width="20" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  diagram: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11 15.8 7M8.2 13l7.6 4" /></>,
  business: <><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M14 21V9h4a1 1 0 0 1 1 1v11" /><path d="M8 7h2M8 11h2M8 15h2" /></>,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  wallet: <><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></>,
  history: <><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></>,
  signal: <><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  expand: <><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></>,
  flow: <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8 7.7 16 16.3M6 8.4V14a4 4 0 0 0 4 4h4" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
}
export function Icon({ name, size = 18, strokeWidth = 1.7, className }) {
  const p = ICONS[name]
  if (!p) return null
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  )
}

/* ---------- World clocks (Iran + UK) ---------- */
export function Clocks() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const time = (tz) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)
  const date = (locale, tz) => new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(now)
  return (
    <div className={styles.clocks}>
      <div className={styles.clock}><span className={styles.flag}>🇮🇷</span><div className={styles.ct}><b>{time("Asia/Tehran")}</b><small>Tehran · {date("fa-IR", "Asia/Tehran")}</small></div></div>
      <div className={styles.sep} />
      <div className={styles.clock}><span className={styles.flag}>🇬🇧</span><div className={styles.ct}><b>{time("Europe/London")}</b><small>London · {date("en-GB", "Europe/London")}</small></div></div>
    </div>
  )
}

/* ---------- Money: GBP by default, small button toggles to Toman ---------- */
export function Money({ value, currency = "GBP" }) {
  const { money, fmtToman } = useStore()
  const [toman, setToman] = useState(false)
  const sym = (CURRENCIES.find(c => c.code === currency) || {}).symbol || "£"
  const isToman = currency === "IRR"
  return (
    <span className={styles.money2}>
      <span className={styles.mGbp}>{(toman && !isToman) ? fmtToman(value, currency) : money(value, currency)}</span>
      {!isToman && (
        <button className={styles.mToggle} title="Switch currency"
          onClick={(e) => { e.stopPropagation(); setToman(t => !t) }}>
          {toman ? sym : "﷼"}
        </button>
      )}
    </span>
  )
}

/* live GBP→Toman rate chip */
export function RateBadge() {
  const { fmtToman } = useStore()
  return <span className={styles.rateBadge} title="Live GBP → Toman rate">£1 ≈ {fmtToman(1)}</span>
}

/* one compact chip that expands to all live rates (Toman) */
export function RatesMenu() {
  const { currencyRates, fmtToman } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])
  const r = currencyRates || {}
  const fmt = (n) => new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n)
  const rows = [["USD", "$"], ["EUR", "€"], ["GBP", "£"], ["AED", "د.إ"], ["TRY", "₺"]].filter(([k]) => r[k])
  const teaser = r.USD ? `$ ${fmt(r.USD)}` : "Rates"
  return (
    <div className={styles.rates} ref={ref}>
      <button className={`${styles.rateBadge} ${styles.ratesTrigger}`} onClick={() => setOpen(o => !o)} title="Live currency rates">
        <Icon name="trending" size={14} />
        <span>{teaser}</span>
        <Icon name="arrow" size={12} className={`${styles.chev} ${open ? styles.up : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className={styles.ratesMenu} initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.16 }}>
            <div className={styles.rmHead}>Live prices · تومان</div>
            {rows.length ? rows.map(([code, sym]) => (
              <div className={styles.rmRow} key={code}>
                <span className={styles.rmSym}>{sym}</span>
                <span className={styles.rmCode}>{code}</span>
                <b className={styles.rmVal}>{fmt(r[code])}</b>
              </div>
            )) : <div className={styles.rmRow}><span className={styles.rmCode}>£1 ≈ {fmtToman(1)}</span></div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* live presence — shows who else is online / editing, plus a total count */
export function Presence() {
  const { presence, session, setView } = useStore()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 3000)  // refresh editing→online label
    return () => clearInterval(t)
  }, [])
  if (!session) return null
  const others = (presence || []).filter(p => p.userId !== session.user.id)
  const total = (presence || []).length || 1   // everyone connected, including me
  // when several accounts are on, keep the bar tidy — show a count + first two chips
  const shown = others.slice(0, 2)
  const extra = others.length - shown.length
  return (
    <div className={styles.presence}>
      <button className={styles.presCount} onClick={() => setView("activity")} title="Open activity & access">
        <i className={styles.dot} />{total} online
      </button>
      {shown.map(p => {
        const editing = p.editingAt && Date.now() - p.editingAt < 8000
        const roleLabel = p.role === "manager" ? "Manager" : "Boss"
        return (
          <span key={p.userId} className={`${styles.presChip} ${editing ? styles.editing : ""}`}
            title={`${p.email} is ${editing ? "editing" : "online"}`}>
            <i className={styles.dot} />
            <span className={styles.pe}>{p.email}</span>
            <small>({roleLabel}) · {editing ? "editing…" : "online"}</small>
          </span>
        )
      })}
      {extra > 0 && (
        <button className={styles.presMore} onClick={() => setView("activity")} title="See everyone">+{extra}</button>
      )}
    </div>
  )
}

/* ---------- Animated number count-up ---------- */
export function Counter({ value }) {
  const [d, setD] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: v => setD(v) })
    return () => controls.stop()
  }, [value])
  return <>{Math.round(d).toLocaleString("en-US")}</>
}

export function Avatar({ emp, cls = "" }) {
  if (!emp) return null
  return <span className={`avatar ${cls}`} style={{ background: colorFor(emp.id) }} title={emp.name}>{initials(emp.name)}</span>
}

export function Tag({ color, children }) {
  return <span className={`tag ${color}`}>{children}</span>
}

export function StatusTag({ status }) {
  const { t } = useStore()
  const map = { active: ["green", "statusActive"], leave: ["amber", "statusLeave"], inactive: ["gray", "statusInactive"] }
  const m = map[status] || map.inactive
  return <Tag color={m[0]}>{t(m[1])}</Tag>
}

export function ProjStatusTag({ status }) {
  const { t } = useStore()
  const map = { planning: ["blue", "psPlanning"], active: ["green", "psActive"], paused: ["amber", "psPaused"], done: ["gray", "psDone"] }
  const m = map[status] || map.planning
  return <Tag color={m[0]}>{t(m[1])}</Tag>
}

export function ProgressBar({ value }) {
  return (
    <div className="prog">
      <motion.i initial={{ width: 0 }} animate={{ width: value + "%" }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ display: "block", height: "100%" }} />
    </div>
  )
}

export function EmptyState({ icon = "dashboard", text }) {
  return <div className="empty"><div className="big"><Icon name={icon} size={34} strokeWidth={1.4} /></div>{text}</div>
}

/* a single "Today" agenda row — checkbox marks it done, shows its priority */
const PRI_TAG = { high: ["red", "High"], med: ["amber", "Medium"], low: ["gray", "Low"] }
export function TodayRow({ it }) {
  const { toggleMeetDone, toggleTask, setPaid, saveItem } = useStore()
  const check = () => {
    if (it.type === "meeting") toggleMeetDone(it.id)
    else if (it.type === "task") toggleTask(it.id)
    else if (it.type === "salary") setPaid(it.empId, it.period, true)
    else if (it.type === "project") saveItem("project", { id: it.id, status: "done" })
  }
  const label = it.priority && PRI_TAG[it.priority]
  return (
    <motion.div className={`alert ${it.color} today-row`} variants={item} layout exit={{ opacity: 0, x: 24 }}>
      <button className="tcheck" onClick={check} title="Mark done"><Icon name="check" size={13} /></button>
      <span className="ticon"><Icon name={it.icon} size={15} /></span>
      <div style={{ flex: 1, minWidth: 0 }}><b>{it.title}</b><p>{it.sub}</p></div>
      {label && <Tag color={label[0]}>{label[1]}</Tag>}
      <div className="when">{it.when}</div>
    </motion.div>
  )
}

/* nice confirm / prompt modal (replaces window.confirm & prompt) */
export function ConfirmDialog() {
  const { dialog, resolveDialog } = useStore()
  const [text, setText] = useState("")
  useEffect(() => { setText(dialog?.value || "") }, [dialog])
  const isPrompt = dialog?.kind === "prompt"
  const cancel = () => resolveDialog(isPrompt ? null : false)
  const ok = () => resolveDialog(isPrompt ? text : true)
  return (
    <AnimatePresence>
      {dialog && (
        <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={e => { if (e.target === e.currentTarget) cancel() }}>
          <motion.div className="modal confirm-card" initial={{ opacity: 0, scale: 0.92, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onKeyDown={e => { if (e.key === "Escape") cancel(); if (e.key === "Enter" && isPrompt) ok() }}>
            <div className="cf-body">
              {!isPrompt && (
                <div className={`cf-ic ${dialog.danger ? "danger" : ""}`}>
                  <Icon name={dialog.danger ? "trash" : "alert"} size={22} />
                </div>
              )}
              {dialog.title && <h2>{dialog.title}</h2>}
              {dialog.message && <p>{dialog.message}</p>}
              {isPrompt && (
                <input className="cf-input" autoFocus value={text} onChange={e => setText(e.target.value)} />
              )}
            </div>
            <div className="modal-f">
              <button className="btn ghost" onClick={cancel}>{dialog.cancelText}</button>
              <button className={`btn ${dialog.danger ? "danger-solid" : ""}`} onClick={ok}>{dialog.confirmText}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* small toast notification (replaces window.alert) */
export function Toast() {
  const { toast } = useStore()
  return (
    <AnimatePresence>
      {toast && (
        <motion.div className={`toast ${toast.type}`} initial={{ opacity: 0, y: 22, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}>
          <Icon name={toast.type === "error" ? "alert" : toast.type === "success" ? "check" : "bell"} size={16} />
          <span>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* animation presets */
export const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.26, ease: "easeOut" },
}
export const stagger = { animate: { transition: { staggerChildren: 0.045 } } }
export const item = {
  initial: { opacity: 0, y: 12, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 26 } },
}
