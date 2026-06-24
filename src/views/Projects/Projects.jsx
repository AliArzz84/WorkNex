import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Avatar, ProjStatusTag, ProgressBar, EmptyState, Icon, Money, stagger, item } from '../../components/ui/ui.jsx'
import { daysBetween } from '../../lib/data.js'

export default function Projects() {
  const { db, t, L, money, fmtDate, relDay, teamById, teamMembers, openEditor, removeItem, ask } = useStore()
  const [filter, setFilter] = useState("all")
  const [q, setQ] = useState("")

  const ql = q.trim().toLowerCase()
  const match = (p) => {
    if (!ql) return true
    const team = teamById(p.team)?.name || ""
    const mems = teamMembers(p.team).map(e => e.name).join(" ")
    return [p.name, p.client, p.status, p.notes, team, mems].join(" ").toLowerCase().includes(ql)
  }
  let rows = db.projects.filter(match)
  if (filter !== "all") rows = rows.filter(p => p.status === filter)

  const filters = [["all", L.all], ["active", t("psActive")], ["planning", t("psPlanning")], ["paused", t("psPaused")], ["done", t("psDone")]]

  return (
    <div>
      <div className="pill-row">
        {filters.map(([k, lbl]) => (
          <span key={k} className={`pill ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{lbl}</span>
        ))}
        <div className="search" style={{ maxWidth: 300 }}>
          <span className="si"><Icon name="search" size={15} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects, team, people…" />
        </div>
      </div>
      <motion.div className="grid3" variants={stagger} initial="initial" animate="animate" key={filter}>
        <AnimatePresence>
          {rows.map(p => {
            const dd = daysBetween(p.deadline)
            return (
              <motion.div key={p.id} className="pcard" variants={item} whileHover={{ y: -4 }} layout exit={{ opacity: 0, scale: 0.95 }}>
                <div className="ph">
                  <div style={{ flex: 1 }}><b>{p.name}</b><br /><small>{p.client}</small></div>
                  <ProjStatusTag status={p.status} />
                </div>
                <ProgressBar value={p.progress} />
                <div className="meta"><span>{p.progress}%</span><Money value={p.budget} align="flex-end" /></div>
                <div className="meta">
                  <span>{t("deadline")}: {fmtDate(p.deadline)}</span>
                  <span style={{ color: dd < 0 ? "var(--red-ink)" : "var(--muted)" }}>{relDay(dd)}</span>
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
