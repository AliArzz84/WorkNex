import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from './lib/store.jsx'
import { fadeSlide, Icon, Clocks, RatesMenu, Presence, ConfirmDialog, Toast } from './components/ui/ui.jsx'
import Dashboard from './views/Dashboard/Dashboard.jsx'
import Tasks from './views/Tasks/Tasks.jsx'
import Finance from './views/Finance/Finance.jsx'
import Diagram from './views/Diagram/Diagram.jsx'
import Employees from './views/Employees/Employees.jsx'
import Projects from './views/Projects/Projects.jsx'
import Meetings from './views/Meetings/Meetings.jsx'
import Payroll from './views/Payroll/Payroll.jsx'
import Teams from './views/Teams/Teams.jsx'
import Activity from './views/Activity/Activity.jsx'
import Editor from './components/Editor/Editor.jsx'
import Login from './components/Login/Login.jsx'
import { daysBetween, nextPayday, periodKey } from './lib/data.js'

const NAV = [
  { key: "dashboard", icon: "dashboard" },
  { key: "tasks", icon: "tasks" },
  { key: "meetings", icon: "meetings" },
  { key: "projects", icon: "projects" },
  { key: "employees", icon: "employees" },
  { key: "teams", icon: "teams" },
  { key: "payroll", icon: "payroll" },
  { key: "finance", icon: "finance" },
  { key: "diagram", icon: "diagram" },
  { key: "activity", icon: "history" },
]
const VIEWS = { dashboard: Dashboard, tasks: Tasks, finance: Finance, diagram: Diagram, employees: Employees, projects: Projects, meetings: Meetings, payroll: Payroll, teams: Teams, activity: Activity }
const ADDABLE = { employees: "employee", projects: "project", meetings: "meeting", teams: "team", tasks: "task", finance: "transaction" }
// only the views that use the *topbar* search box (Projects has its own in-section search)
const SEARCHABLE = new Set(["tasks", "employees", "finance", "meetings", "activity"])

export default function App() {
  const { db, t, L, theme, toggleTheme, role, setRole, readOnly, canPreview,
    cloud, session, account, authReady, signOut,
    view, setView, search, setSearch, openEditor, exportData, importData, clearAll, isPaid } = useStore()
  const fileRef = useRef()

  // Cloud auth gates
  if (cloud && !authReady) return <div className="splash"><div className="logo">M</div></div>
  if (cloud && !session) return <Login />

  const ViewComp = VIEWS[view]
  const meetBadge = db.meetings.filter(m => !m.done && daysBetween(m.datetime) >= 0 && daysBetween(m.datetime) <= 2).length
  const payBadge = db.employees.filter(e => e.status === "active").filter(e => {
    const pd = nextPayday(e); return daysBetween(pd.toISOString()) <= 7 && !isPaid(e.id, periodKey(pd))
  }).length
  const taskBadge = db.tasks.filter(k => !k.done && k.due && daysBetween(k.due) === 0).length
  const badges = { tasks: taskBadge, meetings: meetBadge, payroll: payBadge }

  // Toggle only switches edit mode; it stays on the current page.
  const switchRole = (r) => setRole(r)

  return (
    <div className="app" data-role={role}>
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">M</div>
          <div><b>{L.appName}</b><small>{L.appSub}</small></div>
        </div>
        {NAV.map(n => (
          <div key={n.key} className={`nav-item ${view === n.key ? "active" : ""}`} onClick={() => setView(n.key)}>
            {view === n.key && <motion.div className="hl" layoutId="navHL" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="ic"><Icon name={n.icon} size={18} /></span>
            <span className="lbl">{t("nav." + n.key)}</span>
            {badges[n.key] > 0 && <span className="badge">{badges[n.key]}</span>}
          </div>
        ))}
        <div className="side-foot">
          <button className="btn-soft" onClick={exportData}><Icon name="download" size={16} /> {L.exportData}</button>
          <button className="btn-soft" onClick={() => fileRef.current.click()}><Icon name="upload" size={16} /> {L.importData}</button>
          {!readOnly && (
            <button className="btn-soft danger" onClick={clearAll}><Icon name="trash" size={16} /> {L.clearAll}</button>
          )}
          <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={e => e.target.files[0] && importData(e.target.files[0])} />
          {cloud && session && (
            <div className="account-box">
              <div className="who">
                <span className="email" title={session.user.email}>{session.user.email}</span>
                <span className="role-pill">{account === "manager" ? "Manager" : "Boss"}</span>
              </div>
              <button className="btn-soft" onClick={signOut}><Icon name="undo" size={16} /> Sign out</button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>{t("titles." + view)}</h1>
            <div className="sub">{t("subs." + view)}</div>
          </div>

          {canPreview && (
            <div className="role-toggle" title="Switch between editing and what your boss sees">
              <button className={role === "manager" ? "on" : ""} onClick={() => switchRole("manager")}>{L.roleManager}</button>
              <button className={role === "boss" ? "on" : ""} onClick={() => switchRole("boss")}>{L.roleBoss}</button>
            </div>
          )}

          {["dashboard", "finance"].includes(view) && (
            <button className="btn ghost print-btn" onClick={() => window.print()}><Icon name="print" size={15} /> {L.print}</button>
          )}

          {SEARCHABLE.has(view) ? (
            <div className="search">
              <span className="si"><Icon name="search" size={15} /></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L.search2} />
            </div>
          ) : (
            <div style={{ marginInlineStart: "auto" }} />  /* keep the right-side controls pushed right */
          )}

          <motion.button className="theme-btn" onClick={toggleTheme} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.9 }} aria-label="Toggle theme" title="Toggle theme">
            <AnimatePresence initial={false}>
              <motion.span key={theme}
                initial={{ rotate: -60, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 60, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{ position: "absolute", display: "grid", placeItems: "center" }}>
                <Icon name={theme === "dark" ? "moon" : "sun"} size={18} />
              </motion.span>
            </AnimatePresence>
          </motion.button>

          {ADDABLE[view] && !readOnly && (
            <motion.button className="btn add-btn" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => openEditor(ADDABLE[view])}>
              <Icon name="plus" size={16} /> {L.add}
            </motion.button>
          )}

          <Presence />
          <RatesMenu />
          <Clocks />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={view} {...fadeSlide}>
            <ViewComp />
          </motion.div>
        </AnimatePresence>
      </main>

      <Editor />
      <ConfirmDialog />
      <Toast />
    </div>
  )
}
