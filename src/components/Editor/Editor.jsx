import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { CURRENCIES } from '../../lib/data.js'
import { Icon, Avatar } from '../ui/ui.jsx'
import styles from './Editor.module.css'

const pad = n => String(n).padStart(2, "0")
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const nowISO = () => { const d = new Date(); return `${todayISO()}T${pad(d.getHours())}:${pad(d.getMinutes())}` }

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

/* small searchable list to pick team members (with an inline "lead" toggle) */
function MemberList({ value, onChange, lead, onLead }) {
  const { db } = useStore()
  const [q, setQ] = useState("")
  const sel = value || []
  const toggle = (id) => onChange(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  const ql = q.trim().toLowerCase()
  const list = db.employees.filter(e => !ql || e.name.toLowerCase().includes(ql) || (e.role || "").toLowerCase().includes(ql))
  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <Icon name="search" size={14} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people…" />
        {sel.length > 0 && <span className={styles.count}>{sel.length}</span>}
      </div>
      <div className={styles.list}>
        {list.length === 0
          ? <div className={styles.empty}>{db.employees.length ? "No one matches" : "Add employees first"}</div>
          : list.map(e => {
            const on = sel.includes(e.id)
            return (
              <div key={e.id} className={`${styles.row} ${on ? styles.on : ""}`} onClick={() => toggle(e.id)}>
                <span className={styles.check}>{on && <Icon name="check" size={12} />}</span>
                <Avatar emp={e} />
                <div className={styles.main}><b>{e.name}</b><small>{e.role || "—"}</small></div>
                {on && lead !== undefined && (
                  <button type="button" className={`${styles.leadBtn} ${lead === e.id ? styles.leadOn : ""}`}
                    onClick={(ev) => { ev.stopPropagation(); onLead(lead === e.id ? "" : e.id) }}
                    title="Set as team lead">
                    {lead === e.id ? "★ Lead" : "Set lead"}
                  </button>
                )}
              </div>
            )
          })}
      </div>
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
  const [f, setF] = useState(existing || { name: "", role: "", country: "", email: "", phone: "", salary: "", currency: "GBP", payDay: 1, hireDate: todayISO(), status: "active", notes: "" })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = () => { if (!f.name.trim()) return; onSave("employee", { ...f, id, salary: Number(f.salary || 0), payDay: Number(f.payDay || 1) }); close() }
  const curSym = (CURRENCIES.find(c => c.code === (f.currency || "GBP")) || {}).symbol || "£"
  return (
    <>
      <div className="modal-b">
        <Field label={t("name") + " *"}><input value={f.name} onChange={e => set("name", e.target.value)} autoFocus /></Field>
        <div className="two">
          <Field label={t("role")}><input value={f.role} onChange={e => set("role", e.target.value)} /></Field>
          <Field label={t("country")}><input value={f.country || ""} onChange={e => set("country", e.target.value)} placeholder="e.g. Iran" /></Field>
        </div>
        <div className="two">
          <Field label={t("email")}><input value={f.email} onChange={e => set("email", e.target.value)} /></Field>
          <Field label={t("phone")}><input value={f.phone} onChange={e => set("phone", e.target.value)} /></Field>
        </div>
        <div className="two">
          <Field label={`${t("salary")} (${curSym})`}><input type="number" value={f.salary} onChange={e => set("salary", e.target.value)} /></Field>
          <Field label="Paid in"><select value={f.currency || "GBP"} onChange={e => set("currency", e.target.value)}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select></Field>
        </div>
        <div className="two">
          <Field label={t("payDay")}><input type="number" min="1" max="31" value={f.payDay} onChange={e => set("payDay", e.target.value)} /></Field>
          <Field label={t("status")}><select value={f.status} onChange={e => set("status", e.target.value)}>
            <option value="active">{t("statusActive")}</option><option value="leave">{t("statusLeave")}</option><option value="inactive">{t("statusInactive")}</option>
          </select></Field>
        </div>
        <Field label={t("hireDate")}><input type="date" value={f.hireDate} onChange={e => set("hireDate", e.target.value)} /></Field>
        <Field label={t("notes")}><textarea value={f.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="Any extra info about this employee…" /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function ProjectForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { name: "", client: "", status: "planning", progress: 0, startDate: todayISO(), deadline: "", budget: "", team: "", notes: "" })
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
        <Field label={t("team")}><select value={f.team || ""} onChange={e => set("team", e.target.value)}>
          <option value="">{t("noTeam")}</option>{db.teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </select></Field>
        <Field label={t("notes")}><textarea value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function MeetingForm({ existing, id, onSave, close }) {
  const { t, db } = useStore()
  const [f, setF] = useState(existing || { title: "", datetime: nowISO(), priority: "med", attendees: [], location: "", projectId: "", notes: "", done: false })
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
        <div className="two">
          <Field label="Priority"><select value={f.priority || "med"} onChange={e => set("priority", e.target.value)}>
            <option value="high">High</option><option value="med">Medium</option><option value="low">Low</option>
          </select></Field>
          <Field label={t("relProject")}><select value={f.projectId} onChange={e => set("projectId", e.target.value)}>
            <option value="">{t("none")}</option>{db.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></Field>
        </div>
        <Field label={t("attendees")}><MemberPicker value={f.attendees} onChange={v => set("attendees", v)} /></Field>
        <Field label={t("notes")}><textarea value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
      </div>
      <Footer onSave={submit} close={close} />
    </>
  )
}

function TeamForm({ existing, id, onSave, close }) {
  const { t } = useStore()
  const [f, setF] = useState(existing || { name: "", country: "", lead: "", members: [] })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  // keep the lead valid: it must stay one of the chosen members
  const setMembers = (v) => setF(s => ({ ...s, members: v, lead: v.includes(s.lead) ? s.lead : "" }))
  const submit = () => { if (!f.name.trim()) return; onSave("team", { ...f, id, members: f.members || [] }); close() }
  const members = f.members || []
  return (
    <>
      <div className="modal-b">
        <div className="two">
          <Field label={t("teamName") + " *"}><input value={f.name} onChange={e => set("name", e.target.value)} autoFocus /></Field>
          <Field label={t("basedIn")}><input value={f.country || ""} onChange={e => set("country", e.target.value)} placeholder="e.g. United Kingdom" /></Field>
        </div>
        <Field label={`${t("members")} (${members.length})`}>
          <MemberList value={members} onChange={setMembers} lead={f.lead} onLead={(v) => set("lead", v)} />
        </Field>
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
