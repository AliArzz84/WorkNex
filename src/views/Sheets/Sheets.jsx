import { useRef, useState } from 'react'
import { useStore } from '../../lib/store.jsx'
import { Icon, EmptyState } from '../../components/ui/ui.jsx'
import { uid } from '../../lib/data.js'
import styles from './Sheets.module.css'

// a fresh, hand-made table starts with 3 columns and 3 empty rows
const mkSheet = () => ({
  id: uid("sh"),
  name: "Untitled table",
  columns: [{ id: uid("c"), name: "Column 1" }, { id: uid("c"), name: "Column 2" }, { id: uid("c"), name: "Column 3" }],
  rows: [{ id: uid("r"), cells: {} }, { id: uid("r"), cells: {} }, { id: uid("r"), cells: {} }],
})

// flatten any exceljs cell value (date / formula / rich text / hyperlink) to plain text
const cellToStr = (v) => {
  if (v == null) return ""
  if (typeof v === "object") {
    if (v instanceof Date) return v.toLocaleDateString("en-GB")
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join("")
    if (v.result != null) return String(v.result)
    if (v.text != null) return String(v.text)
    if (v.error) return String(v.error)
    return ""
  }
  return String(v)
}
const argbToHex = (argb) => {
  if (!argb || typeof argb !== "string") return null
  const h = argb.length === 8 ? argb.slice(2) : argb
  return /^[0-9a-fA-F]{6}$/.test(h) ? "#" + h.toUpperCase() : null
}
const lighten = (hex, amt = 0.82) => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || ""); if (!m) return null
  const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const mix = (x) => Math.round(x + (255 - x) * amt)
  return "#" + [mix(r), mix(g), mix(b)].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase()
}
const styleOf = (cell) => {
  let bg = null
  const f = cell.fill
  if (f && f.type === "pattern" && f.pattern === "solid" && f.fgColor) {
    const hex = argbToHex(f.fgColor.argb)
    if (hex && hex !== "#FFFFFF") bg = hex
  }
  let fg = argbToHex(cell.font?.color?.argb)
  if (fg === "#FFFFFF" && !bg) fg = null
  const o = {}
  if (bg) o.bg = bg
  if (fg) o.fg = fg
  if (cell.font?.bold) o.b = 1
  return o
}
const cellText = (x) => (x && typeof x === "object") ? (x.v ?? "") : (x ?? "")
const colToNum = (s) => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n }
// merged ranges → spans for the top-left cell + the set of covered cells to skip
const mergeSpans = (merges) => {
  const spanAt = new Map(), covered = new Set()
  for (const rng of (merges || [])) {
    const [a, b] = String(rng).split(":"); if (!b) continue
    const ma = /^([A-Z]+)(\d+)$/.exec(a), mb = /^([A-Z]+)(\d+)$/.exec(b); if (!ma || !mb) continue
    const c1 = colToNum(ma[1]), r1 = +ma[2], c2 = colToNum(mb[1]), r2 = +mb[2]
    const top = Math.min(r1, r2), left = Math.min(c1, c2), bottom = Math.max(r1, r2), right = Math.max(c1, c2)
    spanAt.set(top + "_" + left, { cs: right - left + 1, rs: bottom - top + 1 })
    for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) if (!(r === top && c === left)) covered.add(r + "_" + c)
  }
  return { spanAt, covered }
}
const parseRangeStr = (rng) => {
  const [a, b] = String(rng).split(":")
  const ma = /^\$?([A-Z]+)\$?(\d+)$/.exec(a || ""), mb = /^\$?([A-Z]+)\$?(\d+)$/.exec(b || a || "")
  if (!ma || !mb) return null
  const c1 = colToNum(ma[1]), r1 = +ma[2], c2 = colToNum(mb[1]), r2 = +mb[2]
  return { top: Math.min(r1, r2), left: Math.min(c1, c2), bottom: Math.max(r1, r2), right: Math.max(c1, c2) }
}
const unquote = (f) => String(f ?? "").trim().replace(/^"|"$/g, "")
const cfRuleColors = (rule) => {
  const st = rule && rule.style
  let bg = null, fg = null
  if (st?.fill?.type === "pattern" && st.fill.pattern === "solid" && st.fill.fgColor) bg = argbToHex(st.fill.fgColor.argb)
  if (st?.font?.color) fg = argbToHex(st.font.color.argb)
  return (bg || fg) ? { bg, fg } : null
}
const cfRuleMatches = (rule, text) => {
  const t = String(text ?? "")
  if (!t) return false
  switch (rule.type) {
    case "containsText":
      if (rule.operator === "notContains") return rule.text != null && !t.includes(rule.text)
      if (rule.operator === "beginsWith") return t.startsWith(rule.text || "")
      if (rule.operator === "endsWith") return t.endsWith(rule.text || "")
      return rule.text != null && t.includes(rule.text)
    case "beginsWith": return t.startsWith(rule.text || "")
    case "endsWith": return t.endsWith(rule.text || "")
    case "cellIs":
      if (rule.operator === "notEqual") return t !== unquote(rule.formulae?.[0])
      return rule.operator === "equal" && t === unquote(rule.formulae?.[0])
    case "expression": {
      // Google Sheets exports value-based colours as a formula (e.g. =$P4="Done" or
      // =REGEXMATCH($P4,"Done")). Pull the quoted literals and match the cell text.
      const f = String(rule.formulae?.[0] || "").replace(/""/g, '"')
      const lits = (f.match(/"([^"]+)"/g) || []).map(l => l.replace(/"/g, ""))
      return lits.length > 0 && lits.some(l => t.includes(l))
    }
    default: return false
  }
}

// every currency amount that appears *anywhere* inside a cell — either symbol-first ($1,000 /
// £3,000) or code-after (5,000 AMD / 3,000 GBP / 1,000 USD). We re-express each amount in the
// chosen currency in place, so a mixed cell like "316,000 AMD personal + $1,000 +VAT" converts
// every figure while keeping the words around them.
const MONEY_RE = /([£$])\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(AMD|GBP|USD)\b/gi
const SYM2CODE = { "£": "GBP", "$": "USD" }
const fmtCur = (v, code) => {
  const r = Math.round(v * 100) / 100
  const dp = Math.round(r * 100) % 100 === 0 ? 0 : 2          // cents only when needed
  const num = r.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return code === "GBP" ? "£" + num : code === "USD" ? "$" + num : num + " AMD"
}

export default function Sheets() {
  const { db, saveSheets, readOnly, ask, notify, usdToGbp, usdToAmd } = useStore()
  const sheets = db.sheets || []
  const fileRef = useRef(null)

  // currency toggle for the Tables section (USD / GBP / AMD — independent of the Finance toggle).
  // every money amount inside a cell re-displays in the chosen currency; the stored value stays
  // in its native currency, and while a cell is being edited we show its native value so editing
  // never corrupts the data.
  const [editKey, setEditKey] = useState(null)
  // currency is chosen *per table* (default "" = Original → the file's own values, untouched).
  // kept in session state keyed by table id, so each table converts independently and a freshly
  // imported table starts in Original.
  const [curMap, setCurMap] = useState({})
  const setCur = (sid, c) => setCurMap(m => ({ ...m, [sid]: c }))
  const RATE = { USD: 1, GBP: usdToGbp || 0.79, AMD: usdToAmd || 388 }   // 1 USD = RATE[code] units
  // re-express every money amount inside a cell in `target` currency (display only); null → as-is.
  const convOf = (raw, target) => {
    if (!target) return null                                 // Original mode → leave every cell exactly as imported
    const t = String(raw ?? "")
    if (!t || !/[£$]|AMD|GBP|USD/i.test(t)) return null      // no money mentioned → show original
    let changed = false
    const out = t.replace(MONEY_RE, (m, sym, n1, n2, code) => {
      const from = sym ? SYM2CODE[sym] : String(code).toUpperCase()
      const num = parseFloat(String(sym ? n1 : n2).replace(/,/g, ""))
      if (!isFinite(num)) return m
      if (from !== target) changed = true
      return fmtCur(num / (RATE[from] || 1) * (RATE[target] || 1), target)
    })
    return changed ? out : null                              // nothing actually converted → keep original formatting
  }

  const commit = (next) => saveSheets(next)
  // per-table undo history (in-memory, this session). every edit snapshots that table first.
  const histRef = useRef({})
  const patch = (sid, fn) => {
    const cur = sheets.find(s => s.id === sid)
    if (cur) { const st = histRef.current[sid] || (histRef.current[sid] = []); st.push(cur); if (st.length > 80) st.shift() }
    commit(sheets.map(s => s.id === sid ? fn(s) : s))
  }
  const undo = (sid) => {
    const st = histRef.current[sid]; if (!st || !st.length) return
    const prev = st.pop()
    commit(sheets.map(s => s.id === sid ? prev : s))
  }
  const canUndo = (sid) => !!(histRef.current[sid] && histRef.current[sid].length)

  const addTable = () => commit([...sheets, mkSheet()])
  const delTable = async (sid) => {
    if (await ask({ title: "Delete table", message: "Delete this table and everything in it?", confirmText: "Delete" }))
      commit(sheets.filter(s => s.id !== sid))
  }
  const renameTable = (sid, name) => patch(sid, s => ({ ...s, name }))

  // ── hand-made (simple) table ops ──
  const addRow = (sid) => patch(sid, s => ({ ...s, rows: [...s.rows, { id: uid("r"), cells: {} }] }))
  const insertRow = (sid, at) => patch(sid, s => { const rows = [...s.rows]; rows.splice(at, 0, { id: uid("r"), cells: {} }); return { ...s, rows } })
  const delRow = (sid, rid) => patch(sid, s => ({ ...s, rows: s.rows.filter(r => r.id !== rid) }))
  const addCol = (sid) => patch(sid, s => ({ ...s, columns: [...s.columns, { id: uid("c"), name: "Column " + (s.columns.length + 1) }] }))
  const delCol = (sid, cid) => patch(sid, s => ({
    ...s,
    columns: s.columns.filter(c => c.id !== cid),
    rows: s.rows.map(r => { const { [cid]: _drop, ...rest } = (r.cells || {}); return { ...r, cells: rest } }),
  }))
  const renameCol = (sid, cid, name) => patch(sid, s => ({ ...s, columns: s.columns.map(c => c.id === cid ? { ...c, name } : c) }))
  const setCell = (sid, rid, cid, value) => patch(sid, s => ({
    ...s,
    rows: s.rows.map(r => {
      if (r.id !== rid) return r
      const prev = (r.cells || {})[cid]
      const next = (prev && typeof prev === "object") ? { ...prev, v: value } : value
      return { ...r, cells: { ...(r.cells || {}), [cid]: next } }
    }),
  }))

  // ── imported (rich, Google-Sheets-faithful) table ops ──
  const setRichCell = (sid, ri, ci, v) => {
    const s = sheets.find(x => x.id === sid); if (!s || !s.grid) return
    const cur = s.grid[ri]?.[ci]; if (!cur || (cur.v ?? "") === v) return
    patch(sid, s => ({ ...s, grid: s.grid.map((row, r) => r !== ri ? row : row.map((cell, c) => (c !== ci || !cell) ? cell : { ...cell, v })) }))
  }
  const emptyRichRow = (s) => (s.widths || []).map(() => ({ v: "" }))
  const addRichRow = (sid) => patch(sid, s => ({ ...s, grid: [...s.grid, emptyRichRow(s)] }))
  const insertRichRow = (sid, at) => patch(sid, s => { const g = [...s.grid]; g.splice(at, 0, emptyRichRow(s)); return { ...s, grid: g } })
  const delRichRow = (sid, ri) => patch(sid, s => ({ ...s, grid: s.grid.filter((_, r) => r !== ri) }))

  const importExcel = async (file) => {
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const mod = await import("exceljs"); const ExcelJS = mod.default || mod
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)
      const fileBase = file.name.replace(/\.[^.]+$/, "")
      const made = []

      const listOpts = (ws, cell) => {
        const dv = cell.dataValidation
        if (!dv || dv.type !== "list" || !dv.formulae || !dv.formulae.length) return null
        let f = String(dv.formulae[0] ?? "").trim().replace(/^=/, "")
        if (!f) return null
        if (f.startsWith('"') && f.endsWith('"')) return f.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean)
        try {
          let sheet = ws
          const bang = f.indexOf("!")
          if (bang >= 0) { sheet = wb.getWorksheet(f.slice(0, bang).replace(/^'|'$/g, "")) || ws; f = f.slice(bang + 1) }
          const m = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/.exec(f)
          if (!m) return null
          const c1 = colToNum(m[1]), r1 = +m[2], c2 = colToNum(m[3]), r2 = +m[4]
          const out = []
          for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
            for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
              const cc = sheet.getCell(r, c)
              let t = ""; try { t = cc.text != null ? String(cc.text) : "" } catch (e) { t = "" }
              if (!t) t = cellToStr(cc.value)
              if (String(t).trim()) out.push(String(t).trim())
            }
          return out.length ? [...new Set(out)] : null
        } catch (e) { return null }
      }

      wb.eachSheet((ws) => {
        const rowCount = Math.min(ws.rowCount || 0, 4000)
        const colCount = Math.min(ws.columnCount || 0, 80)
        if (!rowCount || !colCount) return

        const { spanAt, covered } = mergeSpans(ws.model?.merges)
        const cellTextAt = (r, c) => {
          const cell = ws.getCell(r, c)
          const cv = cell.value
          if (cv instanceof Date) return cv.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          let t = ""; try { t = cell.text != null ? String(cell.text) : "" } catch (e) { t = "" }
          return t || cellToStr(cv)
        }

        // conditional formatting → value-based colour
        const cfMap = new Map()
        for (const cf of (ws.conditionalFormattings || [])) {
          const ranges = String(cf.ref || "").split(/\s+/).map(parseRangeStr).filter(Boolean)
          const rules = [...(cf.rules || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0))
          for (const rng of ranges)
            for (let r = rng.top; r <= Math.min(rng.bottom, rowCount); r++)
              for (let c = rng.left; c <= Math.min(rng.right, colCount); c++) {
                const key = r + "_" + c
                if (cfMap.has(key)) continue
                const t = cellTextAt(r, c)
                for (const rule of rules) { if (cfRuleMatches(rule, t)) { const st = cfRuleColors(rule); if (st) cfMap.set(key, st); break } }
              }
        }

        // full faithful grid (every row, merges kept as spans)
        const grid = []
        for (let r = 1; r <= rowCount; r++) {
          const row = []
          for (let c = 1; c <= colCount; c++) {
            if (covered.has(r + "_" + c)) { row.push(null); continue }
            const cell = ws.getCell(r, c)
            const o = { v: cellTextAt(r, c), ...styleOf(cell) }
            const cf = cfMap.get(r + "_" + c)
            if (cf) { if (cf.bg) o.bg = cf.bg; if (cf.fg) o.fg = cf.fg }
            if (o.fg && !o.bg) o.bg = lighten(o.fg)
            const al = cell.alignment?.horizontal; if (al === "center" || al === "right") o.al = al
            const op = listOpts(ws, cell); if (op) o.opts = op
            const span = spanAt.get(r + "_" + c); if (span) { o.cs = span.cs; o.rs = span.rs }
            row.push(o)
          }
          grid.push(row)
        }
        while (grid.length && grid[grid.length - 1].every(c => !c || (!(c.v || "").trim() && !c.bg))) grid.pop()
        if (!grid.length) return

        // effective column count (trim empty trailing columns, but keep merge ends)
        let cols = 0
        grid.forEach(row => row.forEach((c, i) => { if (c) { const end = i + (c.cs || 1); if ((c.v || "").trim() !== "" || c.bg) cols = Math.max(cols, end) } }))
        cols = Math.min(Math.max(cols, 1), colCount)

        // widen each column to fit its content (less wrapping → short rows). The file's own
        // width is a floor; wide columns are fine because the grid scrolls horizontally.
        const widths = []
        for (let i = 0; i < cols; i++) {
          const w = ws.getColumn(i + 1)?.width
          const floor = w ? Math.round(w * 7 + 5) : 80
          let maxChars = 4
          for (let r = 0; r < grid.length; r++) {
            const cell = grid[r][i]
            if (!cell || (cell.cs && cell.cs > 1)) continue   // ignore merged spanners
            const longest = String(cell.v || "").split("\n").reduce((m, l) => Math.max(m, l.length), 0)
            if (longest > maxChars) maxChars = longest
          }
          const fit = Math.min(640, maxChars * 6.5 + 18)   // wide enough to keep most text on one line
          widths.push(Math.max(64, Math.min(660, Math.max(floor, fit))))
        }

        // value → colour map per column index, so dropdown cells recolour live when changed
        const colColors = []
        for (let i = 0; i < cols; i++) {
          let map = null
          for (let r = 0; r < grid.length; r++) {
            const cell = grid[r][i]
            if (!cell || !(cell.opts && cell.opts.length)) continue
            const key = String(cell.v ?? "").trim(); if (!key) continue
            if (cell.bg || cell.fg) { map = map || {}; if (!map[key]) map[key] = { ...(cell.fg ? { fg: cell.fg } : {}), bg: cell.bg || lighten(cell.fg) } }
          }
          colColors.push(map)
        }

        made.push({
          id: uid("sh"), name: ws.name || fileBase || "Imported table", imported: true, rich: true,
          widths: widths.slice(0, cols), grid: grid.map(row => row.slice(0, cols)), colColors,
        })
      })

      if (!made.length) { notify?.("Couldn’t find any data in that file.", "info"); return }
      commit([...sheets, ...made])                           // new tables aren't in curMap → they start in Original automatically
      notify?.(`Imported ${made.length} table${made.length > 1 ? "s" : ""} from ${file.name}.`, "success")
    } catch (e) {
      console.error("Excel import failed:", e)
      notify?.("Couldn’t read that file — make sure it’s a .xlsx spreadsheet.", "error")
    }
  }

  // per-table currency switcher (Original = the file's own values; pick one to convert all amounts)
  const curSeg = (sid) => {
    const active = curMap[sid] || ""
    return (
      <span style={{ display: "inline-flex", border: "1px solid var(--line-strong)", borderRadius: 9, overflow: "hidden" }}
        title="Original keeps this table's imported values; pick a currency to convert every amount in it">
        {[["", "Original"], ["USD", "$ USD"], ["GBP", "£ GBP"], ["AMD", "֏ AMD"]].map(([code, label]) => (
          <button key={code || "orig"} onClick={() => setCur(sid, code)}
            style={{
              padding: "5px 10px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: active === code ? "var(--accent)" : "transparent",
              color: active === code ? "#fff" : "var(--muted)",
            }}>{label}</button>
        ))}
      </span>
    )
  }

  // head markup for a table card — a plain element (not a nested component, which would remount)
  const headOf = (s) => (
    <div className={styles.head}>
      {readOnly
        ? <h2 className={styles.title}>{s.name || "Untitled table"}{s.imported && <span className={styles.tag}>imported</span>}</h2>
        : <input className={styles.titleInput} value={s.name} onChange={e => renameTable(s.id, e.target.value)} placeholder="Table name" />}
      <div className={styles.headActions}>
        {curSeg(s.id)}
        {!readOnly && (<>
          {s.rich
            ? <button className="btn ghost sm" onClick={() => addRichRow(s.id)}><Icon name="plus" size={13} /> Row</button>
            : <button className="btn ghost sm" onClick={() => addCol(s.id)}><Icon name="columns" size={13} /> Column</button>}
          <button className="iconbtn" onClick={() => undo(s.id)} disabled={!canUndo(s.id)} title="Undo last change in this table"
            style={{ opacity: canUndo(s.id) ? 1 : 0.4 }}><Icon name="undo" size={16} /></button>
          <button className="iconbtn del" onClick={() => delTable(s.id)} title="Delete table"><Icon name="trash" size={16} /></button>
        </>)}
      </div>
    </div>
  )

  return (
    <div>
      {!readOnly && (
        <div className={styles.topbar}>
          <button className="btn" onClick={addTable}><Icon name="plus" size={16} /> Add table</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> Import Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm" style={{ display: "none" }}
            onChange={e => { importExcel(e.target.files[0]); e.target.value = "" }} />
          {sheets.length > 0 && <span className="muted" style={{ fontSize: 12.5, marginInlineStart: "auto" }}>{sheets.length} table{sheets.length > 1 ? "s" : ""}</span>}
        </div>
      )}

      {sheets.length === 0 ? (
        <div className="panel">
          <EmptyState icon="table" text={readOnly ? "No tables here yet" : "No tables yet — add one or import an Excel file"} />
        </div>
      ) : sheets.map(s => s.rich ? (() => {
        /* ── faithful imported grid: merged headers, colours, widths, multi-line ── */
        // force the table to the full sum of its column widths so columns never compress
        // to fit the panel — that keeps them wide (short rows) and makes the grid scroll sideways
        const tableW = 46 + (s.widths || []).reduce((a, b) => a + (b || 0), 0)
        return (
        <div className="panel" key={s.id}>
          {headOf(s)}
          <div className={styles.richScroll}>
            <table className={styles.richTable} style={{ width: tableW, minWidth: tableW }}>
              <colgroup><col style={{ width: 46 }} />{(s.widths || []).map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <tbody>
                {(s.grid || []).map((row, ri) => (
                  <tr key={ri} className={styles.richRow}>
                    <td className={styles.richIdx}>
                      <span className={styles.idxNum}>{ri + 1}</span>
                      {!readOnly && (
                        <div className={styles.rowTools}>
                          <button className={styles.rtIns} onClick={() => insertRichRow(s.id, ri + 1)} title="Insert row below"><Icon name="plus" size={12} /></button>
                          <button className={styles.rtDel} onClick={() => delRichRow(s.id, ri)} title="Delete row"><Icon name="trash" size={12} /></button>
                        </div>
                      )}
                    </td>
                    {row.map((cell, ci) => {
                      if (cell === null) return null
                      const isDrop = cell.opts && cell.opts.length
                      const cm = (isDrop && s.colColors?.[ci]) ? s.colColors[ci][(cell.v || "").trim()] : null
                      const bg = cm?.bg || cell.bg
                      const fg = cm?.fg || cell.fg
                      const ink = { color: fg || (bg ? "#1f2328" : undefined), fontWeight: cell.b ? 700 : undefined, textAlign: cell.al || undefined }
                      const cs = Math.min(cell.cs || 1, (s.widths || []).length - ci)
                      const conv = isDrop ? null : convOf(cell.v, curMap[s.id] || "")
                      const ekey = s.id + ":" + ri + ":" + ci
                      const shown = (conv && editKey !== ekey) ? conv : cell.v
                      return (
                        <td key={ci} colSpan={cs} rowSpan={cell.rs || 1} style={bg ? { background: bg } : undefined}>
                          {readOnly
                            ? <div className={styles.richCellBox} style={ink}>{conv || cell.v}</div>
                            : isDrop
                              ? (
                                <select className={styles.richSelect} value={cell.v || ""} style={ink} onChange={e => setRichCell(s.id, ri, ci, e.target.value)}>
                                  <option value=""></option>
                                  {cell.v && !cell.opts.includes(cell.v) && <option value={cell.v}>{cell.v}</option>}
                                  {cell.opts.map(op => <option key={op} value={op}>{op}</option>)}
                                </select>
                              )
                              : <div className={styles.richCellBox} style={ink} contentEditable suppressContentEditableWarning
                                  onFocus={() => { if (conv) setEditKey(ekey) }}
                                  onBlur={e => {
                                    setEditKey(k => k === ekey ? null : k)
                                    const v = e.currentTarget.innerText.replace(/\n$/, "")
                                    if (conv && v === conv) return   // not edited (still the converted display) → keep the native value, never overwrite with the converted text
                                    setRichCell(s.id, ri, ci, v)
                                  }}>{shown}</div>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && <button className={styles.addRow} onClick={() => addRichRow(s.id)}><Icon name="plus" size={14} /> Add row</button>}
        </div>
        )
      })() : (
        /* ── hand-made simple table ── */
        <div className="panel" key={s.id}>
          {headOf(s)}
          <div className={styles.scroll}>
            <div className={styles.grid}>
              <div className={`${styles.row} ${styles.header}`}>
                <div className={styles.idxHead}>#</div>
                {(s.columns || []).map(c => (
                  <div className={styles.cell} key={c.id}>
                    {readOnly
                      ? <span className={styles.colName}>{c.name}</span>
                      : (
                        <div className={styles.colHead}>
                          <input value={c.name} onChange={e => renameCol(s.id, c.id, e.target.value)} placeholder="Column" />
                          {s.columns.length > 1 && <button className={styles.colDel} onClick={() => delCol(s.id, c.id)} title="Delete column"><Icon name="trash" size={12} /></button>}
                        </div>
                      )}
                  </div>
                ))}
              </div>
              {(s.rows || []).map((r, ri) => (
                <div className={`${styles.row} ${ri % 2 ? styles.alt : ""}`} key={r.id}>
                  <div className={`${styles.idx} ${!readOnly ? styles.idxEdit : ""}`}>
                    <span className={styles.idxNum}>{ri + 1}</span>
                    {!readOnly && (<>
                      <button className={styles.rowDel} onClick={() => delRow(s.id, r.id)} title="Delete row"><Icon name="trash" size={12} /></button>
                      <button className={styles.rowIns} onClick={() => insertRow(s.id, ri + 1)} title="Insert row below"><Icon name="plus" size={12} /></button>
                    </>)}
                  </div>
                  {(s.columns || []).map(c => {
                    const raw = (r.cells || {})[c.id]
                    const txt = cellText(raw)
                    const conv = convOf(txt, curMap[s.id] || "")
                    const ekey = s.id + ":" + r.id + ":" + c.id
                    return (
                      <div className={styles.cell} key={c.id}>
                        {readOnly
                          ? <span className={styles.val}>{conv || txt}</span>
                          : <input value={(conv && editKey !== ekey) ? conv : txt}
                              onFocus={() => { if (conv) setEditKey(ekey) }}
                              onBlur={() => setEditKey(k => k === ekey ? null : k)}
                              onChange={e => setCell(s.id, r.id, c.id, e.target.value)} />}
                      </div>
                    )
                  })}
                </div>
              ))}
              {(s.rows || []).length === 0 && <div className={styles.emptyRow}>No rows yet</div>}
            </div>
          </div>
          {!readOnly && <button className={styles.addRow} onClick={() => addRow(s.id)}><Icon name="plus" size={14} /> Add row</button>}
        </div>
      ))}
    </div>
  )
}
