import { motion } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { EmptyState, Icon, Money, CurrencyToggle, stagger, item } from '../../components/ui/ui.jsx'
import { colorFor } from '../../lib/data.js'
import styles from './Businesses.module.css'

export default function Businesses() {
  const { db, openEditor, removeItem, ask, toUsd } = useStore()

  const sum = (list, type) => list.filter(x => x.type === type).reduce((s, x) => s + Number(x.amount || 0), 0)
  const stats = db.businesses.map(b => {
    const staff = db.employees.filter(e => e.business === b.id)
    const salary = staff.filter(e => e.status === "active").reduce((s, e) => s + toUsd(Number(e.salary || 0), e.currency), 0)
    const projects = db.projects.filter(p => p.business === b.id).length
    const tx = db.transactions.filter(x => x.business === b.id)
    const net = sum(tx, "income") - sum(tx, "expense") - salary
    return { b, employees: staff.length, salary, projects, net }
  })

  return (
    <div>
      <div className="filters" style={{ justifyContent: "flex-end" }}>
        <CurrencyToggle />
      </div>
      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="business" size={16} /></span>
          <h2>Businesses<span className="count">{db.businesses.length}</span></h2>
          <div className="right">
            <button className="btn ghost sm add-btn" onClick={() => openEditor("business")}><Icon name="plus" size={14} /> Business</button>
          </div>
        </div>
        <p className="muted" style={{ margin: "-2px 2px 14px", fontSize: 13 }}>
          Group your employees, teams, projects and finance by business. You can pick a business when adding an employee, team, project or transaction.
        </p>
        {stats.length ? (
          <motion.div className="grid3" variants={stagger} initial="initial" animate="animate">
            {stats.map(({ b, employees, salary, projects, net }) => (
              <motion.div className="pcard" key={b.id} variants={item} whileHover={{ y: -3 }}>
                <div className="ph">
                  <div style={{ flex: 1 }}><b>{b.name}</b></div>
                  <span className="avatar" style={{ background: colorFor(b.id), width: 30, height: 30 }}><Icon name="business" size={15} /></span>
                </div>
                <div className={styles.stats}>
                  <div className={styles.stat}><Icon name="employees" size={15} /><b>{employees}</b><small>employees</small></div>
                  <div className={styles.stat}><Icon name="projects" size={15} /><b>{projects}</b><small>projects</small></div>
                </div>
                <div className={styles.netLine} style={{ border: "none", paddingTop: 0, marginBottom: 6 }}>
                  <span className="muted">Salaries / mo</span>
                  <span style={{ color: "var(--red-ink)" }}><Money value={salary} align="flex-end" /></span>
                </div>
                <div className={styles.netLine}>
                  <span className="muted">Net (after salaries)</span>
                  <span style={{ color: net < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={net} align="flex-end" /></span>
                </div>
                <div className="row-actions" style={{ marginTop: "auto" }}>
                  <button className="iconbtn" onClick={() => openEditor("business", b.id)}><Icon name="edit" size={16} /></button>
                  <button className="iconbtn del" onClick={async () => { if (await ask({ title: "Delete business", message: `Delete “${b.name}”? Employees, projects and transactions stay — they just lose their link to this business.` })) removeItem("business", b.id) }}><Icon name="trash" size={16} /></button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : <EmptyState icon="business" text="No businesses yet — add your first one with the button above" />}
      </div>
    </div>
  )
}
