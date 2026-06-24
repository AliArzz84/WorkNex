import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Avatar, ProjStatusTag, ProgressBar, EmptyState, Icon, Money, stagger, item } from '../../components/ui/ui.jsx'
import { daysBetween } from '../../lib/data.js'

export default function Projects() {
  const { db, t, L, money, fmtDate, relDay, teamById, teamMembers, search, openEditor, removeItem, ask } = useStore()
  const [filter, setFilter] = useState("all")

  let rows = db.projects.filter(p => JSON.stringify(p).toLowerCase().includes(search.toLowerCase()))
  if (filter !== "all") rows = rows.filter(p => p.status === filter)

  const filters = [["all", L.all], ["active", t("psActive")], ["planning", t("psPlanning")], ["paused", t("psPaused")], ["done", t("psDone")]]

  return (
    <div>
      <div className="pill-row">
        {filters.map(([k, lbl]) => (
          <span key={k} className={`pill ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{lbl}</span>
        ))}
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
