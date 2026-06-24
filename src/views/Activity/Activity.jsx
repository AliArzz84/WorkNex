import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Icon, EmptyState } from '../../components/ui/ui.jsx'
import { colorFor } from '../../lib/data.js'
import styles from './Activity.module.css'

const ACT = {
  create: { icon: "plus", color: "green", verb: "added" },
  update: { icon: "edit", color: "blue", verb: "updated" },
  delete: { icon: "trash", color: "red", verb: "deleted" },
  pay: { icon: "wallet", color: "green", verb: "paid" },
  unpay: { icon: "wallet", color: "amber", verb: "reverted payment for" },
}
const roleLabel = (r) => r === "manager" ? "Manager" : "Boss"
const emailInitials = (e) => {
  const local = String(e || "?").split("@")[0]
  const parts = local.split(/[._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase()
}

export default function Activity() {
  const { db, presence, session, timeAgo, fmtDateTime, account, search } = useStore()
  const [, tick] = useState(0)
  const [filter, setFilter] = useState("all")  // 'all' or a userId
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 5000)  // keep "online/editing" + relative times fresh
    return () => clearInterval(t)
  }, [])

  const meId = session?.user?.id
  const now = Date.now()

  // who is connected right now (presence includes me)
  const online = useMemo(() => (presence || []).slice().sort((a, b) => (b.editingAt || 0) - (a.editingAt || 0)), [presence])
  const onlineIds = useMemo(() => new Set(online.map(p => p.userId)), [online])

  // every account we've ever seen, overlaid with live presence
  const accounts = useMemo(() => {
    const map = new Map()
    for (const [userId, s] of Object.entries(db.seen || {})) {
      map.set(userId, { userId, email: s.email, role: s.role, lastSeen: s.lastSeen })
    }
    for (const p of online) {
      const cur = map.get(p.userId) || { userId: p.userId }
      map.set(p.userId, { ...cur, email: p.email || cur.email, role: p.role || cur.role })
    }
    return [...map.values()].map(a => ({ ...a, online: onlineIds.has(a.userId) }))
      .sort((a, b) => (b.online - a.online) || ((b.lastSeen || 0) - (a.lastSeen || 0)))
  }, [db.seen, online, onlineIds])

  const log = db.activity || []
  const accountsInLog = useMemo(() => {
    const seen = new Map()
    for (const e of log) if (!seen.has(e.userId)) seen.set(e.userId, e.email)
    return [...seen.entries()].map(([userId, email]) => ({ userId, email }))
  }, [log])
  const q = (search || "").trim().toLowerCase()
  const shown = useMemo(() => {
    let l = filter === "all" ? log : log.filter(e => e.userId === filter)
    if (q) l = l.filter(e => [e.email, e.entity, e.name, e.detail, e.action].some(v => String(v || "").toLowerCase().includes(q)))
    return l
  }, [log, filter, q])

  return (
    <div>
      <div className="grid2">
        {/* Online right now */}
        <div className="panel">
          <div className="panel-h">
            <span className="hicon"><Icon name="signal" size={16} /></span>
            <h2>Online now</h2>
            <span className="count">{online.length}</span>
          </div>
          {online.length === 0 && <EmptyState icon="employees" text="No one is connected" />}
          {online.map(p => {
            const editing = p.editingAt && now - p.editingAt < 8000
            return (
              <div className={styles.onRow} key={p.userId}>
                <span className={`${styles.dot} ${editing ? styles.busy : ""}`} />
                <span className={styles.email} title={p.email}>
                  {p.email}{p.userId === meId && <small className={styles.you}> (you)</small>}
                </span>
                <span className={styles.role}>{roleLabel(p.role)}</span>
                <span className={`${styles.state} ${editing ? styles.editing : ""}`}>{editing ? "editing…" : "online"}</span>
              </div>
            )
          })}
        </div>

        {/* Known accounts + last seen */}
        <div className="panel">
          <div className="panel-h">
            <span className="hicon"><Icon name="employees" size={16} /></span>
            <h2>Accounts</h2>
            <span className="count">{accounts.length}</span>
          </div>
          {accounts.length === 0 && <EmptyState icon="employees" text="No accounts recorded yet" />}
          {accounts.map(a => (
            <div className={styles.accRow} key={a.userId}>
              <span className="avatar" style={{ background: colorFor(a.userId) }}>{emailInitials(a.email)}</span>
              <div className={styles.accMain}>
                <b title={a.email}>{a.email || "Unknown"}</b>
                <small>{roleLabel(a.role)}</small>
              </div>
              {a.online
                ? <span className="tag green">online now</span>
                : <span className={styles.seen} title={a.lastSeen ? fmtDateTime(new Date(a.lastSeen).toISOString()) : ""}>{a.lastSeen ? timeAgo(a.lastSeen) : "—"}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Full activity log */}
      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="history" size={16} /></span>
          <h2>Activity log</h2>
          <span className="count">{log.length}</span>
          <div className="right">
            <div className={styles.filter}>
              <button className={`${styles.fchip} ${filter === "all" ? styles.fon : ""}`} onClick={() => setFilter("all")}>All</button>
              {accountsInLog.map(a => (
                <button key={a.userId} className={`${styles.fchip} ${filter === a.userId ? styles.fon : ""}`}
                  onClick={() => setFilter(a.userId)} title={a.email}>{String(a.email).split("@")[0]}</button>
              ))}
            </div>
          </div>
        </div>

        {shown.length === 0
          ? <EmptyState icon="history" text={(q || filter !== "all") ? "No matching activity" : "No changes recorded yet"} />
          : (
            <div className={styles.feed}>
              {shown.map((e, i) => {
                const m = ACT[e.action] || ACT.update
                return (
                  <motion.div className={styles.row} key={e.id || i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i, 12) * 0.012 }}>
                    <span className={`${styles.ic} ${styles[m.color]}`}><Icon name={m.icon} size={13} /></span>
                    <div className={styles.bodyc}>
                      <div className={styles.line}>
                        <b className={styles.who} title={e.email}>{String(e.email).split("@")[0]}</b>
                        <span className={styles.verb}> {m.verb} </span>
                        <span className={styles.ent}>{e.entity}</span>
                        {e.name && <b className={styles.nm}> “{e.name}”</b>}
                        {e.detail && <span className={styles.detail}> · {e.detail}</span>}
                      </div>
                      <div className={styles.sub}>{roleLabel(e.role)}{e.email === session?.user?.email ? " · you" : ""}</div>
                    </div>
                    <time className={styles.when} title={fmtDateTime(new Date(e.ts).toISOString())}>{timeAgo(e.ts)}</time>
                  </motion.div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
