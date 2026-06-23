import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store.jsx'
import { Avatar, EmptyState, Icon, stagger, item } from '../ui.jsx'

export default function Teams() {
  const { db, t, L, lang, empById, openEditor, removeItem } = useStore()
  return (
    <motion.div className="grid3" variants={stagger} initial="initial" animate="animate">
      <AnimatePresence>
        {db.teams.map(tm => {
          const members = db.employees.filter(e => e.team === tm.id)
          const projs = db.projects.filter(p => p.members.some(id => members.find(m => m.id === id)))
          const lead = empById(tm.lead)
          return (
            <motion.div key={tm.id} className="pcard" variants={item} whileHover={{ y: -4 }} layout exit={{ opacity: 0, scale: 0.95 }}>
              <div className="ph">
                <div style={{ flex: 1 }}>
                  <b>{tm.name}</b><br />
                  <small>{lead ? (lang === "fa" ? "سرپرست: " : "Lead: ") + lead.name : L.none}</small>
                </div>
              </div>
              <div className="members">{members.length ? members.map(e => <Avatar key={e.id} emp={e} />) : <small className="muted">{L.none}</small>}</div>
              <div className="meta"><span>{members.length} {L.membersCount}</span><span>{projs.length} {L.projectsCount}</span></div>
              <div className="row-actions" style={{ marginTop: "auto" }}>
                <button className="iconbtn" onClick={() => openEditor("team", tm.id)}><Icon name="edit" size={16} /></button>
                <button className="iconbtn del" onClick={() => confirm(t("confirmDel")) && removeItem("team", tm.id)}><Icon name="trash" size={16} /></button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      {!db.teams.length && <EmptyState icon="teams" text={t("noData")} />}
    </motion.div>
  )
}
