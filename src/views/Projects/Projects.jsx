import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Avatar, ProjStatusTag, ProgressBar, EmptyState, Icon, Money, CurrencyToggle, stagger, item } from '../../components/ui/ui.jsx'
import { daysBetween } from '../../lib/data.js'
import { projectNetAllTime } from '../../lib/finance.js'

// deadline urgency → a coloured badge + card accent. Skips finished projects and
// ones with no date (daysBetween("") returns 0, so the date must be checked first).
function deadlineInfo(deadline, status, dd) {
  if (!deadline || status === "done") return null
  if (dd < 0) return { color: "red", urgent: true, label: -dd === 1 ? "1 day overdue" : `${-dd} days overdue` }
  if (dd === 0) return { color: "red", urgent: true, label: "Due today" }
  if (dd <= 7) return { color: "amber", urgent: dd <= 2, label: dd === 1 ? "Due tomorrow" : `Due in ${dd} days` }
  return null
}

export default function Projects() {
  const { db, t, L, fmtDate, relDay, teamById, teamMembers, openEditor, removeItem, ask } = useStore()
  const [filter, setFilter] = useState("all")
  const [bizFilter, setBizFilter] = useState("all")
  const [q, setQ] = useState("")
  const now = new Date()

  const bizName = (id) => db.businesses.find(b => b.id === id)?.name
  const ql = q.trim().toLowerCase()
  const match = (p) => {
    if (!ql) return true
    const team = teamById(p.team)?.name || ""
    const mems = teamMembers(p.team).map(e => e.name).join(" ")
    return [p.name, p.client, p.status, p.notes, team, mems, bizName(p.business) || ""].join(" ").toLowerCase().includes(ql)
  }
  let rows = db.projects.filter(match)
  if (filter !== "all") rows = rows.filter(p => p.status === filter)
  if (bizFilter !== "all") rows = rows.filter(p => (p.business || "") === bizFilter)

  const filters = [["all", L.all], ["active", t("psActive")], ["planning", t("psPlanning")], ["paused", t("psPaused")], ["done", t("psDone")]]

  return (
    <div>
      <div className="filters">
        {db.businesses.length > 0 && (
          <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}>
            <option value="all">All businesses</option>
            {db.businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          {filters.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
        </select>
        <span style={{ marginInlineStart: "auto" }}><CurrencyToggle /></span>
        <div className="search" style={{ maxWidth: 280 }}>
          <span className="si"><Icon name="search" size={15} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects, team, people…" />
        </div>
      </div>
      <motion.div className="grid3" variants={stagger} initial="initial" animate="animate" key={filter}>
        <AnimatePresence>
          {rows.map(p => {
            const dd = daysBetween(p.deadline)
            const dl = deadlineInfo(p.deadline, p.status, dd)
            const pHasTx = db.transactions.some(x => (x.project || "") === p.id)
            const pNet = pHasTx ? projectNetAllTime(db.transactions, p.id, now) : null
            return (
              <motion.div key={p.id} className={`pcard${dl ? (dl.color === "red" ? " dl-urgent" : " dl-soon") : ""}`} variants={item} whileHover={{ y: -4 }} layout exit={{ opacity: 0, scale: 0.95 }}>
                <div className="ph">
                  <div style={{ flex: 1 }}>
                    <b>{p.name}</b><br /><small>{p.client}</small>
                    {bizName(p.business) && (
                      <div className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Icon name="business" size={11} /> {bizName(p.business)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <ProjStatusTag status={p.status} />
                    {dl && (
                      <span className={`tag ${dl.color}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <Icon name="clock" size={11} /> {dl.label}
                      </span>
                    )}
                  </div>
                </div>
                <ProgressBar value={p.progress} />
                <div className="meta"><span>{p.progress}%</span><Money value={p.budget} align="flex-end" /></div>
                {pNet !== null && (
                  <div className="meta">
                    <span className="muted" title="Income − outgoing from transactions linked to this project">Profit (linked tx)</span>
                    <span style={{ color: pNet < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={pNet} align="flex-end" /></span>
                  </div>
                )}
                <div className="meta">
                  <span>{t("deadline")}: {fmtDate(p.deadline)}</span>
                  <span style={{ color: dl ? (dl.color === "red" ? "var(--red-ink)" : "var(--amber-ink)") : "var(--muted)", fontWeight: dl ? 600 : 400 }}>
                    {p.deadline ? relDay(dd) : "—"}
                  </span>
                </div>
                <div className="meta">
                  <span className="muted">{teamById(p.team)?.name || t("noTeam")}</span>
                  <div className="members">{teamMembers(p.team).map(e => <Avatar key={e.id} emp={e} />)}</div>
                </div>
                <div className="row-actions" style={{ marginTop: "auto" }}>
                  <button className="iconbtn" onClick={() => openEditor("project", p.id)}><Icon name="edit" size={16} /></button>
                  <button className="iconbtn del" onClick={async () => { if (await ask(t("confirmDel"))) removeItem("project", p.id) }}><Icon name="trash" size={16} /></button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>
      {!rows.length && <EmptyState icon="projects" text={t("noData")} />}
    </div>
  )
}
