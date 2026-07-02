import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Avatar, Tag, EmptyState, Icon, TodayRow, stagger, item } from '../../components/ui/ui.jsx'
import { daysBetween } from '../../lib/data.js'
import styles from './Tasks.module.css'

const PRI = { high: ["red", "High"], med: ["amber", "Medium"], low: ["gray", "Low"] }
const PW = { high: 0, med: 1, low: 2 }
const byPri = (a, b) => (PW[a.priority] - PW[b.priority]) || ((a.title || "").localeCompare(b.title || ""))

function TaskRow({ k }) {
  const { db, relDay, empById, openEditor, removeItem, toggleTask, ask, isGuest } = useStore()
  const [completing, setCompleting] = useState(false)
  const showDone = k.done || completing
  const dd = k.due ? daysBetween(k.due) : null
  const overdue = dd != null && dd < 0 && !showDone
  const a = empById(k.assignee)
  const proj = k.projectId && db.projects.find(p => p.id === k.projectId)
  const onCheck = () => {
    if (k.done) { toggleTask(k.id); return }        // unchecking: immediate
    setCompleting(true)                              // show the check, then remove
    setTimeout(() => toggleTask(k.id), 650)
  }
  return (
    <motion.div className={styles.taskRow} variants={item} layout
      exit={{ opacity: 0, x: 26, transition: { duration: 0.25 } }}>
      <button className={`${styles.check} ${showDone ? styles.on : ""}`} onClick={isGuest ? undefined : onCheck}
        title={isGuest ? "" : "Toggle done"} style={{ cursor: isGuest ? "default" : "pointer" }}>
        <AnimatePresence>
          {showDone && (
            <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }} style={{ display: "grid", placeItems: "center" }}>
              <Icon name="check" size={13} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <div className={styles.tMain}>
        <b className={showDone ? styles.tDone : ""}>{k.title}</b>
        <small>{a ? a.name : "Unassigned"}{proj ? " • " + proj.name : ""}{k.notes ? " • " + k.notes : ""}</small>
      </div>
      <div className={styles.tMeta}>
        {k.due && <span className={styles.due} style={{ color: overdue ? "var(--red-ink)" : "var(--muted)" }}>{relDay(dd)}</span>}
        <Tag color={PRI[k.priority]?.[0] || "gray"}>{PRI[k.priority]?.[1] || k.priority}</Tag>
        {a && <Avatar emp={a} />}
      </div>
      <div className="row-actions">
        <button className="iconbtn" onClick={() => openEditor("task", k.id)}><Icon name="edit" size={16} /></button>
        <button className="iconbtn del" onClick={async () => { if (await ask({ title: "Delete task", message: "Delete this task?" })) removeItem("task", k.id) }}><Icon name="trash" size={16} /></button>
      </div>
    </motion.div>
  )
}

function MiniTile({ date }) {
  const d = new Date(date)
  return (
    <div className={styles.miniTile}>
      <span className={styles.mm}>{d.toLocaleString("en-US", { month: "short" })}</span>
      <span className={styles.nn}>{d.getDate()}</span>
    </div>
  )
}

/* ── Meetings tab — the old standalone Meetings view, folded in here ── */
const MPRI = { high: ["red", "High"], med: ["amber", "Medium"], low: ["gray", "Low"] }
const MPW = { high: 0, med: 1, low: 2 }
function MeetingsPanel() {
  const { db, t, fmtDateTime, relDay, empById, search, openEditor, removeItem, toggleMeetDone, ask, readOnly } = useStore()
  const rows = db.meetings
    .filter(m => JSON.stringify(m).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (new Date(a.datetime) - new Date(b.datetime)) || ((MPW[a.priority] ?? 1) - (MPW[b.priority] ?? 1)))

  return (
    <div className="panel">
      <div className="panel-h">
        <h2>{t("nav.meetings")}<span className="count">{rows.length}</span></h2>
        {!readOnly && (
          <div className="right">
            <button className="btn ghost sm add-btn" onClick={() => openEditor("meeting")}><Icon name="plus" size={14} /> Meeting</button>
          </div>
        )}
      </div>
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
                    <b style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {m.title}
                      {m.priority && <Tag color={MPRI[m.priority]?.[0] || "gray"}>{MPRI[m.priority]?.[1]}</Tag>}
                      {m.done && <span style={{ color: "var(--green-ink)" }}>✓</span>}
                    </b>
                    <p>{m.location} {proj ? "• " + proj.name : ""}</p>
                    <div style={{ display: "flex", marginTop: 5 }}>{(m.attendees || []).map(id => <Avatar key={id} emp={empById(id)} />)}</div>
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

export default function Tasks() {
  const { db, fmtDate, relDay, fmtTime, search, todayExtras } = useStore()
  const [filter, setFilter] = useState("todo")

  const match = (k) => JSON.stringify(k).toLowerCase().includes(search.toLowerCase())
  const todo = db.tasks.filter(k => !k.done && match(k))
  const doneList = db.tasks.filter(k => k.done && match(k)).sort((a, b) => new Date(b.due || 0) - new Date(a.due || 0))

  const overdue = todo.filter(k => k.due && daysBetween(k.due) < 0).sort(byPri)
  const today = todo.filter(k => k.due && daysBetween(k.due) === 0).sort(byPri)
  const noDate = todo.filter(k => !k.due).sort(byPri)
  const future = todo.filter(k => k.due && daysBetween(k.due) > 0)
  // upcoming meetings + project deadlines surface here too, grouped with tasks by date
  const inSearch = (o) => JSON.stringify(o).toLowerCase().includes((search || "").toLowerCase())
  const upMeet = db.meetings
    .filter(m => !m.done && m.datetime && daysBetween(m.datetime) > 0 && inSearch(m))
    .map(m => ({ key: "m" + m.id, type: "meeting", id: m.id, color: "blue", icon: "meetings",
      title: m.title, sub: "Meeting" + (m.location ? " • " + m.location : ""), when: fmtTime(m.datetime), date: m.datetime.slice(0, 10) }))
  const upProj = db.projects
    .filter(p => p.status !== "done" && p.deadline && daysBetween(p.deadline) > 0 && inSearch(p))
    .map(p => ({ key: "d" + p.id, type: "project", id: p.id, color: "red", icon: "projects",
      title: p.name, sub: "Project deadline" + (p.client ? " • " + p.client : ""), when: "Deadline", date: p.deadline }))

  // group everything upcoming by date → { tasks, extras }
  const groups = {}
  const ensure = (date) => (groups[date] ||= { tasks: [], extras: [] })
  future.forEach(k => ensure(k.due).tasks.push(k))
  upMeet.forEach(m => ensure(m.date).extras.push(m))
  upProj.forEach(p => ensure(p.date).extras.push(p))
  const futureDates = Object.keys(groups).sort()
  const upcomingCount = future.length + upMeet.length + upProj.length

  // meeting count for the tab pill (all meetings, not just upcoming ones)
  const meetCount = db.meetings.filter(m => JSON.stringify(m).toLowerCase().includes(search.toLowerCase())).length

  const pills = [["todo", `To do (${todo.length})`], ["done", `Done (${doneList.length})`], ["meetings", `Meetings (${meetCount})`]]

  return (
    <div>
      <div className="pill-row">
        {pills.map(([k, lbl]) => (
          <span key={k} className={`pill ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{lbl}</span>
        ))}
      </div>

      {filter === "meetings" ? (
        <MeetingsPanel />
      ) : filter === "done" ? (
        <div className="panel">
          <div className="panel-h"><span className="hicon"><Icon name="check" size={16} /></span><h2>Completed</h2><span className="count">{doneList.length}</span></div>
          {doneList.length ? (
            <motion.div variants={stagger} initial="initial" animate="animate">
              <AnimatePresence>{doneList.map(k => <TaskRow key={k.id} k={k} />)}</AnimatePresence>
            </motion.div>
          ) : <EmptyState icon="check" text="Nothing completed yet" />}
        </div>
      ) : (
        <>
          {/* OVERDUE */}
          {overdue.length > 0 && (
            <div className="panel">
              <div className="panel-h danger"><span className="hicon"><Icon name="alert" size={16} /></span><h2>Overdue</h2><span className="count">{overdue.length}</span></div>
              <motion.div variants={stagger} initial="initial" animate="animate">
                <AnimatePresence>{overdue.map(k => <TaskRow key={k.id} k={k} />)}</AnimatePresence>
              </motion.div>
            </div>
          )}

          {/* TODAY — meetings, salaries, project deadlines, and tasks due today (all checkable) */}
          <div className="panel today">
            <div className="panel-h accent"><span className="hicon"><Icon name="clock" size={16} /></span><h2>Today</h2><span className="count">{todayExtras.length}</span></div>
            {todayExtras.length ? (
              <motion.div variants={stagger} initial="initial" animate="animate">
                <AnimatePresence>{todayExtras.map(it => <TodayRow key={it.key} it={it} />)}</AnimatePresence>
              </motion.div>
            ) : <div className="empty" style={{ padding: "22px 10px" }}>Nothing scheduled for today 🎉</div>}
          </div>

          {/* UPCOMING — tasks + meetings + project deadlines, grouped by day */}
          {futureDates.length > 0 && (
            <div className="panel">
              <div className="panel-h"><span className="hicon"><Icon name="meetings" size={16} /></span><h2>Upcoming</h2><span className="count">{upcomingCount}</span></div>
              {futureDates.map(date => {
                const g = groups[date]
                const n = g.tasks.length + g.extras.length
                return (
                  <div className={styles.taskGroup} key={date}>
                    <div className={styles.taskGroupH}>
                      <MiniTile date={date} />
                      <span>{relDay(daysBetween(date))} · {fmtDate(date)}</span>
                      <span className={styles.gcount}>{n} item{n > 1 ? "s" : ""}</span>
                    </div>
                    <motion.div variants={stagger} initial="initial" animate="animate">
                      <AnimatePresence>
                        {g.extras.map(it => <TodayRow key={it.key} it={it} />)}
                        {g.tasks.sort(byPri).map(k => <TaskRow key={k.id} k={k} />)}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                )
              })}
            </div>
          )}

          {/* NO DUE DATE */}
          {noDate.length > 0 && (
            <div className="panel">
              <div className="panel-h"><h2 className="muted" style={{ fontWeight: 600 }}>No due date</h2><span className="count">{noDate.length}</span></div>
              <motion.div variants={stagger} initial="initial" animate="animate">
                <AnimatePresence>{noDate.map(k => <TaskRow key={k.id} k={k} />)}</AnimatePresence>
              </motion.div>
            </div>
          )}

        </>
      )}
    </div>
  )
}
