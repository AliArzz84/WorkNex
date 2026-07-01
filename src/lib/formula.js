// A small spreadsheet formula engine. It parses and evaluates the Excel formulas we keep from an
// imported .xlsx so the app recomputes them live — like Excel. It covers the common functions
// (maths, logic, text, lookup, COUNT/SUM families, …); anything it can't handle throws, and the
// caller falls back to the value Excel cached at import time, so nothing ever breaks.

const colToNum = (s) => { let n = 0; for (const ch of s) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64); return n }

// ── tokenizer ──
const tokenize = (src, sheetName) => {
  const toks = []; let i = 0; const s = src
  const isD = (c) => c >= "0" && c <= "9"
  const isA = (c) => (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_"
  // a qualifier resolves locally only if it names *this* sheet; a real other-sheet ref bails
  // (→ caller keeps Excel's cached value). Unknown sheet name → resolve locally (best effort).
  const sameSheet = (nm) => !sheetName || String(nm).trim().toLowerCase() === String(sheetName).trim().toLowerCase()
  while (i < s.length) {
    const c = s[i]
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue }
    if (c === '"') {
      let j = i + 1, str = ""
      while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { str += '"'; j += 2; continue } j++; break } str += s[j]; j++ }
      toks.push({ k: "str", v: str }); i = j; continue
    }
    if (isD(c) || (c === "." && isD(s[i + 1]))) {
      let j = i, num = ""
      while (j < s.length && (isD(s[j]) || s[j] === ".")) { num += s[j]; j++ }
      if (s[j] === "e" || s[j] === "E") { num += s[j]; j++; if (s[j] === "+" || s[j] === "-") { num += s[j]; j++ } while (j < s.length && isD(s[j])) { num += s[j]; j++ } }
      toks.push({ k: "num", v: parseFloat(num) }); i = j; continue
    }
    // a 'Sheet Name'! qualifier — drop it (resolve locally) if it's this sheet, else bail
    if (c === "'") {
      let j = i + 1, nm = ""
      while (j < s.length && s[j] !== "'") { nm += s[j]; j++ }
      j++                       // past the closing quote
      if (s[j] === "!") { if (!sameSheet(nm)) throw new Error("cross-sheet"); j++ }
      i = j; continue
    }
    if (isA(c) || c === "$") {
      let j = i, name = ""
      while (j < s.length && (isA(s[j]) || isD(s[j]) || s[j] === "$" || s[j] === ".")) { name += s[j]; j++ }
      if (s[j] === "!") { if (!sameSheet(name)) throw new Error("cross-sheet"); i = j + 1; continue }   // Sheet!Ref → drop, resolve locally
      const up = name.toUpperCase()
      if (up === "TRUE") { toks.push({ k: "bool", v: true }); i = j; continue }
      if (up === "FALSE") { toks.push({ k: "bool", v: false }); i = j; continue }
      let kk = j; while (kk < s.length && s[kk] === " ") kk++
      if (s[kk] === "(") { toks.push({ k: "func", v: up }); i = j; continue }
      toks.push({ k: "ref", v: name.replace(/\$/g, "").toUpperCase() }); i = j; continue
    }
    const two = s.slice(i, i + 2)
    if (two === "<=" || two === ">=" || two === "<>") { toks.push({ k: "op", v: two }); i += 2; continue }
    if ("+-*/^&%=<>():,".includes(c)) { toks.push({ k: "op", v: c }); i++; continue }
    i++ // skip anything unexpected
  }
  return toks
}

// ── parser (precedence climbing) ──
const BIN = { "=": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "<>": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 }
// a range endpoint: a full cell (B4), a whole column (B → row null) or a whole row (4 → col null)
const endpoint = (r) => { const m = /^([A-Z]*)(\d*)$/.exec(r); if (!m || (!m[1] && !m[2])) throw new Error("bad ref " + r); return { col: m[1] ? colToNum(m[1]) : null, row: m[2] ? +m[2] : null } }

function parse(toks) {
  let p = 0
  const peek = () => toks[p]
  const eat = () => toks[p++]
  const expect = (v) => { const t = eat(); if (!t || t.v !== v) throw new Error("expected " + v); return t }

  const parseAtom = () => {
    const t = peek(); if (!t) throw new Error("unexpected end")
    if (t.k === "num") { eat(); return { k: "num", v: t.v } }
    if (t.k === "str") { eat(); return { k: "str", v: t.v } }
    if (t.k === "bool") { eat(); return { k: "bool", v: t.v } }
    if (t.k === "op" && t.v === "(") { eat(); const e = parseExpr(0); expect(")"); return e }
    if (t.k === "func") {
      eat(); expect("("); const args = []
      if (peek() && peek().v !== ")") { args.push(parseExpr(0)); while (peek() && peek().v === ",") { eat(); args.push(parseExpr(0)) } }
      expect(")"); return { k: "func", name: t.v, args }
    }
    if (t.k === "ref") {
      eat()
      if (peek() && peek().v === ":") { eat(); const b = eat(); if (!b || b.k !== "ref") throw new Error("bad range"); return { k: "range", a: endpoint(t.v), b: endpoint(b.v) } }
      const e = endpoint(t.v); if (e.row == null || e.col == null) throw new Error("bad ref " + t.v)
      return { k: "ref", r: e.row, c: e.col }
    }
    throw new Error("unexpected " + JSON.stringify(t))
  }
  const parsePostfix = () => { let x = parseAtom(); while (peek() && peek().v === "%") { eat(); x = { k: "post", op: "%", x } } return x }
  const parseUnary = () => { const t = peek(); if (t && t.k === "op" && (t.v === "-" || t.v === "+")) { eat(); return { k: "un", op: t.v, x: parseUnary() } } return parsePostfix() }
  const parseExpr = (min) => {
    let left = parseUnary()
    while (true) {
      const t = peek(); if (!t || t.k !== "op" || !(t.v in BIN)) break
      const prec = BIN[t.v]; if (prec < min) break
      eat(); const right = parseExpr(t.v === "^" ? prec : prec + 1)
      left = { k: "bin", op: t.v, a: left, b: right }
    }
    return left
  }
  const ast = parseExpr(0)
  if (p < toks.length) throw new Error("trailing tokens")
  return ast
}

// ── evaluation ──
class Rng { constructor(cells) { this.cells = cells } flat() { const o = []; for (const row of this.cells) for (const v of row) o.push(v); return o } }
const isNum = (x) => typeof x === "number" && isFinite(x)
const asNum = (x) => {
  if (x == null || x === "") return 0
  if (typeof x === "number") return x
  if (typeof x === "boolean") return x ? 1 : 0
  const s = String(x).replace(/,/g, "").trim()
  if (/^-?\d*\.?\d+(?:e[+-]?\d+)?$/i.test(s)) return parseFloat(s)
  throw new Error("not a number: " + x)
}
const asStr = (x) => x == null ? "" : (typeof x === "boolean" ? (x ? "TRUE" : "FALSE") : String(x))
const asBool = (x) => { if (typeof x === "boolean") return x; if (typeof x === "number") return x !== 0; const s = String(x).trim().toUpperCase(); if (s === "TRUE") return true; if (s === "FALSE" || s === "") return false; return true }
const nums = (args) => { const o = []; for (const a of args) { if (a instanceof Rng) { for (const v of a.flat()) if (isNum(v)) o.push(v) } else if (isNum(a)) o.push(a); else if (typeof a === "string" && a.trim() !== "") { const n = Number(a.replace(/,/g, "")); if (isFinite(n)) o.push(n) } else if (typeof a === "boolean") o.push(a ? 1 : 0) } return o }
// wrap a scalar arg as a 1×1 range so the *IF/*IFS helpers accept single cells too (like COUNTIF does)
const asRng = (x) => x instanceof Rng ? x : new Rng([[x]])

// COUNTIF/SUMIF criteria: exact (case-insensitive), number, comparison (>5, <>0…), or wildcard
const matchCrit = (val, crit) => {
  const c = String(crit ?? "").trim()
  const cmp = /^(<=|>=|<>|<|>|=)(.*)$/.exec(c)
  if (cmp) {
    const op = cmp[1], rhs = cmp[2].trim()
    const rn = Number(rhs.replace(/,/g, "")), vn = (typeof val === "number") ? val : Number(String(val).replace(/,/g, ""))
    if (isFinite(rn) && isFinite(vn) && rhs !== "") {
      if (op === ">") return vn > rn; if (op === "<") return vn < rn; if (op === ">=") return vn >= rn
      if (op === "<=") return vn <= rn; if (op === "<>") return vn !== rn; return vn === rn
    }
    const vs = String(val ?? "").trim().toLowerCase(), rs = rhs.toLowerCase()
    return op === "<>" ? vs !== rs : op === "=" ? vs === rs : false
  }
  const vn = (typeof val === "number") ? val : (String(val).trim() !== "" && isFinite(Number(String(val).replace(/,/g, ""))) ? Number(String(val).replace(/,/g, "")) : null)
  const cn = c !== "" && isFinite(Number(c.replace(/,/g, ""))) ? Number(c.replace(/,/g, "")) : null
  if (vn !== null && cn !== null) return vn === cn
  if (/[*?]/.test(c)) { const re = new RegExp("^" + c.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i"); return re.test(String(val ?? "").trim()) }
  return String(val ?? "").trim().toLowerCase() === c.toLowerCase()
}
const ifSum = (pairs, target) => {
  // pairs: [[Rng|cell, crit], …]; target: Rng|cell to aggregate (or null → count). returns matching values of target
  const flats = pairs.map(([rg, cr]) => [asRng(rg).flat(), cr])   // flatten once; accept single cells
  const base = flats[0][0]
  const tf = target ? asRng(target).flat() : null
  const out = []
  for (let i = 0; i < base.length; i++) {
    if (flats.every(([f, cr]) => matchCrit(f[i], cr))) out.push(tf ? tf[i] : 1)
  }
  return out
}

const FN = {
  SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
  PRODUCT: (a) => nums(a).reduce((x, y) => x * y, 1),
  AVERAGE: (a) => { const n = nums(a); if (!n.length) throw new Error("div0"); return n.reduce((x, y) => x + y, 0) / n.length },
  MIN: (a) => { const n = nums(a); return n.length ? Math.min(...n) : 0 },
  MAX: (a) => { const n = nums(a); return n.length ? Math.max(...n) : 0 },
  MEDIAN: (a) => { const n = nums(a).sort((x, y) => x - y); if (!n.length) throw new Error("n/a"); const m = Math.floor(n.length / 2); return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2 },
  COUNT: (a) => nums(a).length,
  COUNTA: (a) => { let n = 0; for (const x of a) { if (x instanceof Rng) { for (const v of x.flat()) if (!(v === "" || v == null)) n++ } else if (!(x === "" || x == null)) n++ } return n },
  COUNTBLANK: (a) => { let n = 0; for (const v of (a[0] instanceof Rng ? a[0].flat() : a)) if (v === "" || v == null) n++; return n },
  COUNTIF: (a) => { const r = a[0] instanceof Rng ? a[0] : new Rng([[a[0]]]); return r.flat().filter(v => matchCrit(v, a[1])).length },
  COUNTIFS: (a) => { const pairs = []; for (let i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); return ifSum(pairs, null).length },
  SUMIF: (a) => { const rg = asRng(a[0]), crit = a[1], sr = asRng(a[2] || a[0]); const rf = rg.flat(), sf = sr.flat(); let s = 0; for (let i = 0; i < rf.length; i++) if (matchCrit(rf[i], crit) && isNum(sf[i])) s += sf[i]; return s },
  SUMIFS: (a) => { const target = a[0]; const pairs = []; for (let i = 1; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); return nums([new Rng([ifSum(pairs, target)])]).reduce((x, y) => x + y, 0) },
  AVERAGEIF: (a) => { const rg = asRng(a[0]), crit = a[1], sr = asRng(a[2] || a[0]); const rf = rg.flat(), sf = sr.flat(); const picked = []; for (let i = 0; i < rf.length; i++) if (matchCrit(rf[i], crit) && isNum(sf[i])) picked.push(sf[i]); if (!picked.length) throw new Error("div0"); return picked.reduce((x, y) => x + y, 0) / picked.length },
  MAXIFS: (a) => { const target = a[0]; const pairs = []; for (let i = 1; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); const v = nums([new Rng([ifSum(pairs, target)])]); return v.length ? Math.max(...v) : 0 },
  MINIFS: (a) => { const target = a[0]; const pairs = []; for (let i = 1; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); const v = nums([new Rng([ifSum(pairs, target)])]); return v.length ? Math.min(...v) : 0 },
  IF: (a) => asBool(scalar(a[0])) ? a[1] : (a.length > 2 ? a[2] : false),
  IFS: (a) => { for (let i = 0; i + 1 < a.length; i += 2) if (asBool(scalar(a[i]))) return a[i + 1]; throw new Error("n/a") },
  IFERROR: (a) => a[0],   // errors are caught before args resolve; see eval wrapper
  IFNA: (a) => a[0],
  AND: (a) => a.length ? a.every(x => asBool(x instanceof Rng ? x.flat().every(asBool) : x)) : true,
  OR: (a) => a.some(x => x instanceof Rng ? x.flat().some(asBool) : asBool(x)),
  NOT: (a) => !asBool(scalar(a[0])),
  XOR: (a) => a.reduce((acc, x) => acc ^ (asBool(scalar(x)) ? 1 : 0), 0) === 1,
  ROUND: (a) => { const d = asNum(scalar(a[1] ?? 0)); const f = 10 ** d; return Math.round(asNum(scalar(a[0])) * f) / f },
  ROUNDUP: (a) => { const d = asNum(scalar(a[1] ?? 0)); const f = 10 ** d; const n = asNum(scalar(a[0])); return (n < 0 ? -Math.ceil(-n * f) : Math.ceil(n * f)) / f },
  ROUNDDOWN: (a) => { const d = asNum(scalar(a[1] ?? 0)); const f = 10 ** d; const n = asNum(scalar(a[0])); return (n < 0 ? -Math.floor(-n * f) : Math.floor(n * f)) / f },
  INT: (a) => Math.floor(asNum(scalar(a[0]))),
  TRUNC: (a) => { const n = asNum(scalar(a[0])); return n < 0 ? Math.ceil(n) : Math.floor(n) },
  ABS: (a) => Math.abs(asNum(scalar(a[0]))),
  MOD: (a) => { const n = asNum(scalar(a[0])), d = asNum(scalar(a[1])); return n - Math.floor(n / d) * d },
  CEILING: (a) => { const n = asNum(scalar(a[0])), s = asNum(scalar(a[1] ?? 1)); return s === 0 ? 0 : Math.ceil(n / s) * s },
  FLOOR: (a) => { const n = asNum(scalar(a[0])), s = asNum(scalar(a[1] ?? 1)); return s === 0 ? 0 : Math.floor(n / s) * s },
  SQRT: (a) => Math.sqrt(asNum(scalar(a[0]))),
  POWER: (a) => Math.pow(asNum(scalar(a[0])), asNum(scalar(a[1]))),
  EXP: (a) => Math.exp(asNum(scalar(a[0]))),
  LN: (a) => Math.log(asNum(scalar(a[0]))),
  LOG10: (a) => Math.log10(asNum(scalar(a[0]))),
  LOG: (a) => { const n = asNum(scalar(a[0])); const b = a.length > 1 ? asNum(scalar(a[1])) : 10; return Math.log(n) / Math.log(b) },
  SIGN: (a) => Math.sign(asNum(scalar(a[0]))),
  SUMPRODUCT: (a) => { const arrs = a.map(x => (x instanceof Rng ? x.flat() : [x]).map(v => isNum(v) ? v : Number(String(v).replace(/,/g, "")) || 0)); const n = Math.min(...arrs.map(x => x.length)); let s = 0; for (let i = 0; i < n; i++) s += arrs.reduce((p, arr) => p * arr[i], 1); return s },
  CONCAT: (a) => a.map(x => x instanceof Rng ? x.flat().map(asStr).join("") : asStr(x)).join(""),
  CONCATENATE: (a) => a.map(x => x instanceof Rng ? x.flat().map(asStr).join("") : asStr(x)).join(""),
  TEXTJOIN: (a) => { const d = asStr(scalar(a[0])); const skip = asBool(scalar(a[1])); const parts = []; for (let i = 2; i < a.length; i++) { const vs = a[i] instanceof Rng ? a[i].flat() : [a[i]]; for (const v of vs) { if (skip && (v === "" || v == null)) continue; parts.push(asStr(v)) } } return parts.join(d) },
  LEFT: (a) => asStr(scalar(a[0])).slice(0, a.length > 1 ? asNum(scalar(a[1])) : 1),
  RIGHT: (a) => { const s = asStr(scalar(a[0])); const n = a.length > 1 ? asNum(scalar(a[1])) : 1; return n === 0 ? "" : s.slice(-n) },
  MID: (a) => asStr(scalar(a[0])).substr(asNum(scalar(a[1])) - 1, asNum(scalar(a[2]))),
  LEN: (a) => asStr(scalar(a[0])).length,
  LOWER: (a) => asStr(scalar(a[0])).toLowerCase(),
  UPPER: (a) => asStr(scalar(a[0])).toUpperCase(),
  TRIM: (a) => asStr(scalar(a[0])).replace(/\s+/g, " ").trim(),
  PROPER: (a) => asStr(scalar(a[0])).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  REPT: (a) => asStr(scalar(a[0])).repeat(Math.max(0, asNum(scalar(a[1])))),
  SUBSTITUTE: (a) => { const s = asStr(scalar(a[0])), o = asStr(scalar(a[1])), n = asStr(scalar(a[2])); return o === "" ? s : s.split(o).join(n) },
  EXACT: (a) => asStr(scalar(a[0])) === asStr(scalar(a[1])),
  FIND: (a) => { const idx = asStr(scalar(a[1])).indexOf(asStr(scalar(a[0])), (a[2] ? asNum(scalar(a[2])) - 1 : 0)); if (idx < 0) throw new Error("n/a"); return idx + 1 },
  SEARCH: (a) => { const idx = asStr(scalar(a[1])).toLowerCase().indexOf(asStr(scalar(a[0])).toLowerCase(), (a[2] ? asNum(scalar(a[2])) - 1 : 0)); if (idx < 0) throw new Error("n/a"); return idx + 1 },
  VALUE: (a) => asNum(scalar(a[0])),
  TEXT: (a) => { const n = asNum(scalar(a[0])); const fmt = asStr(scalar(a[1])); const dec = (fmt.split(".")[1] || "").replace(/[^0#]/g, "").length; const grp = /[#0],[#0]/.test(fmt) || /,/.test(fmt); return n.toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grp }) },
  N: (a) => { const v = scalar(a[0]); return isNum(v) ? v : (typeof v === "boolean" ? (v ? 1 : 0) : 0) },
  ISBLANK: (a) => { const v = scalar(a[0]); return v === "" || v == null },
  ISNUMBER: (a) => isNum(scalar(a[0])),
  ISTEXT: (a) => typeof scalar(a[0]) === "string" && scalar(a[0]) !== "",
  ISERROR: () => false,   // errors never reach here (caught earlier)
  ISERR: () => false,
  ROWS: (a) => a[0] instanceof Rng ? a[0].cells.length : 1,
  COLUMNS: (a) => a[0] instanceof Rng ? (a[0].cells[0] ? a[0].cells[0].length : 0) : 1,
  MATCH: (a) => {
    const key = scalar(a[0]); const arr = (a[1] instanceof Rng ? a[1].flat() : [a[1]]); const type = a.length > 2 ? asNum(scalar(a[2])) : 1
    if (type === 0) { for (let i = 0; i < arr.length; i++) if (matchCrit(arr[i], key)) return i + 1; throw new Error("n/a") }
    if (type === 1) { let pos = -1; for (let i = 0; i < arr.length; i++) { if (asNum(arr[i]) <= asNum(key)) pos = i; else break } if (pos < 0) throw new Error("n/a"); return pos + 1 }
    let pos = -1; for (let i = 0; i < arr.length; i++) { if (asNum(arr[i]) >= asNum(key)) pos = i; else break } if (pos < 0) throw new Error("n/a"); return pos + 1
  },
  INDEX: (a) => { const rg = a[0]; if (!(rg instanceof Rng)) return rg; const rn = asNum(scalar(a[1] ?? 0)); const cn = a.length > 2 ? asNum(scalar(a[2])) : 0; if (rg.cells.length === 1) return rg.cells[0][(cn || rn) - 1]; if (rg.cells[0].length === 1) return rg.cells[(rn || cn) - 1][0]; return rg.cells[rn - 1][(cn || 1) - 1] },
  VLOOKUP: (a) => {
    const key = scalar(a[0]); const rg = a[1]; const idx = asNum(scalar(a[2])); const approx = a.length > 3 ? asBool(scalar(a[3])) : true
    if (!(rg instanceof Rng)) throw new Error("bad table")
    let best = -1
    for (let i = 0; i < rg.cells.length; i++) {
      const cellv = rg.cells[i][0]
      if (!approx) { if (matchCrit(cellv, key)) { return rg.cells[i][idx - 1] } }
      else { if (asNum(cellv) <= asNum(key)) best = i; else break }
    }
    if (!approx) throw new Error("n/a")
    if (best < 0) throw new Error("n/a")
    return rg.cells[best][idx - 1]
  },
  HLOOKUP: (a) => {
    const key = scalar(a[0]); const rg = a[1]; const idx = asNum(scalar(a[2])); const approx = a.length > 3 ? asBool(scalar(a[3])) : true
    if (!(rg instanceof Rng)) throw new Error("bad table")
    const head = rg.cells[0]
    for (let j = 0; j < head.length; j++) if (approx ? asNum(head[j]) === asNum(key) : matchCrit(head[j], key)) return rg.cells[idx - 1][j]
    throw new Error("n/a")
  },
}

// arguments that must be a single value (not a range)
function scalar(x) { if (x instanceof Rng) { const f = x.flat(); return f.length ? f[0] : "" } return x }

function evalNode(node, getVal) {
  switch (node.k) {
    case "num": return node.v
    case "str": return node.v
    case "bool": return node.v
    case "ref": return getVal(node.r, node.c)
    case "range": {
      // whole-column (B:B) / whole-row (4:4) endpoints clamp to the grid's used size
      const c1 = node.a.col == null ? 1 : node.a.col, c2 = node.b.col == null ? (getVal.cols || node.a.col || 1) : node.b.col
      const r1 = node.a.row == null ? 1 : node.a.row, r2 = node.b.row == null ? (getVal.rows || node.a.row || 1) : node.b.row
      const cells = []
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) { const row = []; for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) row.push(getVal(r, c)); cells.push(row) }
      return new Rng(cells)
    }
    case "un": { const v = asNum(scalar(evalNode(node.x, getVal))); return node.op === "-" ? -v : v }
    case "post": return asNum(scalar(evalNode(node.x, getVal))) / 100
    case "bin": {
      const op = node.op
      if (op === "&") return asStr(scalar(evalNode(node.a, getVal))) + asStr(scalar(evalNode(node.b, getVal)))
      const a = scalar(evalNode(node.a, getVal)), b = scalar(evalNode(node.b, getVal))
      if ("=<>".includes(op) || op === "<=" || op === ">=" || op === "<>") {
        let cmp
        if (isNum(a) && isNum(b)) cmp = a - b
        else if ((typeof a === "number") !== (typeof b === "number")) cmp = String(asStr(a)).toLowerCase() < String(asStr(b)).toLowerCase() ? -1 : (asStr(a) === asStr(b) ? 0 : 1)
        else { const x = asStr(a).toLowerCase(), y = asStr(b).toLowerCase(); cmp = x < y ? -1 : x > y ? 1 : 0 }
        switch (op) { case "=": return cmp === 0; case "<>": return cmp !== 0; case "<": return cmp < 0; case ">": return cmp > 0; case "<=": return cmp <= 0; case ">=": return cmp >= 0 }
      }
      const x = asNum(a), y = asNum(b)
      switch (op) { case "+": return x + y; case "-": return x - y; case "*": return x * y; case "/": if (y === 0) throw new Error("div0"); return x / y; case "^": return Math.pow(x, y) }
      throw new Error("op " + op)
    }
    case "func": {
      const name = node.name
      // IFERROR / IFNA must trap errors from their first argument
      if (name === "IFERROR" || name === "IFNA") {
        try { const v = scalar(evalNode(node.args[0], getVal)); return v } catch (e) { return node.args[1] ? scalar(evalNode(node.args[1], getVal)) : "" }
      }
      if (name === "IF") { return asBool(scalar(evalNode(node.args[0], getVal))) ? evalNode(node.args[1], getVal) : (node.args[2] ? evalNode(node.args[2], getVal) : false) }
      const fn = FN[name]; if (!fn) throw new Error("unsupported fn " + name)
      const args = node.args.map(n => evalNode(n, getVal))
      return fn(args)
    }
    default: throw new Error("bad node")
  }
}

// parsed-AST cache: imported formulas are static strings, so tokenize+parse once and reuse it
// across re-renders and identical formulas (the AST is only read during eval, never mutated).
// This is what stops every cell re-parsing on each render. Keyed by sheet name + formula text.
const astCache = new Map()

// evaluate a formula string against a value getter; getVal(r,c) → scalar (1-based coords).
// sheetName lets same-sheet qualifiers resolve while genuine cross-sheet refs bail.
export function evalFormula(src, getVal, sheetName) {
  const f = String(src).trim().replace(/^=/, "")
  const key = (sheetName || "") + " " + f
  let ast = astCache.get(key)
  if (!ast) {
    ast = parse(tokenize(f, sheetName))
    if (astCache.size > 5000) astCache.clear()   // bound memory across many imports
    astCache.set(key, ast)
  }
  const out = evalNode(ast, getVal)
  return out instanceof Rng ? scalar(out) : out
}

// what a plain (non-formula) cell contributes to a formula: its numeric value if it has one,
// otherwise a pure number parsed from the text, otherwise the raw text
const cellLiteral = (cell) => {
  if (cell.n != null && cell.n !== "") return cell.n
  const v = cell.v
  if (v == null || v === "") return ""
  const s = String(v).replace(/,/g, "").trim()
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  return String(v)
}

// build an evaluator over a grid (rows of {v, f?, n?} cells or null). Handles nested formula
// cells (with a cycle guard) and caches so a summary block computes in one pass.
export function makeSheet(grid, sheetName) {
  const cache = new Map(), stack = new Set()
  const rawAt = (r, c) => { const row = grid && grid[r - 1]; return row ? (row[c - 1] || null) : null }
  const dims = { rows: grid ? grid.length : 0, cols: grid ? grid.reduce((m, r) => Math.max(m, r ? r.length : 0), 0) : 0 }
  const valueAt = (r, c) => {
    const key = r + ":" + c
    if (cache.has(key)) return cache.get(key)
    const cell = rawAt(r, c)
    if (!cell) { cache.set(key, ""); return "" }
    if (cell.f) {
      if (stack.has(key)) return 0
      stack.add(key)
      let val
      try { val = evalFormula(String(cell.f), valueAt, sheetName) } catch (e) { val = cellLiteral(cell) }
      stack.delete(key)
      cache.set(key, val); return val
    }
    const lit = cellLiteral(cell); cache.set(key, lit); return lit
  }
  valueAt.rows = dims.rows; valueAt.cols = dims.cols   // so whole-column/row ranges know the bounds
  // evaluate a top-level formula for display: { ok, v } — ok:false → caller keeps the cached value
  const tryEval = (f) => { try { return { ok: true, v: evalFormula(String(f), valueAt, sheetName) } } catch (e) { return { ok: false } } }
  return { valueAt, tryEval }
}

// format a recomputed number to look like the value Excel cached (keep its currency symbol/suffix,
// decimals and grouping); non-numbers pass through as text.
export function formatLike(value, cached) {
  if (value == null) return cached ?? ""
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (typeof value !== "number") return String(value)
  if (!isFinite(value)) return cached ?? ""
  const m = /^(\D*?)([\d.,]+)(\D*)$/.exec(String(cached ?? "").trim())
  if (m && /\d/.test(m[2])) {
    const decimals = (m[2].split(".")[1] || "").length
    const grp = m[2].includes(",")
    const body = value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grp })
    return m[1] + body + m[3]
  }
  const dp = Math.round(value * 100) % 100 === 0 ? 0 : 2
  return value.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
