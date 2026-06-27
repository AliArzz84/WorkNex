import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from './lib/store.jsx'
import { fadeSlide, Icon, Logo, Clocks, RatesMenu, Presence, Reminders, ConfirmDialog, Toast } from './components/ui/ui.jsx'
import Backups from './components/Backups/Backups.jsx'
import Dashboard from './views/Dashboard/Dashboard.jsx'
import Tasks from './views/Tasks/Tasks.jsx'
import Finance from './views/Finance/Finance.jsx'
import Diagram from './views/Diagram/Diagram.jsx'
import Employees from './views/Employees/Employees.jsx'
import Businesses from './views/Businesses/Businesses.jsx'
import Projects from './views/Projects/Projects.jsx'
import Meetings from './views/Meetings/Meetings.jsx'
import Payroll from './views/Payroll/Payroll.jsx'
import Teams from './views/Teams/Teams.jsx'
import Activity from './views/Activity/Activity.jsx'
import Requests from './views/Requests/Requests.jsx'
import Editor from './components/Editor/Editor.jsx'
import Login from './components/Login/Login.jsx'
import RequestForm from './components/RequestForm/RequestForm.jsx'
import Assistant from './components/Assistant/Assistant.jsx'
import { daysBetween, nextPayday, periodKey } from './lib/data.js'

const NAV = [
  { key: "dashboard", icon: "dashboard" },
  { key: "tasks", icon: "tasks" },
  { key: "requests", icon: "chat" },
  { key: "meetings", icon: "meetings" },
  { key: "projects", icon: "projects" },
  { key: "businesses", icon: "business" },
  { key: "employees", icon: "employees" },
  { key: "teams", icon: "teams" },
  { key: "payroll", icon: "payroll" },
  { key: "finance", icon: "finance" },
  { key: "diagram", icon: "diagram" },
  { key: "activity", icon: "history" },
]
const VIEWS = { dashboard: Dashboard, businesses: Businesses, tasks: Tasks, requests: Requests, finance: Finance, diagram: Diagram, employees: Employees, projects: Projects, meetings: Meetings, payroll: Payroll, teams: Teams, activity: Activity }
const ADDABLE = { employees: "employee", projects: "project", meetings: "meeting", teams: "team", tasks: "task", finance: "transaction", businesses: "business" }
// only the views that use the *topbar* search box (Projects has its own in-section search)
const SEARCHABLE = new Set(["tasks", "employees", "meetings", "activity"])

export default function App() {
  const { db, t, L, theme, toggleTheme, role, setRole, readOnly, canPreview,
    cloud, session, account, authReady, signOut,
    isGuest, guestMeta, guestStatus, isRequest, requests,
    view, setView, search, setSearch, openEditor, exportData, importData, clearAll, isPaid } = useStore()
  const fileRef = useRef()
  const [toolsOpen, setToolsOpen] = useState(() => localStorage.getItem("bm_tools_open") !== "0")
  const toggleTools = () => setToolsOpen(o => { localStorage.setItem("bm_tools_open", o ? "0" : "1"); return !o })
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("bm_sidebar_collapsed") === "1")
  const toggleSidebar = () => setCollapsed(c => { localStorage.setItem("bm_sidebar_collapsed", c ? "0" : "1"); return !c })
  const [backupsOpen, setBackupsOpen] = useState(false)

  // Public request form (?request=1) — no login needed
  if (cloud && isRequest) return <RequestForm />

  // Guest (shared view-only link) gates — checked before auth so guests skip Login
  if (cloud && isGuest && guestStatus === "loading") return <div className="splash"><Logo size={54} /></div>
  if (cloud && isGuest && guestStatus === "invalid") return (
    <div className="splash"><div className="guest-gone">
      <Logo size={54} />
      <h2>This link isn’t available</h2>
      <p>The share link has expired or been turned off. Ask whoever sent it for a new one.</p>
    </div></div>
  )

  // Cloud auth gates (normal signed-in users)
  if (cloud && !isGuest && !authReady) return <div className="splash"><Logo size={54} /></div>
  if (cloud && !isGuest && !session) return <Login />

  // guests only see the sections their link allows
  const nav = (isGuest && guestMeta) ? NAV.filter(n => guestMeta.sections.includes(n.key)) : NAV
  const ViewComp = VIEWS[view]
  const meetBadge = db.meetings.filter(m => !m.done && daysBetween(m.datetime) >= 0 && daysBetween(m.datetime) <= 2).length
  const payBadge = db.employees.filter(e => e.status === "active").filter(e => {
    const pd = nextPayday(e); return daysBetween(pd.toISOString()) <= 7 && !isPaid(e.id, periodKey(pd))
  }).length
  const taskBadge = db.tasks.filter(k => !k.done && k.due && daysBetween(k.due) === 0).length
  const reqBadge = (requests || []).filter(r => (r.status || "new") !== "done").length
  const badges = { tasks: taskBadge, meetings: meetBadge, payroll: payBadge, requests: reqBadge }

  // Toggle only switches edit mode; it stays on the current page.
  const switchRole = (r) => setRole(r)

  return (
    <div className="app" data-role={role} data-collapsed={collapsed ? "true" : "false"}>
      <aside className="sidebar">
        <div className="brand">
          <Logo size={30} />
          <div><b>{L.appName}</b><small>{L.appSub}</small></div>
        </div>
        {nav.map(n => (
          <div key={n.key} className={`nav-item ${view === n.key ? "active" : ""}`} onClick={() => setView(n.key)} title={t("nav." + n.key)}>
            {view === n.key && <motion.div className="hl" layoutId="navHL" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="ic"><Icon name={n.icon} size={18} /></span>
            <span className="lbl">{t("nav." + n.key)}</span>
            {badges[n.key] > 0 && (
              <motion.span className="badge" key={badges[n.key]}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                {badges[n.key]}
              </motion.span>
            )}
          </div>
        ))}
        <div className="side-foot">
          <button className="btn-soft collapse-toggle" onClick={toggleSidebar} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <span style={{ display: "grid", placeItems: "center", transform: collapsed ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .2s" }}>
              <Icon name="chevron" size={16} />
            </span>
            Collapse
          </button>
          {isGuest ? (
            <div className="guest-box">
              <span className="guest-pill"><Icon name="eye" size={13} /> View only</span>
              <span className="who-guest">{guestMeta?.label}</span>
              <small>{guestMeta?.expires_at
                ? "Access until " + new Date(guestMeta.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "Access doesn’t expire"}</small>
            </div>
          ) : (<>
          {!collapsed && (<>
          <button className="btn-soft tools-toggle" onClick={toggleTools} aria-expanded={toolsOpen}>
            <Icon name="expand" size={15} />
            <span style={{ flex: 1, textAlign: "start" }}>Data</span>
            <motion.span animate={{ rotate: toolsOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: "grid", placeItems: "center" }}>
              <Icon name="chevron" size={15} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {toolsOpen && (
              <motion.div key="tools" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }} style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn-soft" onClick={exportData}><Icon name="download" size={16} /> {L.exportData}</button>
                <button className="btn-soft" onClick={() => fileRef.current.click()}><Icon name="upload" size={16} /> {L.importData}</button>
                {cloud && (
                  <button className="btn-soft" onClick={() => setBackupsOpen(true)}><Icon name="history" size={16} /> Backups</button>
                )}
                {!readOnly && (
                  <button className="btn-soft danger" onClick={clearAll}><Icon name="trash" size={16} /> {L.clearAll}</button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </>)}
          <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={e => e.target.files[0] && importData(e.target.files[0])} />
          </>)}
          {cloud && session && (
            <div className="account-box">
              <div className="who">
                <span className="email" title={session.user.email}>{session.user.email}</span>
                <span className="role-pill">{account === "manager" ? "Manager" : "Boss"}</span>
              </div>
              <button className="btn-soft" onClick={signOut}><Icon name="logout" size={16} /> Sign out</button>
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

          {isGuest && (
            <span className="guest-banner" title="You're viewing a read-only shared link">
              <Icon name="eye" size={14} /> Guest · read only
            </span>
          )}

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

          {!isGuest && <Reminders />}
          <Presence />
          <RatesMenu />
          <Clocks />
        </div>

        <AnimatePresence mode="wait">
          {/* no exit animation: with mode="wait" an exit would stall the next view on fast switches → blank section */}
          <motion.div key={view} initial={fadeSlide.initial} animate={fadeSlide.animate} transition={fadeSlide.transition}>
            <ViewComp />
          </motion.div>
        </AnimatePresence>
      </main>

      <Editor />
      <ConfirmDialog />
      <Toast />
      <Assistant />
      <Backups open={backupsOpen} onClose={() => setBackupsOpen(false)} />
    </div>
  )
}
