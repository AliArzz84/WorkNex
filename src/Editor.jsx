import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from './store.jsx'

const todayISO = () => new Date().toISOString().slice(0, 10)
const nowISO = () => new Date().toISOString().slice(0, 16)

function MemberPicker({ value, onChange }) {
  const { db } = useStore()
  const toggle = (id) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  return (
    <div className="multi">
      {db.employees.map(e => (
        <span key={e.id} className={`chip ${value.includes(e.id) ? "on" : ""}`} onClick={() => toggle(e.id)}>{e.name}</span>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

export default function Editor() {
  const { editing, closeEditor, db, t, saveItem } = useStore()
  if (!editing) return null
  const { type, id } = editing

  const existing = id ? {
    employee: db.employees, project: db.projects, meeting: db.meetings, team: db.teams,
    task: db.tasks, transaction: db.transactions, business: db.businesses,
  }[type].find(x => x.id === id) : null

  const titleKey = {
    employee: id ? "editEmployee" : "newEmployee",
    project: id ? "editProject" : "newProject",
    meeting: id ? "editMeeting" : "newMeeting",
    team: id ? "editTeam" : "newTeam",
    task: id ? "Edit task" : "New task",
    transaction: id ? "Edit transaction" : "New transaction",
    business: id ? "Edit business" : "New business",
  }[type]

  return (
    <AnimatePresence>
      <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onMouseDown={e => { if (e.target === e.currentTarget) closeEditor() }}>
        <motion.div className="modal" initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
          <div className="modal-h"><h2>{t(titleKey)}</h2><button className="x" onClick={closeEditor}>✕</button></div>
          {type === "employee" && <EmployeeForm existing={existing} id={id} onSave={saveItem} close={closeEditor} />}
          {type === "project" && <ProjectForm existing={existing} id={id} onSave={saveItem} close={closeEditor} />}
          {type === "meeting" && <MeetingForm existing={existing} id={id} onSave={saveItem} close={closeEditor} />}
          {type === "team" && <TeamForm existing={existing} id={id} onSave={saveItem} close={closeEditor} />}
          {type === "task" && <TaskForm existing={existing} id={id} onSave={saveItem} close={closeEditor} />}
          {type === "transaction" && <TransactionForm existing={existing} id={id} onSave={saveItem} close={closeEditor} />}
          {type === "business" && <BusinessForm existing={existing} id={id} onSave={saveItem} close={closeEditor} />}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function Footer({ onSave, close }) {
  const { t } = useStore()
  return <div className="modal-f"><button className="btn ghost" onClick={close}>{t("cancel")}</button><button className="btn" onClick={onSave}>{t("save")}</button></div>
}

function EmployeeForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { name: "", role: "", team: db.teams[0]?.id || "", email: "", phone: "", salary: "", payDay: 1, hireDate: todayISO(), status: "active" })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = () => { if (!f.name.trim()) return; onSave("employee", { ...f, id, salary: Number(f.salary || 0), payDay: Number(f.payDay || 1) }); close() }
  return (
    <>
      <div className="modal-b">
        <Field label={t("name") + " *"}><input value={f.name} onChange={e => set("name", e.target.value)} autoFocus /></Field>
        <div className="two">
          <Field label={t("role")}><input value={f.role} onChange={e => set("role", e.target.value)} /></Field>
          <Field label={t("team")}><select value={f.team} onChange={e => set("team", e.target.value)}>{db.teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}</select></Field>
        </div>
        <div className="two">
          <Field label={t("email")}><input value={f.email} onChange={e => set("email", e.target.value)} /></Field>
          <Field label={t("phone")}><input value={f.phone} onChange={e => set("phone", e.target.value)} /></Field>
        </div>
        <div className="two">
          <Field label={`${t("salary")} (${db.currency})`}><input type="number" value={f.salary} onChange={e => set("salary", e.target.value)} /></Field>
          <Field label={t("payDay")}><input type="number" min="1" max="31" value={f.payDay} onChange={e => set("payDay", e.target.value)} /></Field>
        </div>
        <div className="two">
          <Field label={t("hireDate")}><input type="date" value={f.hireDate} onChange={e => set("hireDate", e.target.value)} /></Field>
          <Field label={t("status")}><select value={f.status} onChange={e => set("status", e.target.value)}>
            <option value="active">{t("statusActive")}</option><option value="leave">{t("statusLeave")}</option><option value="inactive">{t("statusInactive")}</option>
          </select></Field>
        </div>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function ProjectForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { name: "", client: "", status: "planning", progress: 0, startDate: todayISO(), deadline: "", budget: "", members: [], notes: "" })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = () => { if (!f.name.trim()) return; onSave("project", { ...f, id, budget: Number(f.budget || 0), progress: Number(f.progress || 0) }); close() }
  return (
    <>
      <div className="modal-b">
        <Field label={t("projName") + " *"}><input value={f.name} onChange={e => set("name", e.target.value)} autoFocus /></Field>
        <div className="two">
          <Field label={t("client")}><input value={f.client} onChange={e => set("client", e.target.value)} /></Field>
          <Field label={t("status")}><select value={f.status} onChange={e => set("status", e.target.value)}>
            <option value="planning">{t("psPlanning")}</option><option value="active">{t("psActive")}</option><option value="paused">{t("psPaused")}</option><option value="done">{t("psDone")}</option>
          </select></Field>
        </div>
        <div className="two">
          <Field label={t("startDate")}><input type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} /></Field>
          <Field label={t("deadline")}><input type="date" value={f.deadline} onChange={e => set("deadline", e.target.value)} /></Field>
        </div>
        <div className="two">
          <Field label={`${t("budget")} (${db.currency})`}><input type="number" value={f.budget} onChange={e => set("budget", e.target.value)} /></Field>
          <Field label={`${t("progress")} (%)`}><input type="number" min="0" max="100" value={f.progress} onChange={e => set("progress", e.target.value)} /></Field>
        </div>
        <Field label={t("members")}><MemberPicker value={f.members} onChange={v => set("members", v)} /></Field>
        <Field label={t("notes")}><textarea value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function MeetingForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { title: "", datetime: nowISO(), attendees: [], location: "", projectId: "", notes: "", done: false })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = () => { if (!f.title.trim()) return; onSave("meeting", { ...f, id }); close() }
  return (
    <>
      <div className="modal-b">
        <Field label={t("meetTitle") + " *"}><input value={f.title} onChange={e => set("title", e.target.value)} autoFocus /></Field>
        <div className="two">
          <Field label={t("dateTime")}><input type="datetime-local" value={f.datetime} onChange={e => set("datetime", e.target.value)} /></Field>
          <Field label={t("location")}><input value={f.location} onChange={e => set("location", e.target.value)} /></Field>
        </div>
        <Field label={t("relProject")}><select value={f.projectId} onChange={e => set("projectId", e.target.value)}>
          <option value="">{t("none")}</option>{db.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></Field>
        <Field label={t("attendees")}><MemberPicker value={f.attendees} onChange={v => set("attendees", v)} /></Field>
        <Field label={t("notes")}><textarea value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function TeamForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { name: "", lead: "" })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = () => { if (!f.name.trim()) return; onSave("team", { ...f, id }); close() }
  return (
    <>
      <div className="modal-b">
        <Field label={t("teamName") + " *"}><input value={f.name} onChange={e => set("name", e.target.value)} autoFocus /></Field>
        <Field label={t("teamLead")}><select value={f.lead} onChange={e => set("lead", e.target.value)}>
          <option value="">{t("none")}</option>{db.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function TaskForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { title: "", done: false, priority: "med", due: todayISO(), assignee: "", projectId: "", notes: "" })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = () => { if (!f.title.trim()) return; onSave("task", { ...f, id }); close() }
  return (
    <>
      <div className="modal-b">
        <Field label="Task *"><input value={f.title} onChange={e => set("title", e.target.value)} autoFocus /></Field>
        <div className="two">
          <Field label="Priority"><select value={f.priority} onChange={e => set("priority", e.target.value)}>
            <option value="high">High</option><option value="med">Medium</option><option value="low">Low</option>
          </select></Field>
          <Field label="Due date"><input type="date" value={f.due} onChange={e => set("due", e.target.value)} /></Field>
        </div>
        <div className="two">
          <Field label="Assignee"><select value={f.assignee} onChange={e => set("assignee", e.target.value)}>
            <option value="">{t("none")}</option>{db.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select></Field>
          <Field label="Related project"><select value={f.projectId} onChange={e => set("projectId", e.target.value)}>
            <option value="">{t("none")}</option>{db.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></Field>
        </div>
        <Field label={t("notes")}><textarea value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function TransactionForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { business: db.businesses[0]?.id || "", type: "income", amount: "", date: todayISO(), category: "", note: "" })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = () => { if (!f.business) return; onSave("transaction", { ...f, id, amount: Number(f.amount || 0) }); close() }
  return (
    <>
      <div className="modal-b">
        <div className="two">
          <Field label="Business *"><select value={f.business} onChange={e => set("business", e.target.value)}>
            {db.businesses.length ? db.businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>) : <option value="">Add a business first</option>}
          </select></Field>
          <Field label="Type"><select value={f.type} onChange={e => set("type", e.target.value)}>
            <option value="income">Income</option><option value="expense">Outgoing</option>
          </select></Field>
        </div>
        <div className="two">
          <Field label={`Amount (${db.currency})`}><input type="number" value={f.amount} onChange={e => set("amount", e.target.value)} autoFocus /></Field>
          <Field label="Date"><input type="date" value={f.date} onChange={e => set("date", e.target.value)} /></Field>
        </div>
        <Field label="Category"><input value={f.category} onChange={e => set("category", e.target.value)} placeholder="e.g. Salaries, Ads, Project payment" /></Field>
        <Field label="Note"><textarea value={f.note} onChange={e => set("note", e.target.value)} /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function BusinessForm({ existing, id, onSave, close }) {
  const [f, setF] = useState(existing || { name: "" })
  const submit = () => { if (!f.name.trim()) return; onSave("business", { ...f, id }); close() }
  return (
    <>
      <div className="modal-b">
        <Field label="Business name *"><input value={f.name} onChange={e => setF({ name: e.target.value })} autoFocus /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}
