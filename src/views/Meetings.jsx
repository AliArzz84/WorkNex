import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store.jsx'
import { Avatar, EmptyState, Icon, stagger, item } from '../ui.jsx'
import { daysBetween } from '../data.js'

export default function Meetings() {
  const { db, t, fmtDateTime, relDay, empById, search, openEditor, removeItem, toggleMeetDone, ask } = useStore()
  const rows = db.meetings
    .filter(m => JSON.stringify(m).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))

  return (
    <div className="panel">
      <div className="panel-h"><h2>{t("nav.meetings")}<span className="count">{rows.length}</span></h2></div>
      {rows.length ? (
        <motion.div variants={stagger} initial="initial" animate="animate">
          <AnimatePresence>
            {rows.map(m => {
              const dd = daysBetween(m.datetime)
              const past = dd < 0 || m.done
              const proj = m.projectId && db.projects.find(p => p.id === m.projectId)
              return (
                <motion.div key={m.id} className={`alert ${m.done ? "green" : dd <= 2 ? "blue" : "gray"}`} style={{ opacity: past ? 0.6 : 1 }} variants={item} layout exit={{ opacity: 0 }}>
                  <div className="dot" />
                  <div style={{ flex: 1 }}>
                    <b>{m.title} {m.done && <span style={{ color: "var(--green-ink)" }}>✓</span>}</b>
                    <p>{m.location} {proj ? "• " + proj.name : ""}</p>
                    <div style={{ display: "flex", marginTop: 5 }}>{m.attendees.map(id => <Avatar key={id} emp={empById(id)} />)}</div>
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <div className="when">{fmtDateTime(m.datetime)}</div>
                    <div className="when" style={{ color: dd <= 1 && dd >= 0 ? "var(--blue)" : "var(--muted)" }}>{relDay(dd)}</div>
                    <div className="row-actions" style={{ justifyContent: "flex-end", marginTop: 6 }}>
                      <button className="iconbtn" title={t("done")} onClick={() => toggleMeetDone(m.id)}><Icon name={m.done ? "undo" : "check"} size={16} /></button>
                      <button className="iconbtn" onClick={() => openEditor("meeting", m.id)}><Icon name="edit" size={16} /></button>
                      <button className="iconbtn del" onClick={async () => { if (await ask(t("confirmDel"))) removeItem("meeting", m.id) }}><Icon name="trash" size={16} /></button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      ) : <EmptyState icon="meetings" text={t("noData")} />}
    </div>
  )
}
