/* ---------------------------------------------------------------------------
   Pure finance helpers shared by the Finance + Projects views.
   No React, no store — salary conversion takes a toGbp(amount, code) fn passed in.

   Design decisions (from the design-critique pass):
   - Recurring transactions are VIRTUAL: the stored transaction is the template;
     occurrences are expanded at render time. Never persisted per-occurrence.
   - All date math parses 'YYYY-MM-DD' as a LOCAL date (mirrors daysBetween in data.js).
   - "Salaries" is a reserved category: manual transactions in it are excluded from
     expense sums; one synthetic salary figure (from active staff) is injected instead.
--------------------------------------------------------------------------- */

export const SALARY_CATEGORY = "salaries"
export const isSalaryCategory = (cat) => String(cat || "").trim().toLowerCase() === SALARY_CATEGORY

const pad = (n) => String(n).padStart(2, "0")
const daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate()
const isoOf = (y, m0, day) => `${y}-${pad(m0 + 1)}-${pad(day)}`

/* Parse a plain 'YYYY-MM-DD' as a LOCAL calendar date (not UTC). */
export function parseLocalDate(iso) {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso)
  return isNaN(d) ? null : d
}

/* Month index = year*12 + monthZeroBased — easy to compare/iterate. */
export const monthIndexOfDate = (d) => d.getFullYear() * 12 + d.getMonth()
export function monthIndexOf(iso) {
  const d = parseLocalDate(iso)
  return d ? monthIndexOfDate(d) : null
}

/* Inclusive calendar-month count between two month indices, floored at 1. */
export const monthsInclusive = (startIdx, endIdx) => Math.max(1, endIdx - startIdx + 1)

/* Short label for a month index, e.g. "Mar 26". */
export function monthLabel(idx) {
  const y = Math.floor(idx / 12), m0 = ((idx % 12) + 12) % 12
  return new Date(y, m0, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
}

/* The active window for a period.
   period: 'all' | 'month' | 'quarter' | 'year' | 'custom'
   custom: { from, to } ISO strings (only for 'custom')
   now: a Date (passed in so callers control "today")
   scopeTx: transactions in the current business scope (used for the 'all' lower bound) */
export function periodWindow(period, custom, now, scopeTx) {
  const y = now.getFullYear(), m0 = now.getMonth()
  const nowIdx = y * 12 + m0
  let startDate, endDate
  if (period === "month") { startDate = new Date(y, m0, 1); endDate = new Date(y, m0 + 1, 0) }
  else if (period === "quarter") { const q0 = Math.floor(m0 / 3) * 3; startDate = new Date(y, q0, 1); endDate = new Date(y, q0 + 3, 0) }
  else if (period === "year") { startDate = new Date(y, 0, 1); endDate = new Date(y, 11, 31) }
  else if (period === "custom") {
    let a = parseLocalDate(custom && custom.from) || new Date(y, m0, 1)
    let b = parseLocalDate(custom && custom.to) || new Date(y, m0 + 1, 0)
    if (b < a) { const t = a; a = b; b = t }
    startDate = a; endDate = b
  } else { // 'all'
    let minIdx = nowIdx
    for (const t of scopeTx || []) { const mi = monthIndexOf(t.date); if (mi != null && mi < minIdx) minIdx = mi }
    startDate = new Date(Math.floor(minIdx / 12), minIdx % 12, 1)
    endDate = new Date(y + 50, 11, 31)   // include any future-dated manual entries under All time
  }
  const startIdx = monthIndexOfDate(startDate)
  const endIdx = Math.min(monthIndexOfDate(endDate), nowIdx)   // salary never counts beyond the current month
  return { period, startDate, endDate, startIdx, endIdx, nowIdx }
}

/* Number of whole calendar months the window covers (for salary scaling). */
export const windowMonths = (win) => monthsInclusive(win.startIdx, win.endIdx)

const OCC_CAP = 120   // safety cap: never expand more than 120 monthly occurrences per template

function mkOcc(tx, dateIso, source) {
  return { ...tx, date: dateIso, _key: tx.id + "__" + dateIso.slice(0, 7), _source: source, _templateId: tx.id }
}

/* Expand one transaction into the occurrences that fall inside [win.startDate, win.endDate].
   Non-recurring -> at most one. Monthly -> one per calendar month from its start (or window
   start, whichever is later) through min(window end, current month, recurrenceEnd). */
export function txOccurrences(tx, win, now) {
  const start = parseLocalDate(tx.date)
  if (!start) return []
  if (tx.recurring !== "monthly") {
    return (start >= win.startDate && start <= win.endDate) ? [mkOcc(tx, tx.date, "Manual")] : []
  }
  const day = start.getDate()
  const recEndIdx = tx.recurrenceEnd ? monthIndexOf(tx.recurrenceEnd) : Infinity
  const endIdx = Math.min(monthIndexOfDate(win.endDate), win.nowIdx, recEndIdx)
  let fromIdx = Math.max(monthIndexOfDate(start), monthIndexOfDate(win.startDate))
  if (endIdx - fromIdx + 1 > OCC_CAP) fromIdx = endIdx - OCC_CAP + 1   // keep the most recent 120
  const out = []
  for (let idx = fromIdx; idx <= endIdx; idx++) {
    const yy = Math.floor(idx / 12), mm = idx % 12
    const d = Math.min(day, daysInMonth(yy, mm))
    const occ = new Date(yy, mm, d)
    if (occ >= win.startDate && occ <= win.endDate) out.push(mkOcc(tx, isoOf(yy, mm, d), "Recurring"))
  }
  return out
}

/* All occurrences for a list of transactions within the window (used by every aggregate). */
export function expandAll(transactions, win, now) {
  const out = []
  for (const tx of transactions) for (const o of txOccurrences(tx, win, now)) out.push(o)
  return out
}

/* Monthly salary run-rate (current £) for active staff, optionally scoped to one business. */
export function monthlyRunRate(employees, toGbp, bizId) {
  return employees
    .filter(e => e.status === "active" && (bizId == null || (e.business || "") === bizId))
    .reduce((s, e) => s + toGbp(Number(e.salary || 0), e.currency), 0)
}

/* Salary cost across the whole window: per active employee, run-rate × months on/after hire. */
export function periodSalaryCost(employees, toGbp, win, bizId) {
  return employees
    .filter(e => e.status === "active" && (bizId == null || (e.business || "") === bizId))
    .reduce((s, e) => {
      const hireIdx = e.hireDate ? (monthIndexOf(e.hireDate) ?? win.startIdx) : win.startIdx
      const from = Math.max(win.startIdx, hireIdx)
      const months = Math.max(0, win.endIdx - from + 1)
      return s + toGbp(Number(e.salary || 0), e.currency) * months
    }, 0)
}

/* Salary run-rate for a single month index (gated by hire date) — used by the trend chart. */
export function salaryForMonth(employees, toGbp, monthIdx, bizId) {
  return employees
    .filter(e => e.status === "active" && (bizId == null || (e.business || "") === bizId))
    .reduce((s, e) => {
      const hireIdx = e.hireDate ? (monthIndexOf(e.hireDate) ?? -Infinity) : -Infinity
      return monthIdx >= hireIdx ? s + toGbp(Number(e.salary || 0), e.currency) : s
    }, 0)
}

/* All-time net profit attributed to a project (income − expense, excluding the Salaries
   category; salaries are never allocated to projects). Used by the Projects cards. */
export function projectNetAllTime(transactions, projectId, now) {
  const win = { startDate: new Date(1970, 0, 1), endDate: new Date(now.getFullYear() + 50, 11, 31), nowIdx: monthIndexOfDate(now) }
  let income = 0, expense = 0
  for (const tx of transactions) {
    if ((tx.project || "") !== projectId) continue
    for (const o of txOccurrences(tx, win, now)) {
      if (isSalaryCategory(o.category)) continue
      const amt = Number(o.amount || 0)
      if (o.type === "income") income += amt; else expense += amt
    }
  }
  return income - expense
}
