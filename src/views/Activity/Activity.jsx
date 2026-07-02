import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
// type-filter buckets (pay + unpay collapse into one "Payroll" filter)
const TYPES = [["all", "All"], ["create", "Added"], ["update", "Updated"], ["delete", "Deleted"], ["pay", "Payroll"]]
const bucketOf = (a) => (a === "pay" || a === "unpay") ? "pay" : (a === "create" || a === "delete") ? a : "update"
const startOfDayTs = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }
const roleLabel = (r) => r === "manager" ? "Manager" : "Boss"
const emailInitials = (e) => {
  const local = String(e || "?").split("@")[0]
  const parts = local.split(/[._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase()
}

/* ---------- Shared view-only links (managers/boss create & revoke) ---------- */
// "tasks" now includes meetings (they're a tab inside that view)
const SHARE_SECTIONS = [
  ["dashboard", "Dashboard"], ["tasks", "Tasks & meetings"], ["projects", "Projects"],
  ["businesses", "Businesses"], ["employees", "Employees"], ["teams", "Teams"], ["payroll", "Payroll"],
  ["finance", "Finance"], ["sheets", "Tables"], ["diagram", "Diagram"], ["activity", "Activity"],
]
const SHARE_DURATIONS = [["forever", "Forever"], ["1h", "1 hour"], ["1d", "1 day"], ["7d", "7 days"], ["30d", "30 days"]]
// Activity exposes staff emails + the full change log; Tables often hold salaries/financial data —
// so flag those sensitive too
const SHARE_SENSITIVE = new Set(["payroll", "finance", "employees", "activity", "sheets"])
const expiresFromChoice = (c) => {
  if (c === "forever") return null
  const ms = { "1h": 3600e3, "1d": 86400e3, "7d": 7 * 86400e3, "30d": 30 * 86400e3 }[c]
  return new Date(Date.now() + ms).toISOString()
}
const linkUrlFor = (token) => `${window.location.origin}${window.location.pathname}?view=${token}`

function ShareLinksPanel() {
  const { createViewLink, listViewLinks, revokeViewLink, notify, timeAgo, ask } = useStore()
  const [links, setLinks] = useState([])
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [secs, setSecs] = useState(["dashboard"])
  const [dur, setDur] = useState("7d")
  const [busy, setBusy] = useState(false)

  const refresh = () => listViewLinks().then(setLinks).catch(() => {})
  useEffect(() => { refresh() }, [])

  const toggleSec = (k) => setSecs(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])
  const create = async () => {
    if (!label.trim() || secs.length === 0) { notify("Add a name and pick at least one section", "error"); return }
    setBusy(true)
    try {
      const token = await createViewLink({ label: label.trim(), sections: secs, expiresAt: expiresFromChoice(dur) })
      try { await navigator.clipboard.writeText(linkUrlFor(token)) } catch (e) {}
      notify("Link created & copied to clipboard", "success")
      setLabel(""); setSecs(["dashboard"]); setDur("7d"); setOpen(false); refresh()
    } catch (e) { notify("Couldn't create the link", "error") }
    setBusy(false)
  }
  const copy = async (token) => { try { await navigator.clipboard.writeText(linkUrlFor(token)); notify("Link copied", "success") } catch (e) {} }
  const remove = async (lk) => {
    if (await ask({ title: "Delete share link", message: `Stop “${lk.label}” from viewing? The link stops working immediately.`, confirmText: "Delete" })) {
      try { await revokeViewLink(lk.token); refresh(); notify("Link deleted", "info") } catch (e) { notify("Couldn't delete", "error") }
    }
  }
  const expiryText = (lk) => {
    if (!lk.expires_at) return "Forever"
    const t = new Date(lk.expires_at)
    return (t < new Date() ? "Expired " : "Until ") + t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <span className="hicon"><Icon name="link" size={16} /></span>
        <h2>Shared view links</h2>
        <span className="count">{links.length}</span>
        <div className="right">
          <button className="btn ghost sm" onClick={() => setOpen(o => !o)}><Icon name="plus" size={14} /> New link</button>
        </div>
      </div>

      {open && (
        <div className={styles.shareForm}>
          <input className={styles.shareInput} placeholder="Who is this for? (e.g. Investor, Accountant)" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          <div className={styles.shareSecs}>
            {SHARE_SECTIONS.map(([k, lbl]) => (
              <span key={k} className={`pill ${secs.includes(k) ? "on" : ""}`} onClick={() => toggleSec(k)}>
                {lbl}{SHARE_SENSITIVE.has(k) ? " •" : ""}
              </span>
            ))}
          </div>
          {secs.some(s => SHARE_SENSITIVE.has(s)) && (
            <div className={styles.shareWarn}><Icon name="alert" size={13} /> This link will expose salaries / financial / staff details (marked •).</div>
          )}
          <div className={styles.shareFoot}>
            <label>Access for:&nbsp;
              <select value={dur} onChange={e => setDur(e.target.value)}>
                {SHARE_DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <button className="btn" disabled={busy} onClick={create}>{busy ? "…" : "Create link"}</button>
          </div>
        </div>
      )}

      {links.length === 0
        ? <EmptyState icon="link" text="No share links yet" />
        : (
          <div className={styles.shareList}>
            {links.map(lk => (
              <div className={styles.shareRow} key={lk.token}>
                <div className={styles.shareMain}>
                  <b>{lk.label}</b>
                  <div className={styles.shareChips}>{(lk.sections || []).map(s => <span className="tag gray" key={s}>{s}</span>)}</div>
                </div>
                <div className={styles.shareRowMeta}>
                  <small>{expiryText(lk)}</small>
                  <small className="muted">{lk.last_seen ? "opened " + timeAgo(new Date(lk.last_seen).getTime()) : "not opened yet"}</small>
                </div>
                <div className="row-actions share-actions">
                  <button className="iconbtn" title="Copy link" onClick={() => copy(lk.token)}><Icon name="copy" size={16} /></button>
                  <button className="iconbtn del" title="Delete link" onClick={() => remove(lk)}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

export default function Activity() {
  const { db, presence, session, timeAgo, fmtDateTime, account, search, isGuest } = useStore()
  const [, tick] = useState(0)
  const [filter, setFilter] = useState("all")      // 'all' or a userId
  const [typeFilter, setTypeFilter] = useState("all")
  const [expand, setExpand] = useState(null)       // null | 'people' | 'online' — which stat card is opened
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 5000)  // keep "online/editing" + relative times fresh
    return () => clearInterval(t)
  }, [])

  const meId = session?.user?.id
  const now = Date.now()
  const dayLabel = (ts) => {
    const diff = Math.round((startOfDayTs(now) - startOfDayTs(ts)) / 86400000)
    if (diff <= 0) return "Today"
    if (diff === 1) return "Yesterday"
    if (diff < 7) return new Date(ts).toLocaleDateString("en-GB", { weekday: "long" })
    return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
  }

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
  // person + search filter first; the type chips then narrow this set (and show its counts)
  const base = useMemo(() => {
    let l = filter === "all" ? log : log.filter(e => e.userId === filter)
    if (q) l = l.filter(e => [e.email, e.entity, e.name, e.detail, e.action].some(v => String(v || "").toLowerCase().includes(q)))
    return l
  }, [log, filter, q])
  const typeCounts = useMemo(() => {
    const c = { all: base.length, create: 0, update: 0, delete: 0, pay: 0 }
    for (const e of base) c[bucketOf(e.action)]++
    return c
  }, [base])
  const shown = useMemo(() => typeFilter === "all" ? base : base.filter(e => bucketOf(e.action) === typeFilter), [base, typeFilter])
  // group the visible feed into day buckets (log is already newest-first)
  const grouped = useMemo(() => {
    const groups = []; let cur = null
    for (const e of shown) {
      const k = startOfDayTs(e.ts)
      if (!cur || cur.key !== k) { cur = { key: k, label: dayLabel(e.ts), items: [] }; groups.push(cur) }
      cur.items.push(e)
    }
    return groups
  }, [shown, now])
  const changesToday = useMemo(() => log.filter(e => startOfDayTs(e.ts) === startOfDayTs(now)).length, [log, now])

  return (
    <div>
      {/* at-a-glance summary — People & Online now expand to reveal who they are */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statIc}><Icon name="history" size={17} /></span>
          <div className={styles.statT}><b>{log.length}</b><small>Total changes</small></div>
        </div>
        <div className={styles.stat}>
          <span className={styles.statIc}><Icon name="trending" size={17} /></span>
          <div className={styles.statT}><b>{changesToday}</b><small>Changes today</small></div>
        </div>
        <button className={`${styles.stat} ${styles.statBtn} ${expand === "people" ? styles.statActive : ""}`}
          onClick={() => setExpand(x => x === "people" ? null : "people")} title="See who they are">
          <span className={styles.statIc}><Icon name="employees" size={17} /></span>
          <div className={styles.statT}><b>{accounts.length}</b><small>People</small></div>
          <Icon name="chevron" size={15} className={`${styles.statChev} ${expand === "people" ? styles.chevUp : ""}`} />
        </button>
        <button className={`${styles.stat} ${styles.statOnline} ${styles.statBtn} ${expand === "online" ? styles.statActive : ""}`}
          onClick={() => setExpand(x => x === "online" ? null : "online")} title="See who's online">
          <span className={styles.statIc}><Icon name="wifi" size={17} /></span>
          <div className={styles.statT}><b>{online.length}</b><small>Online now</small></div>
          <Icon name="chevron" size={15} className={`${styles.statChev} ${expand === "online" ? styles.chevUp : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expand && (
          <motion.div key={expand} className={styles.expand}
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}>
            <div className={styles.expandInner}>
              {expand === "online" ? (
                online.length === 0
                  ? <div className={styles.expandEmpty}><Icon name="employees" size={16} /> No one is connected right now</div>
                  : online.map(p => {
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
                  })
              ) : (
                accounts.length === 0
                  ? <div className={styles.expandEmpty}><Icon name="employees" size={16} /> No accounts recorded yet</div>
                  : accounts.map(a => (
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
                  ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isGuest && <ShareLinksPanel />}

      {/* Full activity log */}
      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="history" size={16} /></span>
          <h2>Activity log</h2>
          <span className="count">{log.length}</span>
        </div>

        {log.length > 0 && (
          <div className={styles.toolbar}>
            <div className={styles.toolRow}>
              <span className={styles.toolLbl}>Type</span>
              <div className={styles.chips}>
                {TYPES.map(([k, l]) => (
                  <button key={k} className={`${styles.tchip} ${typeFilter === k ? styles.ton : ""}`} onClick={() => setTypeFilter(k)}>
                    {l}<span className={styles.tcount}>{typeCounts[k] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
            {accountsInLog.length > 1 && (
              <div className={styles.toolRow}>
                <span className={styles.toolLbl}>Who</span>
                <div className={styles.chips}>
                  <button className={`${styles.tchip} ${filter === "all" ? styles.ton : ""}`} onClick={() => setFilter("all")}>Everyone</button>
                  {accountsInLog.map(a => (
                    <button key={a.userId} className={`${styles.tchip} ${filter === a.userId ? styles.ton : ""}`}
                      onClick={() => setFilter(a.userId)} title={a.email}>{String(a.email).split("@")[0]}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {shown.length === 0
          ? <EmptyState icon="history" text={(q || filter !== "all" || typeFilter !== "all") ? "No matching activity" : "No changes recorded yet"} />
          : (
            <div className={styles.feed}>
              {grouped.map(g => (
                <div className={styles.day} key={g.key}>
                  <div className={styles.dayHead}><span>{g.label}</span><i /><small>{g.items.length}</small></div>
                  <div className={styles.dayItems}>
                    {g.items.map((e, i) => {
                      const m = ACT[e.action] || ACT.update
                      const you = e.email === session?.user?.email
                      return (
                        <motion.div className={styles.event} key={e.id || (g.key + "_" + i)}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.01 }}>
                          <span className={styles.avatarWrap}>
                            <span className={styles.av} style={{ background: colorFor(e.userId) }}>{emailInitials(e.email)}</span>
                            <span className={`${styles.badge} ${styles[m.color]}`}><Icon name={m.icon} size={10} /></span>
                          </span>
                          <div className={styles.bodyc}>
                            <div className={styles.line}>
                              <b className={styles.who} title={e.email}>{String(e.email).split("@")[0]}</b>
                              <span className={styles.verb}> {m.verb} </span>
                              <span className={styles.ent}>{e.entity}</span>
                              {e.name && <b className={styles.nm}> “{e.name}”</b>}
                              {e.detail && <span className={styles.detail}> · {e.detail}</span>}
                            </div>
                            <div className={styles.sub}>{roleLabel(e.role)}{you ? " · you" : ""}</div>
                          </div>
                          <time className={styles.when} title={fmtDateTime(new Date(e.ts).toISOString())}>{timeAgo(e.ts)}</time>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
