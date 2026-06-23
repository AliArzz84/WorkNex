import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store.jsx'
import { Counter, Tag, EmptyState, Icon, Money, stagger, item } from '../ui.jsx'
import { Donut } from '../Charts.jsx'
import { colorFor } from '../data.js'

export default function Finance() {
  const { db, money, fmtDate, search, openEditor, removeItem } = useStore()
  const [biz, setBiz] = useState("all")

  const txAll = db.transactions
  const sum = (list, type) => list.filter(x => x.type === type).reduce((s, x) => s + Number(x.amount || 0), 0)
  const bizName = (id) => db.businesses.find(b => b.id === id)?.name || "—"

  const totalIncome = sum(txAll, "income")
  const totalExpense = sum(txAll, "expense")
  const net = totalIncome - totalExpense

  // per-business summary
  const perBiz = db.businesses.map(b => {
    const list = txAll.filter(x => x.business === b.id)
    const income = sum(list, "income"); const expense = sum(list, "expense")
    return { b, income, expense, net: income - expense }
  })

  const incomeDonut = perBiz.filter(x => x.income > 0).map(x => ({ label: x.b.name, value: x.income, color: colorFor(x.b.id) }))
  const expenseDonut = perBiz.filter(x => x.expense > 0).map(x => ({ label: x.b.name, value: x.expense, color: colorFor(x.b.id) }))

  // transactions table (filtered)
  let rows = txAll.filter(x => JSON.stringify({ ...x, name: bizName(x.business) }).toLowerCase().includes(search.toLowerCase()))
  if (biz !== "all") rows = rows.filter(x => x.business === biz)
  rows = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div>
      <motion.div className="kpis" variants={stagger} initial="initial" animate="animate">
        <motion.div className="kpi k2" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="arrowUp" size={20} /></div>
          <h3 style={{ fontSize: 19 }}><Money value={totalIncome} /></h3><p>Total income</p>
        </motion.div>
        <motion.div className="kpi k4" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="arrowDown" size={20} /></div>
          <h3 style={{ fontSize: 19 }}><Money value={totalExpense} /></h3><p>Total outgoing</p>
        </motion.div>
        <motion.div className="kpi k1" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="finance" size={20} /></div>
          <h3 style={{ fontSize: 19, color: net < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={net} /></h3><p>Net profit</p>
        </motion.div>
        <motion.div className="kpi k3" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="business" size={20} /></div>
          <h3><Counter value={db.businesses.length} /></h3><p>Businesses</p>
        </motion.div>
      </motion.div>

      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="business" size={16} /></span><h2>By business</h2>
          <div className="right">
            <button className="btn ghost sm add-btn" onClick={() => openEditor("business")}><Icon name="plus" size={14} /> Business</button>
          </div>
        </div>
        {perBiz.length ? (
          <motion.div className="grid3" variants={stagger} initial="initial" animate="animate">
            {perBiz.map(({ b, income, expense, net }) => (
              <motion.div className="pcard" key={b.id} variants={item} whileHover={{ y: -3 }}>
                <div className="ph">
                  <div style={{ flex: 1 }}><b>{b.name}</b></div>
                  <span className="avatar" style={{ background: colorFor(b.id), width: 26, height: 26 }}><Icon name="business" size={14} /></span>
                </div>
                <div className="fin-line"><span className="muted">Income</span><span style={{ color: "var(--green-ink)" }}><Money value={income} align="flex-end" /></span></div>
                <div className="fin-line"><span className="muted">Outgoing</span><span style={{ color: "var(--red-ink)" }}><Money value={expense} align="flex-end" /></span></div>
                <div className="fin-line" style={{ borderTop: "1px dashed var(--line-strong)", paddingTop: 8 }}>
                  <span>Net</span><span style={{ color: net < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={net} align="flex-end" /></span>
                </div>
                <div className="row-actions" style={{ marginTop: "auto" }}>
                  <button className="iconbtn" onClick={() => openEditor("business", b.id)}><Icon name="edit" size={16} /></button>
                  <button className="iconbtn del" onClick={() => confirm("Delete this business?") && removeItem("business", b.id)}><Icon name="trash" size={16} /></button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : <EmptyState icon="business" text="No businesses yet — add one" />}
      </div>

      {(incomeDonut.length > 0 || expenseDonut.length > 0) && (
        <div className="grid2">
          <div className="panel">
            <div className="panel-h"><span className="hicon"><Icon name="arrowUp" size={16} /></span><h2>Income by business</h2></div>
            {incomeDonut.length ? <Donut data={incomeDonut} fmt={money} centerSub="income" /> : <p className="muted">No income yet</p>}
          </div>
          <div className="panel">
            <div className="panel-h"><span className="hicon"><Icon name="arrowDown" size={16} /></span><h2>Outgoing by business</h2></div>
            {expenseDonut.length ? <Donut data={expenseDonut} fmt={money} centerSub="outgoing" /> : <p className="muted">No outgoing yet</p>}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><span className="hicon"><Icon name="finance" size={16} /></span><h2>Transactions</h2><span className="count">{rows.length}</span></div>
        <div className="pill-row">
          <span className={`pill ${biz === "all" ? "on" : ""}`} onClick={() => setBiz("all")}>All</span>
          {db.businesses.map(b => <span key={b.id} className={`pill ${biz === b.id ? "on" : ""}`} onClick={() => setBiz(b.id)}>{b.name}</span>)}
        </div>
        <table>
          <thead><tr><th>Date</th><th>Business</th><th>Category</th><th>Type</th><th className="right">Amount</th><th></th></tr></thead>
          <tbody>
            <AnimatePresence>
              {rows.map(x => (
                <motion.tr key={x.id} variants={item} initial="initial" animate="animate" exit={{ opacity: 0 }} layout>
                  <td>{fmtDate(x.date)}</td>
                  <td>{bizName(x.business)}</td>
                  <td>{x.category}{x.note ? <small className="muted"> • {x.note}</small> : ""}</td>
                  <td>{x.type === "income" ? <Tag color="green"><Icon name="arrowUp" size={11} /> Income</Tag> : <Tag color="red"><Icon name="arrowDown" size={11} /> Outgoing</Tag>}</td>
                  <td className="right" style={{ color: x.type === "income" ? "var(--green-ink)" : "var(--red-ink)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                      <span>{x.type === "income" ? "+" : "−"}</span><Money value={x.amount} align="flex-end" />
                    </span>
                  </td>
                  <td className="right">
                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="iconbtn" onClick={() => openEditor("transaction", x.id)}><Icon name="edit" size={16} /></button>
                      <button className="iconbtn del" onClick={() => confirm("Delete this?") && removeItem("transaction", x.id)}><Icon name="trash" size={16} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {!rows.length && <EmptyState icon="finance" text="No transactions" />}
      </div>
    </div>
  )
}
