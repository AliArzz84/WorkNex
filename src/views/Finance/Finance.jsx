import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Tag, EmptyState, Icon, Money, CurrencyToggle, stagger, item } from '../../components/ui/ui.jsx'
import { BarsH, ColumnsV } from '../../components/Charts/Charts.jsx'
import {
  isSalaryCategory, periodWindow, windowMonths, txOccurrences, expandAll,
  monthlyRunRate, periodSalaryCost, salaryForMonth, monthLabel, monthIndexOf,
  periodExtraCost, extraForMonth, employeeExtraMonthly, previousWindow,
} from '../../lib/finance.js'
import styles from './Finance.module.css'

const CAT_COLORS =["#6c8cff", "#9b6cff", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#22d3ee", "#fb923c", "#a78bfa", "#f87171", "#2dd4bf", "#facc15"]

const PREV_LABEL = { month: "last month", quarter: "last quarter", year: "last year", custom: "prior period" }

// Period-over-period change pill. `goodWhen` flips the colour so that a falling
// "outgoing" reads green (good) while falling income reads red (bad).
function Delta({ cur, prev, goodWhen = "up" }) {
  if (prev == null) return null
  const diff = cur - prev
  const eps = Math.max(0.5, Math.abs(prev) * 0.005)
  if (Math.abs(diff) < eps) return <span className={`${styles.delta} ${styles.deltaFlat}`}>no change</span>
  const up = diff > 0
  const good = goodWhen === "up" ? up : !up
  const pct = prev !== 0 ? Math.round(Math.abs(diff / prev) * 100) : null
  const txt = pct == null ? "new" : (pct >= 1000 ? "10×+" : pct + "%")
  return (
    <span className={`${styles.delta} ${good ? styles.deltaGood : styles.deltaBad}`} title={`vs ${PREV_LABEL.custom}`}>
      <Icon name={up ? "arrowUp" : "arrowDown"} size={11} /> {txt}
    </span>
  )
}

const PERIODS = [["all", "All time"], ["month", "This month"], ["quarter", "This quarter"], ["year", "This year"], ["custom", "Custom"]]

// the sheets you can tick for an export (each key matches a `want(...)` check below)
const SECTIONS = [
  ["summary", "Summary"],
  ["byBusiness", "By business"],
  ["trend", "Monthly trend"],
  ["categories", "Spending by category"],
  ["projectProfit", "Project profit"],
  ["transactions", "Transactions"],
  ["businesses", "Businesses"],
  ["employees", "Employees"],
  ["projects", "Projects"],
  ["teams", "Teams"],
  ["payments", "Payroll history"],
  ["activity", "Activity log"],
]
const ALL_SECS = SECTIONS.map(s => s[0])

export default function Finance() {
  const { db, fmtBase, fmtDate, openEditor, removeItem, ask, toUsd, notify } = useStore()
  const [biz, setBiz] = useState("all")
  const [period, setPeriod] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [preview, setPreview] = useState(null)   // template id whose recurring expansion is shown
  const [tab, setTab] = useState("overview")      // overview | analysis | statements
  const [xlsxOpen, setXlsxOpen] = useState(false)
  const [xlsxSel, setXlsxSel] = useState([])           // businesses chosen for export ([] = all)
  const [xlsxSecs, setXlsxSecs] = useState(ALL_SECS)   // sections ticked for export
  const xlsxRef = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (xlsxRef.current && !xlsxRef.current.contains(e.target)) setXlsxOpen(false) }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

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
  const periodSalary = periodSalaryCost(db.employees, toUsd, win, bizId)
  const periodExtra = periodExtraCost(db.employees, toUsd, win, bizId)   // per-employee extra costs (not payroll)
  const periodOutgoing = periodExpense + periodSalary + periodExtra
  const periodNet = periodIncome - periodOutgoing
  const runRate = monthlyRunRate(db.employees, toUsd, bizId)
  const margin = periodIncome > 0 ? periodNet / periodIncome : null

  // --- period-over-period comparison (drives the "vs last month/…" delta pills)
  const prevWin = previousWindow(period, { from, to }, now, scopeTx)
  let prev = null
  if (prevWin) {
    const pocc = expandAll(scopeTx, prevWin, now)
    const pInc = sum(pocc, "income")
    const pOut = sum(pocc, "expense", true)
      + periodSalaryCost(db.employees, toUsd, prevWin, bizId)
      + periodExtraCost(db.employees, toUsd, prevWin, bizId)
    prev = { income: pInc, outgoing: pOut, net: pInc - pOut, salary: periodSalaryCost(db.employees, toUsd, prevWin, bizId) }
  }
  const prevLabel = PREV_LABEL[period] || null

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
  if (periodExtra > 0) catChart.push({ label: "Extra staff costs", value: periodExtra })
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
    const sal = salaryForMonth(db.employees, toUsd, idx, bizId)
    const ext = extraForMonth(db.employees, toUsd, idx, bizId)
    trend.push({ label: monthLabel(idx), income: inc, expense: exp, salary: sal, extra: ext, net: inc - exp - sal - ext })
  }
  const trendHasData = trend.some(m => m.income || m.expense || m.salary || m.extra)

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
  // transactions with no project chosen are NOT shown as a project — they live in a
  // separate company-level "Other (no project)" line, next to salaries.
  const realProjRows = projRows.filter(r => r.key)
  const unalloc = projRows.find(r => !r.key) || null

  // --- transactions table: ONE row per template (recurring collapsed to a badge)
  const tableRows = scopeTx
    .map(tx => ({ tx, occ: txOccurrences(tx, win, now) }))
    .filter(r => r.occ.length > 0)
    .sort((a, b) => new Date(b.occ[b.occ.length - 1].date) - new Date(a.occ[a.occ.length - 1].date))

  // dev-only reconciliation check (no production UI)
  if (import.meta.env.DEV) {
    const catSum = catChartColored.reduce((s, r) => s + r.value, 0)
    console.assert(Math.abs(catSum - periodOutgoing) < 0.01, "[finance] category breakdown != periodOutgoing", catSum, periodOutgoing)
    const projSum = projRows.reduce((s, r) => s + r.net, 0) - periodSalary - periodExtra
    console.assert(Math.abs(projSum - periodNet) < 0.01, "[finance] project profit + salaries + extra != periodNet", projSum, periodNet)
  }

  const periodLabel = PERIODS.find(p => p[0] === period)?.[1] || "All time"
  const showBanner = period !== "all" || !allView

  // --- F8: full styled Excel (.xlsx) — summary, businesses, trend, categories, projects, staff, transactions
  const exportExcel = async (secs = ALL_SECS, sel = "all") => {
    try {
      const mod = await import("exceljs"); const ExcelJS = mod.default || mod
      const wb = new ExcelJS.Workbook()
      wb.creator = "WorkNexus"; wb.created = new Date()

      const BRAND = "FF0071E3", WHITE = "FFFFFFFF", RED = "FFC9302C", GREEN = "FF248A3D", MUTED = "FF86868B"
      const MONEY = "#,##0.00"
      const colLetter = (n) => String.fromCharCode(64 + n)
      const slug = (s) => "t_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")

      // only the sections the user ticked
      const want = (k) => secs.includes(k)

      // recompute the financial aggregates for the chosen business selection.
      // sel: "all" or an array of business ids (one or several).
      const fin = (selArg) => {
        const av = selArg === "all" || !selArg || (Array.isArray(selArg) && !selArg.length)
        const ids = av ? null : (Array.isArray(selArg) ? selArg : [selArg])
        const stx = av ? db.transactions : db.transactions.filter(x => ids.includes(x.business || ""))
        const w = periodWindow(period, { from, to }, now, stx)
        const salFor = (fn) => av ? fn(null) : ids.reduce((s, id) => s + fn(id), 0)
        const oc = expandAll(stx, w, now)
        const inc = sum(oc, "income")
        const exp = sum(oc, "expense", true)
        const sal = salFor(id => periodSalaryCost(db.employees, toUsd, w, id))
        const ext = salFor(id => periodExtraCost(db.employees, toUsd, w, id))
        const rr = salFor(id => monthlyRunRate(db.employees, toUsd, id))
        // category breakdown
        const cm = new Map()
        for (const o of oc) {
          if (o.type !== "expense" || isSalaryCategory(o.category)) continue
          const key = (String(o.category || "").trim().toLowerCase()) || "uncategorised"
          const disp = (String(o.category || "").trim()) || "Uncategorised"
          const c = cm.get(key) || { label: disp, value: 0 }
          c.value += Number(o.amount || 0); cm.set(key, c)
        }
        const cc = [...cm.values()].sort((a, b) => b.value - a.value)
        if (sal > 0) cc.push({ label: "Salaries (from active staff)", value: sal })
        if (ext > 0) cc.push({ label: "Extra staff costs", value: ext })
        // monthly trend
        const lo = Math.max(w.startIdx, w.endIdx - 11); const iBy = {}, eBy = {}
        for (const o of oc) {
          const mi = monthIndexOf(o.date); if (mi == null) continue
          if (o.type === "income") iBy[mi] = (iBy[mi] || 0) + Number(o.amount || 0)
          else if (!isSalaryCategory(o.category)) eBy[mi] = (eBy[mi] || 0) + Number(o.amount || 0)
        }
        const tr = []
        for (let i = lo; i <= w.endIdx; i++) {
          const ii = iBy[i] || 0, ee = eBy[i] || 0
          const ss = salFor(id => salaryForMonth(db.employees, toUsd, i, id))
          const xx = salFor(id => extraForMonth(db.employees, toUsd, i, id))
          tr.push({ label: monthLabel(i), income: ii, expense: ee, salary: ss, extra: xx, net: ii - ee - ss - xx })
        }
        // profit by project
        const pm = new Map()
        for (const o of oc) {
          if (isSalaryCategory(o.category)) continue
          const key = o.project || ""
          const r = pm.get(key) || { key, label: key ? (projName(key) || "Project") : "Unallocated", income: 0, expense: 0 }
          const amt = Number(o.amount || 0)
          if (o.type === "income") r.income += amt; else r.expense += amt
          pm.set(key, r)
        }
        const pr = [...pm.values()].map(r => ({ ...r, net: r.income - r.expense })).sort((a, b) => b.net - a.net)
        return { av, ids, w, oc, inc, exp, sal, ext, outg: exp + sal + ext, net: inc - (exp + sal + ext), rr, cc, tr, pr }
      }

      const F = fin(sel)
      const allView = F.av, selIds = F.ids, win = F.w, occ = F.oc
      const periodIncome = F.inc, periodExpense = F.exp, periodSalary = F.sal, periodExtra = F.ext
      const periodOutgoing = F.outg, periodNet = F.net, runRate = F.rr
      const catChartColored = F.cc, trend = F.tr, projRows = F.pr

      const dates = occ.map(o => o.date).filter(Boolean).sort()
      const fromD = dates.length ? fmtDate(dates[0]) : "—"
      const toD = dates.length ? fmtDate(dates[dates.length - 1]) : "—"
      const scope = allView ? "All businesses" : selIds.map(bizName).join(", ")

      const titleBar = (ws, title, sub, ncol) => {
        ws.mergeCells(`A1:${colLetter(ncol)}1`)
        const t = ws.getCell("A1")
        t.value = title
        t.font = { bold: true, size: 14, color: { argb: WHITE } }
        t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }
        t.alignment = { vertical: "middle", indent: 1 }
        ws.getRow(1).height = 26
        if (sub) {
          ws.mergeCells(`A2:${colLetter(ncol)}2`)
          const s = ws.getCell("A2")
          s.value = sub
          s.font = { size: 10, color: { argb: MUTED } }
          s.alignment = { vertical: "middle", indent: 1 }
          ws.getRow(2).height = 18
        }
      }

      // generic styled-table sheet. columns: [{name,width,numFmt,filter}]; neg: column indexes coloured by sign
      const sheet = (name, columns, rows, { neg = [], startRow = 4 } = {}) => {
        if (!rows.length) return
        const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] })
        titleBar(ws, name, null, columns.length)
        ws.addTable({
          name: slug(name), ref: "A" + startRow, headerRow: true,
          style: { theme: "TableStyleMedium2", showRowStripes: true },
          columns: columns.map(c => ({ name: c.name, filterButton: !!c.filter })),
          rows,
        })
        columns.forEach((c, i) => {
          const col = ws.getColumn(i + 1)
          // auto width: fit the longest of header / values, + breathing room, clamped
          let maxLen = String(c.name || "").length
          for (const r of rows) {
            const v = r[i]
            const len = (v == null || v === "") ? 0
              : (v instanceof Date ? (c.numFmt && c.numFmt.includes("hh") ? 16 : 10) : String(v).length)
            if (len > maxLen) maxLen = len
          }
          col.width = Math.min(Math.max(c.width || 10, maxLen + 4), 55)
          // a little inner padding so text never hugs the cell border; numbers stay right-aligned
          if (c.numFmt) {
            col.numFmt = c.numFmt
            col.alignment = { horizontal: "right", indent: 1 }
            ws.getCell(startRow, i + 1).alignment = { horizontal: "right", indent: 1 }
          } else {
            col.alignment = { horizontal: "left", indent: 1 }
            ws.getCell(startRow, i + 1).alignment = { horizontal: "left", indent: 1 }
          }
        })
        neg.forEach(ci => {
          for (let r = 0; r < rows.length; r++) {
            const cell = ws.getCell(startRow + 1 + r, ci + 1)
            const v = Number(cell.value)
            if (v < 0) cell.font = { color: { argb: RED } }
            else if (v > 0) cell.font = { color: { argb: GREEN } }
          }
        })
        ws.views = [{ state: "frozen", ySplit: startRow, showGridLines: false }]
      }

      // ---- Summary (KPIs + report meta)
      if (want("summary")) {
        const ws = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] })
        titleBar(ws, "WorkNexus — Finance report",
          `${scope}   ·   ${periodLabel}   ·   ${fromD} → ${toD}   ·   Generated ${new Date().toLocaleString("en-GB")}   ·   USD base`, 2)
        ws.addTable({
          name: "t_summary", ref: "A4", headerRow: true,
          style: { theme: "TableStyleMedium2", showRowStripes: true },
          columns: [{ name: "Metric" }, { name: "Amount (USD)" }],
          rows: [
            ["Total income", periodIncome],
            ["Manual expenses", periodExpense],
            ["Salary cost (period)", periodSalary],
            ["Extra staff costs (period)", periodExtra],
            ["Total outgoing", periodOutgoing],
            ["Net profit", periodNet],
            ["Profit margin", periodIncome ? periodNet / periodIncome : 0],
            ["Monthly run-rate (salaries)", runRate],
            ["Transactions in range", occ.length],
          ],
        })
        ws.getColumn(1).width = 32; ws.getColumn(1).alignment = { indent: 1 }
        ws.getColumn(2).width = 20; ws.getColumn(2).numFmt = MONEY; ws.getColumn(2).alignment = { horizontal: "right", indent: 1 }
        ws.getCell("B11").numFmt = "0.0%"   // margin
        ws.getCell("B13").numFmt = "#,##0"  // tx count
        ws.getCell("B10").font = { bold: true, color: { argb: periodNet < 0 ? RED : GREEN } }  // net
        ws.views = [{ state: "frozen", ySplit: 4, showGridLines: false }]
      }

      // ---- By business (across all, or when several are selected)
      if (want("byBusiness") && (allView || (selIds && selIds.length > 1))) {
        const agg = {}
        for (const o of occ) {
          const id = o.business || ""
          const a = agg[id] || (agg[id] = { inc: 0, exp: 0 })
          const amt = Number(o.amount || 0)
          if (o.type === "income") a.inc += amt
          else if (!isSalaryCategory(o.category)) a.exp += amt
        }
        const rows = []; let assignedSal = 0, assignedExt = 0
        for (const b of (allView ? db.businesses : db.businesses.filter(x => selIds.includes(x.id)))) {
          const sal = periodSalaryCost(db.employees, toUsd, win, b.id); assignedSal += sal
          const ext = periodExtraCost(db.employees, toUsd, win, b.id); assignedExt += ext
          const a = agg[b.id] || { inc: 0, exp: 0 }
          rows.push([b.name, a.inc, a.exp, sal, ext, a.inc - a.exp - sal - ext])
        }
        const un = agg[""]; const unSal = Math.max(0, periodSalary - assignedSal); const unExt = Math.max(0, periodExtra - assignedExt)
        if ((un && (un.inc || un.exp)) || unSal || unExt) {
          const a = un || { inc: 0, exp: 0 }
          rows.push(["Unassigned", a.inc, a.exp, unSal, unExt, a.inc - a.exp - unSal - unExt])
        }
        sheet("By business", [
          { name: "Business", width: 26 }, { name: "Income", width: 15, numFmt: MONEY },
          { name: "Expenses", width: 15, numFmt: MONEY }, { name: "Salaries", width: 15, numFmt: MONEY },
          { name: "Extra", width: 15, numFmt: MONEY }, { name: "Net", width: 15, numFmt: MONEY },
        ], rows, { neg: [5] })
      }

      // ---- Monthly trend
      want("trend") && sheet("Trend", [
        { name: "Month", width: 14 }, { name: "Income", width: 15, numFmt: MONEY },
        { name: "Expenses", width: 15, numFmt: MONEY }, { name: "Salaries", width: 15, numFmt: MONEY },
        { name: "Extra", width: 15, numFmt: MONEY }, { name: "Net", width: 15, numFmt: MONEY },
      ], trend.map(m => [m.label, m.income, m.expense, m.salary, m.extra || 0, m.net]), { neg: [5] })

      // ---- Spending by category
      want("categories") && sheet("Categories", [
        { name: "Category", width: 32 }, { name: "Amount (USD)", width: 16, numFmt: MONEY },
        { name: "% of outgoing", width: 14, numFmt: "0.0%" },
      ], catChartColored.map(c => [c.label, c.value, periodOutgoing ? c.value / periodOutgoing : 0]))

      // ---- Profit by project (period-scoped financials)
      want("projectProfit") && sheet("Project profit", [
        { name: "Project", width: 28 }, { name: "Income", width: 15, numFmt: MONEY },
        { name: "Expense", width: 15, numFmt: MONEY }, { name: "Net", width: 15, numFmt: MONEY },
      ], projRows.map(p => [p.label, p.income, p.expense, p.net]), { neg: [3] })

      // ===== full company directory (current snapshot; business-scoped where it applies) =====
      const empName = (id) => db.employees.find(e => e.id === id)?.name || ""
      const teamName = (id) => db.teams.find(t => t.id === id)?.name || ""
      const teamsOf = (eid) => db.teams.filter(t => (t.members || []).includes(eid)).map(t => t.name).join(", ")
      const D = (s) => s ? new Date(s) : ""               // date cell, or blank
      const inBiz = (x) => allView || selIds.includes(x.business || "")

      // ---- Businesses (with headline stats)
      const bizList = allView ? db.businesses : db.businesses.filter(b => selIds.includes(b.id))
      want("businesses") && sheet("Businesses", [
        { name: "Business", width: 24 }, { name: "Employees", width: 12, numFmt: "#,##0" },
        { name: "Projects", width: 11, numFmt: "#,##0" }, { name: "Teams", width: 9, numFmt: "#,##0" },
        { name: "Active salary (USD/mo)", width: 19, numFmt: MONEY },
      ], bizList.map(b => {
        const emps = db.employees.filter(e => (e.business || "") === b.id)
        const monthly = emps.filter(e => e.status === "active").reduce((s, e) => s + toUsd(e.salary, e.currency), 0)
        return [b.name, emps.length, db.projects.filter(p => (p.business || "") === b.id).length,
          db.teams.filter(t => (t.business || "") === b.id).length, monthly]
      }))

      // ---- Employees (full directory + salary)
      want("employees") && sheet("Employees", [
        { name: "Name", width: 20 }, { name: "Role", width: 18 }, { name: "Based in", width: 14 },
        { name: "Email", width: 24 }, { name: "Phone", width: 16 }, { name: "Business", width: 16 },
        { name: "Teams", width: 20 }, { name: "Status", width: 10 }, { name: "Pay day", width: 9, numFmt: "#,##0" },
        { name: "Currency", width: 10 }, { name: "Salary (orig)", width: 14, numFmt: "#,##0.00" },
        { name: "Salary (USD/mo)", width: 15, numFmt: MONEY }, { name: "Extra (USD/mo)", width: 14, numFmt: MONEY },
        { name: "Hire date", width: 13, numFmt: "yyyy-mm-dd" }, { name: "Card number", width: 20 },
        { name: "IBAN / Sheba", width: 26 }, { name: "Bank", width: 14 }, { name: "Notes", width: 28 },
      ], db.employees.filter(inBiz).map(e => [
        e.name, e.role || "", e.country || "", e.email || "", e.phone || "", bizName(e.business),
        teamsOf(e.id), e.status || "", Number(e.payDay) || "", e.currency || "USD", Number(e.salary) || 0,
        toUsd(e.salary, e.currency), toUsd(employeeExtraMonthly(e), e.currency), D(e.hireDate),
        e.cardNumber || "", e.iban || "", e.bankName || "", e.notes || "",
      ]))

      // ---- Projects (full directory)
      want("projects") && sheet("Projects", [
        { name: "Project", width: 22 }, { name: "Client", width: 18 }, { name: "Business", width: 16 },
        { name: "Team", width: 16 }, { name: "Status", width: 12 }, { name: "Progress", width: 10, numFmt: '0"%"' },
        { name: "Budget (USD)", width: 14, numFmt: MONEY }, { name: "Deadline", width: 13, numFmt: "yyyy-mm-dd" },
        { name: "Notes", width: 28 },
      ], db.projects.filter(inBiz).map(p => [
        p.name, p.client || "", bizName(p.business), teamName(p.team), p.status || "",
        Number(p.progress) || 0, Number(p.budget) || 0, D(p.deadline), p.notes || "",
      ]))

      // ---- Teams
      want("teams") && sheet("Teams", [
        { name: "Team", width: 20 }, { name: "Business", width: 16 }, { name: "Lead", width: 18 },
        { name: "Members", width: 10, numFmt: "#,##0" }, { name: "Member names", width: 40 },
      ], db.teams.filter(inBiz).map(t => [
        t.name, bizName(t.business), empName(t.lead), (t.members || []).length,
        (t.members || []).map(empName).filter(Boolean).join(", "),
      ]))

      // ---- Payments (payroll history)
      const payRows = []
      for (const [eid, periods] of Object.entries(db.payments || {})) {
        const e = db.employees.find(x => x.id === eid)
        if (!allView && e && !selIds.includes(e.business || "")) continue
        for (const [per, ts] of Object.entries(periods || {})) {
          payRows.push([e?.name || eid, bizName(e?.business), per, ts ? new Date(ts) : ""])
        }
      }
      payRows.sort((a, b) => (b[3] ? b[3].getTime() : 0) - (a[3] ? a[3].getTime() : 0))
      want("payments") && sheet("Payments", [
        { name: "Employee", width: 20 }, { name: "Business", width: 16 },
        { name: "Period", width: 12 }, { name: "Paid on", width: 18, numFmt: "yyyy-mm-dd hh:mm" },
      ], payRows)

      // ---- Activity log (audit trail)
      want("activity") && sheet("Activity", [
        { name: "When", width: 18, numFmt: "yyyy-mm-dd hh:mm" }, { name: "Who", width: 24 },
        { name: "Role", width: 10 }, { name: "Action", width: 12 }, { name: "Entity", width: 12 },
        { name: "Name", width: 22 }, { name: "Detail", width: 30 },
      ], (db.activity || []).map(a => [
        a.ts ? new Date(a.ts) : "", a.email || "", a.role || "", a.action || "", a.entity || "", a.name || "", a.detail || "",
      ]))

      // ---- Transactions (recurring expanded), with column filters
      const txRows = [...occ].sort((a, b) =>
        bizName(a.business).localeCompare(bizName(b.business)) || a.date.localeCompare(b.date) ||
        String(a.category || "").localeCompare(String(b.category || "")))
      want("transactions") && sheet("Transactions", [
        { name: "Date", width: 12, numFmt: "yyyy-mm-dd", filter: true },
        { name: "Business", width: 20, filter: true },
        { name: "Category", width: 20, filter: true },
        { name: "Project", width: 18, filter: true },
        { name: "Type", width: 11, filter: true },
        { name: "Source", width: 12, filter: true },
        { name: "Amount (USD)", width: 15, numFmt: MONEY },
        { name: "Note", width: 30 },
      ], txRows.map(o => [
        o.date ? new Date(o.date) : "", bizName(o.business), o.category || "", o.project ? projName(o.project) : "",
        o.type === "income" ? "Income" : "Outgoing", o._source || "Manual", Number(o.amount) || 0, o.note || "",
      ]))

      // every data sheet skips itself when it has no rows — if that leaves the
      // workbook empty, writing it would produce a file Excel flags as corrupt
      if (wb.worksheets.length === 0) {
        notify?.("Nothing to export for the chosen sections in this range.", "info")
        return
      }

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      const bizTag = allView ? "" : (selIds.length === 1 ? "-" + bizName(selIds[0]).replace(/\s+/g, "") : "-" + selIds.length + "biz")
      const secTag = secs.length >= SECTIONS.length ? "full-report" : (secs.length === 1 ? secs[0] : "custom")
      a.download = `worknexus-${secTag}${bizTag}-${now.toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error("Excel export failed:", e)
      notify?.("Couldn’t build the Excel file — please try again.", "error")
    }
  }

  return (
    <div>
      {/* period + custom range + CSV */}
      <div className="filters">
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {period === "custom" && (<>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="muted">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </>)}
        {db.businesses.length > 0 && (
          <select value={biz} onChange={e => setBiz(e.target.value)}>
            <option value="all">All businesses</option>
            {db.businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <span style={{ marginInlineStart: "auto" }}><CurrencyToggle /></span>
        <div className={styles.xlsxWrap} ref={xlsxRef}>
          <button className="btn ghost sm" onClick={() => setXlsxOpen(o => !o)}>
            <Icon name="download" size={14} /> Excel <Icon name="chevron" size={13} />
          </button>
          <AnimatePresence>
            {xlsxOpen && (
              <motion.div className={styles.xlsxMenu}
                initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.14 }}>
                {db.businesses.length > 0 && (<>
                  <div className={styles.xlsxHead}>Businesses</div>
                  <div className={styles.xlsxBiz}>
                    <button className={`${styles.xlsxChip} ${xlsxSel.length === 0 ? styles.chipOn : ""}`} onClick={() => setXlsxSel([])}>All</button>
                    {db.businesses.map(b => (
                      <button key={b.id} className={`${styles.xlsxChip} ${xlsxSel.includes(b.id) ? styles.chipOn : ""}`}
                        onClick={() => setXlsxSel(s => s.includes(b.id) ? s.filter(x => x !== b.id) : [...s, b.id])}>{b.name}</button>
                    ))}
                  </div>
                </>)}
                <div className={styles.xlsxHead2}>
                  <span>Sections</span>
                  <button className={styles.xlsxLink} onClick={() => setXlsxSecs(xlsxSecs.length === SECTIONS.length ? [] : ALL_SECS)}>
                    {xlsxSecs.length === SECTIONS.length ? "Clear" : "Select all"}
                  </button>
                </div>
                <div className={styles.xlsxSecs}>
                  {SECTIONS.map(([key, label]) => (
                    <button key={key} className={styles.xlsxCheck}
                      onClick={() => setXlsxSecs(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key])}>
                      <span className={`${styles.box} ${xlsxSecs.includes(key) ? styles.boxOn : ""}`}>
                        {xlsxSecs.includes(key) && <Icon name="check" size={11} />}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
                <button className={styles.xlsxExport} disabled={!xlsxSecs.length}
                  onClick={() => { setXlsxOpen(false); exportExcel(xlsxSecs, xlsxSel.length ? xlsxSel : "all") }}>
                  <Icon name="download" size={14} /> Export{xlsxSecs.length ? ` (${xlsxSecs.length})` : ""}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showBanner && (
        <div className="muted" style={{ fontSize: 12.5, margin: "0 2px 12px" }}>
          Showing <b>{periodLabel}</b> · {fmtDate(win.startDate)} – {fmtDate(dispEnd)}
          {!allView && <> · Business: <b>{bizName(biz)}</b></>}
        </div>
      )}

      <div className="pill-row" style={{ marginBottom: 16 }}>
        {[["overview", "Overview"], ["analysis", "Analysis"], ["statements", "Statements"]].map(([k, l]) =>
          <span key={k} className={`pill ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</span>)}
      </div>

      {tab === "overview" && (<>
      {prev && (
        <div className={styles.cmpNote}>
          <Icon name="finance" size={13} /> Compared with <b>{prevLabel}</b>
        </div>
      )}
      <motion.div className={`kpis ${styles.finKpis}`} variants={stagger} initial="initial" animate="animate">
        <motion.div className="kpi k2" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="arrowUp" size={20} /></div>
          <h3><Money value={periodIncome} /></h3>
          <p>Total income {prev && <Delta cur={periodIncome} prev={prev.income} goodWhen="up" />}</p>
        </motion.div>
        <motion.div className="kpi k4" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="arrowDown" size={20} /></div>
          <h3><Money value={periodOutgoing} /></h3>
          <p>Total outgoing {prev && <Delta cur={periodOutgoing} prev={prev.outgoing} goodWhen="down" />}</p>
        </motion.div>
        <motion.div className="kpi k1" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="finance" size={20} /></div>
          <h3 style={{ color: periodNet < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={periodNet} /></h3>
          <p>Net profit {prev && <Delta cur={periodNet} prev={prev.net} goodWhen="up" />}</p>
          {margin != null && (
            <small style={{ color: "var(--muted)", fontSize: 11 }}>
              {(margin * 100).toFixed(margin >= 0.1 || margin <= -0.1 ? 0 : 1)}% profit margin
            </small>
          )}
        </motion.div>
        <motion.div className="kpi k3" variants={item} whileHover={{ y: -3 }}>
          <div className="ic"><Icon name="wallet" size={20} /></div>
          <h3><Money value={periodSalary} /></h3><p>Salaries (period total)</p>
          <small style={{ color: "var(--muted)", fontSize: 11 }}>≈ {fmtBase(Math.round(runRate))}/mo · {months} mo</small>
        </motion.div>
      </motion.div>

      {/* at-a-glance highlights — the facts a boss scans first */}
      {(catChartColored.length > 0 || projRows.length > 0) && (
        <div className={styles.insights}>
          {catChartColored.length > 0 && (() => {
            const top = catChartColored[0]
            return (
              <div className={styles.insight}>
                <span className={styles.insIc} style={{ background: "rgba(255,59,48,.14)", color: "var(--red-ink)" }}><Icon name="arrowDown" size={16} /></span>
                <div className={styles.insBody}>
                  <small>Biggest cost</small>
                  <b>{top.label}</b>
                  <span className={styles.insVal}><Money value={top.value} /> · {periodOutgoing ? Math.round(top.value / periodOutgoing * 100) : 0}% of outgoing</span>
                </div>
              </div>
            )
          })()}
          {(() => {
            const best = projRows.filter(p => p.key && p.net > 0)[0]
            return best ? (
              <div className={styles.insight}>
                <span className={styles.insIc} style={{ background: "rgba(52,199,89,.14)", color: "var(--green-ink)" }}><Icon name="projects" size={16} /></span>
                <div className={styles.insBody}>
                  <small>Most profitable project</small>
                  <b>{best.label}</b>
                  <span className={styles.insVal} style={{ color: "var(--green-ink)" }}>+<Money value={best.net} /> net</span>
                </div>
              </div>
            ) : null
          })()}
          <div className={styles.insight}>
            <span className={styles.insIc} style={{ background: "rgba(0,113,227,.12)", color: "var(--blue-ink)" }}><Icon name="finance" size={16} /></span>
            <div className={styles.insBody}>
              <small>Average per month</small>
              <b style={{ color: periodNet < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={periodNet / months} /></b>
              <span className={styles.insVal}>net over {months} month{months > 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      )}

      {/* F2: monthly trend */}
      <div className="panel">
        <div className="panel-h"><span className="hicon"><Icon name="finance" size={16} /></span><h2>Monthly trend</h2></div>
        {trendHasData ? <ColumnsV data={trend} fmt={fmtBase} /> : <p className="muted">No activity in this period yet</p>}
      </div>
      </>)}

      {tab === "analysis" && (
      <div className="grid2">
        {/* F3: spending by category */}
        <div className="panel">
          <div className="panel-h"><span className="hicon"><Icon name="arrowDown" size={16} /></span><h2>Spending by category</h2></div>
          {catChartColored.length ? <BarsH data={catChartColored} fmt={fmtBase} /> : <p className="muted">No outgoing yet</p>}
        </div>
        {/* F10: profit by project */}
        <div className="panel">
          <div className="panel-h"><span className="hicon"><Icon name="projects" size={16} /></span><h2>Profit by project</h2></div>
          {(realProjRows.length || unalloc || periodSalary > 0 || periodExtra > 0) ? (
            <table className={styles.plTable}>
              <thead><tr><th>Project</th><th className="right">Income</th><th className="right">Outgoing</th><th className="right">Net</th></tr></thead>
              <tbody>
                {realProjRows.map(r => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td className="right" style={{ color: "var(--green-ink)" }}><Money value={r.income} align="flex-end" /></td>
                    <td className="right" style={{ color: "var(--red-ink)" }}><Money value={r.expense} align="flex-end" /></td>
                    <td className="right" style={{ color: r.net < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={r.net} align="flex-end" /></td>
                  </tr>
                ))}
                {unalloc && (unalloc.income > 0 || unalloc.expense > 0) && (
                  <tr>
                    <td className="muted">Other (not tied to a project)</td>
                    <td className="right" style={{ color: "var(--green-ink)" }}>{unalloc.income > 0 ? <Money value={unalloc.income} align="flex-end" /> : "—"}</td>
                    <td className="right" style={{ color: "var(--red-ink)" }}>{unalloc.expense > 0 ? <Money value={unalloc.expense} align="flex-end" /> : "—"}</td>
                    <td className="right" style={{ color: unalloc.net < 0 ? "var(--red-ink)" : "var(--green-ink)" }}><Money value={unalloc.net} align="flex-end" /></td>
                  </tr>
                )}
                {periodSalary > 0 && (
                  <tr>
                    <td className="muted">Salaries (not allocated to projects)</td>
                    <td className="right">—</td>
                    <td className="right" style={{ color: "var(--red-ink)" }}><Money value={periodSalary} align="flex-end" /></td>
                    <td className="right" style={{ color: "var(--red-ink)" }}>−<Money value={periodSalary} align="flex-end" /></td>
                  </tr>
                )}
                {periodExtra > 0 && (
                  <tr>
                    <td className="muted">Extra staff costs</td>
                    <td className="right">—</td>
                    <td className="right" style={{ color: "var(--red-ink)" }}><Money value={periodExtra} align="flex-end" /></td>
                    <td className="right" style={{ color: "var(--red-ink)" }}>−<Money value={periodExtra} align="flex-end" /></td>
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
      )}

      {tab === "statements" && (<>
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
          {periodExtra > 0 && <div className={styles.plRow}><span className="muted">Extra staff costs</span><span><Money value={periodExtra} align="flex-end" /></span></div>}
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
                    <td data-label="Business">{bizName(tx.business)}</td>
                    <td data-label="Category">{tx.category}{tx.project ? <small className="muted"> • {projName(tx.project)}</small> : ""}{tx.note ? <small className="muted"> • {tx.note}</small> : ""}</td>
                    <td data-label="Type">{tx.type === "income" ? <Tag color="green"><Icon name="arrowUp" size={11} /> Income</Tag> : <Tag color="red"><Icon name="arrowDown" size={11} /> Outgoing</Tag>}</td>
                    <td data-label="Amount" className="right" style={{ color: tx.type === "income" ? "var(--green-ink)" : "var(--red-ink)" }}>
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
      </>)}
    </div>
  )
}
