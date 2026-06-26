import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Tag, EmptyState, Icon, Money, stagger, item } from '../../components/ui/ui.jsx'
import { Donut, BarsH, ColumnsV } from '../../components/Charts/Charts.jsx'
import {
  isSalaryCategory, periodWindow, windowMonths, txOccurrences, expandAll,
  monthlyRunRate, periodSalaryCost, salaryForMonth, monthLabel, monthIndexOf,
} from '../../lib/finance.js'
import styles from './Finance.module.css'

// income slices render in green tones, outgoing in red tones (each business a distinct shade)
const GREENS = ["#34c759", "#30a14e", "#5dd37a", "#1f9d57", "#0a8f43"]
const REDS = ["#ff6b6b", "#fb5454", "#e0352b", "#ff8a8a", "#c62f27"]
const CAT_COLORS = ["#6c8cff", "#9b6cff", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#22d3ee", "#fb923c", "#a78bfa", "#f87171", "#2dd4bf", "#facc15"]

const PERIODS = [["all", "All time"], ["month", "This month"], ["quarter", "This quarter"], ["year", "This year"], ["custom", "Custom"]]

export default function Finance() {
  const { db, money, fmtDate, search, openEditor, removeItem, ask, toGbp } = useStore()
  const [biz, setBiz] = useState("all")
  const [period, setPeriod] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [preview, setPreview] = useState(null)   // template id whose recurring expansion is shown

  const allView = biz === "all"
  const bizId = allView ? null : biz
  const now = new Date()

  const bizName = (id) => db.businesses.find(b => b.id === id)?.name || "—"
  const projName = (id) => db.projects.find(p => p.id === id)?.name || ""
  const sum = (list, type, exclSalary) => list
    .filter(x => x.type === type && (!exclSalary || !isSalaryCategory(x.category)))
    .reduce((s, x) => s + Number(x.amount || 0), 0)

  // 1) business scope first, then 2) period window
  const scopeTx = allView ? db.transactions : db.transactions.filter(x => x.business === biz)
  const win = periodWindow(period, { from, to }, now, scopeTx)
  const months = windowMonths(win)
  const dispEnd = period === "all" ? now : win.endDate   // don't show the +50y sentinel for All time

  // expanded occurrences within the window — drive every aggregate
  const occ = expandAll(scopeTx, win, now)

  // canonical period figures (single source of truth for reconciliation)
  const periodIncome = sum(occ, "income")
  const periodExpense = sum(occ, "expense", true)                       // manual expenses, excl reserved "Salaries"
  const periodSalary = periodSalaryCost(db.employees, toGbp, win, bizId)
  const periodOutgoing = periodExpense + periodSalary
  const periodNet = periodIncome - periodOutgoing
  const runRate = monthlyRunRate(db.employees, toGbp, bizId)

  // --- F3: spending by category (expenses excl Salaries) + synthetic Salaries line
  const catMap = new Map()
  for (const o of occ) {
    if (o.type !== "expense" || isSalaryCategory(o.category)) continue
    const key = (String(o.category || "").trim().toLowerCase()) || "uncategorised"
    const disp = (String(o.category || "").trim()) || "Uncategorised"
    const cur = catMap.get(key) || { label: disp, value: 0 }
    cur.value += Number(o.amount || 0)
    catMap.set(key, cur)
  }
  const expenseCats = [...catMap.values()].sort((a, b) => b.value - a.value)
  const catChart = [...expenseCats]
  if (periodSalary > 0) catChart.push({ label: "Salaries (from active staff)", value: periodSalary })
  const catChartColored = catChart.map((r, i) => ({ ...r, color: CAT_COLORS[i % CAT_COLORS.length] }))

  // --- F2: monthly trend (last <=12 months of the window)
  const trendLo = Math.max(win.startIdx, win.endIdx - 11)
  const incByM = {}, expByM = {}
  for (const o of occ) {
    const mi = monthIndexOf(o.date); if (mi == null) continue
    if (o.type === "income") incByM[mi] = (incByM[mi] || 0) + Number(o.amount || 0)
    else if (!isSalaryCategory(o.category)) expByM[mi] = (expByM[mi] || 0) + Number(o.amount || 0)
  }
  const trend = []
  for (let idx = trendLo; idx <= win.endIdx; idx++) {
    const inc = incByM[idx] || 0
    const exp = expByM[idx] || 0
    const sal = salaryForMonth(db.employees, toGbp, idx, bizId)
    trend.push({ label: monthLabel(idx), income: inc, expense: exp, salary: sal, net: inc - exp - sal })
  }
  const trendHasData = trend.some(m => m.income || m.expense || m.salary)

  // --- F10: profit by project (income - expense excl Salaries); salaries stay company-level
  const projMap = new Map()
  for (const o of occ) {
    if (isSalaryCategory(o.category)) continue
    const key = o.project || ""
    const row = projMap.get(key) || { key, label: key ? (projName(key) || "Project") : "Unallocated", income: 0, expense: 0 }
    const amt = Number(o.amount || 0)
    if (o.type === "income") row.income += amt; else row.expense += amt
    projMap.set(key, row)
  }
  const projRows = [...projMap.values()].map(r => ({ ...r, net: r.income - r.expense })).sort((a, b) => b.net - a.net)

  // --- per-business summary for the donuts (over the window)
  const perBiz = db.businesses.map((b, i) => {
    const list = occ.filter(o => o.business === b.id)
    const income = sum(list, "income")
    const expense = sum(list, "expense", true)
    const salary = periodSalaryCost(db.employees, toGbp, win, b.id)
    return { b, income, expense, salary, incomeColor: GREENS[i % GREENS.length], outColor: REDS[i % REDS.length] }
  })
  const cards = allView ? perBiz : perBiz.filter(x => x.b.id === biz)
  const incomeDonut = cards.filter(x => x.income > 0).map(x => ({ label: x.b.name, value: x.income, color: x.incomeColor }))
  const expenseDonut = cards.filter(x => (x.expense + x.salary) > 0).map(x => ({ label: x.b.name, value: x.expense + x.salary, color: x.outColor }))

  // --- transactions table: ONE row per template (recurring collapsed to a badge)
  const tableRows = scopeTx
    .map(tx => ({ tx, occ: txOccurrences(tx, win, now) }))
    .filter(r => r.occ.length > 0)
    .filter(r => JSON.stringify({ ...r.tx, name: bizName(r.tx.business), pr: projName(r.tx.project) }).toLowerCase().includes((search || "").toLowerCase()))
    .sort((a, b) => new Date(b.occ[b.occ.length - 1].date) - new Date(a.occ[a.occ.length - 1].date))

  // dev-only reconciliation check (no production UI)
  if (import.meta.env.DEV) {
    const catSum = catChartColored.reduce((s, r) => s + r.value, 0)
    console.assert(Math.abs(catSum - periodOutgoing) < 0.01, "[finance] category breakdown != periodOutgoing", catSum, periodOutgoing)
    const projSum = projRows.reduce((s, r) => s + r.net, 0) - periodSalary
    console.assert(Math.abs(projSum - periodNet) < 0.01, "[finance] project profit + salaries != periodNet", projSum, periodNet)
  }

  const periodLabel = PERIODS.find(p => p[0] === period)?.[1] || "All time"
  const showBanner = period !== "all" || !allView

  // --- F8: CSV export of expanded occurrences + reconciling totals footer
  const exportCSV = () => {
    const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const rows = [...occ].sort((a, b) =>
      bizName(a.business).localeCompare(bizName(b.business)) || a.date.localeCompare(b.date) || String(a.category || "").localeCompare(String(b.category || "")))
    const lines = [["Date", "Business", "Category", "Type", "Amount(GBP)", "Project", "Source", "Note"].join(",")]
    for (const o of rows) {
      lines.push([o.date, bizName(o.business), o.category || "", o.type === "income" ? "Income" : "Outgoing",
        Number(o.amount || 0).toFixed(2), o.project ? projName(o.project) : "", o._source || "Manual", o.note || ""].map(esc).join(","))
    }
    lines.push("")
    lines.push(["Total Income", periodIncome.toFixed(2)].map(esc).join(","))
    lines.push(["Total Expense (incl. salaries)", periodOutgoing.toFixed(2)].map(esc).join(","))
    lines.push(["Period Salary Cost", periodSalary.toFixed(2)].map(esc).join(","))
    lines.push(["Net Profit", periodNet.toFixed(2)].map(esc).join(","))
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `finance-${period}${allView ? "" : "-" + bizName(biz)}-${now.toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div>
      {/* period + custom range + CSV */}
      <div className="pill-row">
        {PERIODS.map(([k, l]) => <span key={k} className={`pill ${period === k ? "on" : ""}`} onClick={() => setPeriod(k)}>{l}</span>)}
        {period === "custom" && (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "4px 8px" }} />
            <span className="muted">→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "4px 8px" }} />
          </span>
        )}
        <button className="btn ghost sm" style={{ marginInlineStart: "auto" }} onClick={exportCSV}><Icon name="download" size={14} /> CSV</button>
      </div>

      {/* business scope */}
      {db.businesses.length > 0 && (
        <div className="pill-row">
          <span className={`pill ${allView ? "on" : ""}`} onClick={() => setBiz("all")}>All businesses</span>
          {db.businesses.map(b => <span key={b.id} className={`pill ${biz === b.id ? "on" : ""}`} onClick={() => setBiz(b.id)}>{b.name}</span>)}
        </div>
      )}

      {showBanner && (
        <div className="muted" style={{ fontSize: 12.5, margin: "0 2px 12px" }}>
          Showing <b>{periodLabel}</b> · {fmtDate(win.startDate)} – {fmtDate(dispEnd)}
          {!allView && <> · Business: <b>{bizName(biz)}</b></>}
        </div>
      )}

      <motion.div className="kpis" variants={stagger} initial="initial" animate="animate">
        <motion.div className="kpi k2" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="arrowUp" size={20} /></div>
          <h3 style={{ fontSize: 19 }}><Money value={periodIncome} /></h3><p>Total income</p>
        </motion.div>
        <motion.div className="kpi k4" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="arrowDown" size={20} /></div>
          <h3 style={{ fontSize: 19 }}><Money value={periodOutgoing} /></h3><p>Total outgoing</p>
        </motion.div>
        <motion.div className="kpi k1" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="finance" size={20} /></div>
          <h3 style={{ fontSize: 19, color: periodNet < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={periodNet} /></h3><p>Net profit</p>
        </motion.div>
        <motion.div className="kpi k3" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="wallet" size={20} /></div>
          <h3 style={{ fontSize: 19 }}><Money value={periodSalary} /></h3><p>Salaries (period total)</p>
          <small style={{ color: "var(--muted)", fontSize: 11 }}>≈ {money(Math.round(runRate))}/mo · {months} mo</small>
        </motion.div>
      </motion.div>

      {/* F2: monthly trend */}
      <div className="panel">
        <div className="panel-h"><span className="hicon"><Icon name="finance" size={16} /></span><h2>Monthly trend</h2></div>
        {trendHasData ? <ColumnsV data={trend} fmt={money} /> : <p className="muted">No activity in this period yet</p>}
      </div>

      <div className="grid2">
        {/* F3: spending by category */}
        <div className="panel">
          <div className="panel-h"><span className="hicon"><Icon name="arrowDown" size={16} /></span><h2>Spending by category</h2></div>
          {catChartColored.length ? <BarsH data={catChartColored} fmt={money} /> : <p className="muted">No outgoing yet</p>}
        </div>
        {/* F10: profit by project */}
        <div className="panel">
          <div className="panel-h"><span className="hicon"><Icon name="projects" size={16} /></span><h2>Profit by project</h2></div>
          {(projRows.length || periodSalary > 0) ? (
            <table className={styles.plTable}>
              <thead><tr><th>Project</th><th className="right">Income</th><th className="right">Outgoing</th><th className="right">Net</th></tr></thead>
              <tbody>
                {projRows.map(r => (
                  <tr key={r.key || "unallocated"}>
                    <td>{r.label}</td>
                    <td className="right" style={{ color: "var(--green-ink)" }}><Money value={r.income} align="flex-end" /></td>
                    <td className="right" style={{ color: "var(--red-ink)" }}><Money value={r.expense} align="flex-end" /></td>
                    <td className="right" style={{ color: r.net < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={r.net} align="flex-end" /></td>
                  </tr>
                ))}
                {periodSalary > 0 && (
                  <tr>
                    <td className="muted">Salaries (not allocated to projects)</td>
                    <td className="right">—</td>
                    <td className="right" style={{ color: "var(--red-ink)" }}><Money value={periodSalary} align="flex-end" /></td>
                    <td className="right" style={{ color: "var(--red-ink)" }}>−<Money value={periodSalary} align="flex-end" /></td>
                  </tr>
                )}
                <tr className={styles.plTotal}>
                  <td><b>Net profit</b></td><td className="right" /><td className="right" />
                  <td className="right" style={{ color: periodNet < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><b><Money value={periodNet} align="flex-end" /></b></td>
                </tr>
              </tbody>
            </table>
          ) : <p className="muted">No transactions yet</p>}
        </div>
      </div>

      {/* income / outgoing by business donuts */}
      {(incomeDonut.length > 0 || expenseDonut.length > 0) && (
        <div className="grid2">
          <div className="panel">
            <div className="panel-h"><span className="hicon"><Icon name="arrowUp" size={16} /></span><h2>Income by business</h2></div>
            {incomeDonut.length ? <Donut data={incomeDonut} fmt={money} centerSub="income" centerIcon="arrowUp" centerColor="var(--green-ink)" /> : <p className="muted">No income yet</p>}
          </div>
          <div className="panel">
            <div className="panel-h"><span className="hicon"><Icon name="arrowDown" size={16} /></span><h2>Outgoing by business</h2></div>
            {expenseDonut.length ? <Donut data={expenseDonut} fmt={money} centerSub="outgoing" centerIcon="arrowDown" centerColor="var(--red-ink)" /> : <p className="muted">No outgoing yet</p>}
          </div>
        </div>
      )}

      {/* F8: P&L statement (print-friendly) */}
      <div className="panel">
        <div className="panel-h"><span className="hicon"><Icon name="print" size={16} /></span><h2>Profit &amp; Loss</h2>
          <span className="count">{periodLabel}</span>
        </div>
        <div className={styles.pl}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {allView ? "All businesses" : bizName(biz)} · {fmtDate(win.startDate)} – {fmtDate(dispEnd)} · salaries at current rates
          </div>
          <div className={styles.plRow}><span><b>Revenue</b></span><span style={{ color: "var(--green-ink)" }}><Money value={periodIncome} align="flex-end" /></span></div>
          <div className={styles.plSection}>Expenses</div>
          {expenseCats.map((c, i) => (
            <div className={styles.plRow} key={i}><span className="muted">{c.label}</span><span><Money value={c.value} align="flex-end" /></span></div>
          ))}
          <div className={styles.plRow}><span className="muted">Salaries (active staff)</span><span><Money value={periodSalary} align="flex-end" /></span></div>
          <div className={`${styles.plRow} ${styles.plSub}`}><span>Total expenses</span><span style={{ color: "var(--red-ink)" }}><Money value={periodOutgoing} align="flex-end" /></span></div>
          <div className={`${styles.plRow} ${styles.plTotal}`}><span><b>Net profit</b></span><span style={{ color: periodNet < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><b><Money value={periodNet} align="flex-end" /></b></span></div>
        </div>
      </div>

      {/* transactions */}
      <div className="panel">
        <div className="panel-h"><span className="hicon"><Icon name="finance" size={16} /></span><h2>Transactions</h2><span className="count">{tableRows.length}</span></div>
        <table>
          <thead><tr><th>Date</th><th>Business</th><th>Category</th><th>Type</th><th className="right">Amount</th><th></th></tr></thead>
          <tbody>
            <AnimatePresence>
              {tableRows.map(({ tx, occ: tocc }) => {
                const rec = tx.recurring === "monthly"
                const last = tocc[tocc.length - 1]
                const open = preview === tx.id
                return (
                  <motion.tr key={tx.id} variants={item} initial="initial" animate="animate" exit={{ opacity: 0 }} layout>
                    <td>
                      {fmtDate(last.date)}
                      {rec && <button className={styles.recBadge} onClick={() => setPreview(open ? null : tx.id)} title="Show every occurrence in this period">↻ monthly ×{tocc.length}</button>}
                      {open && (
                        <div className={styles.recList}>
                          {tocc.map(o => <div key={o._key}><span className="muted">{fmtDate(o.date)}</span><Money value={o.amount} align="flex-end" /></div>)}
                        </div>
                      )}
                    </td>
                    <td>{bizName(tx.business)}</td>
                    <td>{tx.category}{tx.project ? <small className="muted"> • {projName(tx.project)}</small> : ""}{tx.note ? <small className="muted"> • {tx.note}</small> : ""}</td>
                    <td>{tx.type === "income" ? <Tag color="green"><Icon name="arrowUp" size={11} /> Income</Tag> : <Tag color="red"><Icon name="arrowDown" size={11} /> Outgoing</Tag>}</td>
                    <td className="right" style={{ color: tx.type === "income" ? "var(--green-ink)" : "var(--red-ink)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <span>{tx.type === "income" ? "+" : "−"}</span><Money value={tx.amount} align="flex-end" />
                      </span>
                    </td>
                    <td className="right">
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="iconbtn" onClick={() => openEditor("transaction", tx.id)}><Icon name="edit" size={16} /></button>
                        <button className="iconbtn del" onClick={async () => { if (await ask({ title: "Delete transaction", message: rec ? "Delete this recurring transaction and all its occurrences?" : "Delete this transaction?" })) removeItem("transaction", tx.id) }}><Icon name="trash" size={16} /></button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {!tableRows.length && <EmptyState icon="finance" text="No transactions in this period" />}
      </div>
    </div>
  )
}
