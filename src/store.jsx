import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  I18N, sampleData, uid, daysBetween, nextPayday, periodKey, isPaid as isPaidPure
} from './data.js'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const KEY = "bm_react_v2"
const EMPTY = { teams: [], employees: [], projects: [], meetings: [], businesses: [], transactions: [], tasks: [], diagram: { nodes: [], edges: [] }, payments: {}, currency: "£" }
// Always guarantee the collections exist so views never crash on missing arrays.
const norm = (d) => ({
  ...EMPTY, ...(d || {}),
  payments: (d && d.payments) || {},
  diagram: { nodes: [], edges: [], ...((d && d.diagram) || {}) },
})
const StoreContext = createContext(null)
export const useStore = () => useContext(StoreContext)

function loadLocalDB() {
  const raw = localStorage.getItem(KEY)
  if (raw) { try { const d = JSON.parse(raw); if (!d.payments) d.payments = {}; return d } catch (e) {} }
  return sampleData("en")
}

export function StoreProvider({ children }) {
  const cloud = isSupabaseConfigured
  const [db, setDb] = useState(() => cloud ? EMPTY : loadLocalDB())
  const lang = "en"
  const setLang = () => {}
  const [theme, setTheme] = useState(localStorage.getItem("bm_theme") || "light")
  const [role, setRoleState] = useState(localStorage.getItem("bm_role") || "manager")
  const [view, setView] = useState("dashboard")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState(null) // {type, id}
  const [dialog, setDialog] = useState(null)   // custom confirm / prompt modal
  const [toast, setToast] = useState(null)     // little notification

  /* nice replacements for window.confirm / prompt / alert */
  const ask = useCallback((opts) => new Promise(resolve => {
    const o = typeof opts === "string" ? { message: opts } : (opts || {})
    setDialog({ kind: "confirm", confirmText: "Delete", cancelText: "Cancel", danger: true, ...o, resolve })
  }), [])
  const askText = useCallback((opts) => new Promise(resolve => {
    const o = typeof opts === "string" ? { message: opts } : (opts || {})
    setDialog({ kind: "prompt", confirmText: "Save", cancelText: "Cancel", value: "", danger: false, ...o, resolve })
  }), [])
  const resolveDialog = useCallback((result) => {
    setDialog(d => { d?.resolve?.(result); return null })
  }, [])
  const notify = useCallback((message, type = "info") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  /* auth (cloud only) */
  const [session, setSession] = useState(null)
  const [account, setAccount] = useState(null)        // 'manager' | 'boss'
  const [authReady, setAuthReady] = useState(!cloud)  // local mode: ready immediately
  const [dataReady, setDataReady] = useState(!cloud)
  const [presence, setPresence] = useState([])        // who else is online/editing
  const lastSynced = useRef("")
  const writeTimer = useRef(null)
  const presenceCh = useRef(null)

  /* theme + document */
  useEffect(() => { document.documentElement.lang = "en"; document.documentElement.dir = "ltr" }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("bm_theme", theme)
  }, [theme])
  const toggleTheme = () => setTheme(p => p === "dark" ? "light" : "dark")
  const setRole = (r) => { setRoleState(r); localStorage.setItem("bm_role", r) }

  // GBP -> Toman live exchange rate (open.er-api.com, cached 6h, with fallback)
  const [tomanPerGbp, setTomanPerGbp] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bm_rate2")).value } catch (e) { return 180000 }
  })
  useEffect(() => {
    let cached; try { cached = JSON.parse(localStorage.getItem("bm_rate2")) } catch (e) {}
    if (cached && Date.now() - cached.ts < 6 * 3600 * 1000) return
    let cancelled = false
    const key = import.meta.env.VITE_EXCHANGERATE_KEY
    const apply = (toman) => {
      if (!toman || cancelled) return
      setTomanPerGbp(toman)
      localStorage.setItem("bm_rate2", JSON.stringify({ value: toman, ts: Date.now() }))
    }
    ;(async () => {
      // primary: ExchangeRate.host
      if (key) {
        try {
          const d = await (await fetch(`https://api.exchangerate.host/live?access_key=${key}&source=GBP&currencies=IRR`)).json()
          if (d && d.success && d.quotes && d.quotes.GBPIRR) { apply(Math.round(d.quotes.GBPIRR / 10)); return }
        } catch (e) {}
      }
      // fallback: open.er-api (no key, CORS-friendly)
      try {
        const d = await (await fetch("https://open.er-api.com/v6/latest/GBP")).json()
        if (d && d.rates && d.rates.IRR) apply(Math.round(d.rates.IRR / 10))
      } catch (e) {}
    })()
    return () => { cancelled = true }
  }, [])

  /* local persistence */
  useEffect(() => { if (!cloud) localStorage.setItem(KEY, JSON.stringify(db)) }, [db, cloud])

  /* === cloud: auth session === */
  useEffect(() => {
    if (!cloud) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s) })
    return () => sub?.subscription?.unsubscribe?.()
  }, [cloud])

  /* === cloud: load role + workspace + realtime when logged in === */
  useEffect(() => {
    if (!cloud) return
    if (!session) { setAccount(null); setDataReady(false); setDb(EMPTY); return }
    let channel, cancelled = false
    ;(async () => {
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).single()
      const acct = prof?.role || "boss"
      if (cancelled) return
      setAccount(acct)
      // Each account opens in its own view by default (boss → Boss view).
      // They can still flip it from the top toggle during the session.
      setRole(acct)

      const { data: ws } = await supabase.from("workspaces").select("data").eq("id", "default").single()
      let raw = ws?.data
      // Only seed sample data the very first time. Once seeded (or cleared), respect what's there.
      const alreadySetup = raw && (raw.seeded === true || (Array.isArray(raw.employees) && raw.employees.length > 0))
      let data
      if (!alreadySetup) {
        data = norm(sampleData("en"))
        data.seeded = true
        await supabase.from("workspaces").update({ data, updated_at: new Date().toISOString() }).eq("id", "default")
      } else {
        data = norm(raw)
      }
      if (cancelled) return
      lastSynced.current = JSON.stringify(data)
      setDb(data)
      setDataReady(true)

      channel = supabase.channel("ws-default")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workspaces", filter: "id=eq.default" }, (payload) => {
          const nd = norm(payload.new?.data)
          const str = JSON.stringify(nd)
          if (str === lastSynced.current) return   // ignore our own echo
          lastSynced.current = str
          setDb(nd)
        })
        .subscribe()
    })().catch(e => console.error("Workspace load failed:", e))
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel) }
    // Key on the user id only — a token refresh keeps the same id, so we don't
    // reload (and wipe unsaved local edits) every time the session object changes.
  }, [cloud, session?.user?.id])

  /* === cloud: live presence — who else is online / editing right now === */
  useEffect(() => {
    if (!cloud || !session) { setPresence([]); return }
    const me = session.user.id
    const ch = supabase.channel("presence-default", { config: { presence: { key: me } } })
    presenceCh.current = ch
    const sync = () => {
      const state = ch.presenceState()
      const list = Object.entries(state).map(([userId, metas]) => {
        const m = metas[metas.length - 1] || {}
        return { userId, email: m.email, role: m.role, editingAt: m.editingAt || 0 }
      })
      setPresence(list)
    }
    ch.on("presence", { event: "sync" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ email: session.user.email, role: account || "boss", editingAt: 0 })
        }
      })
    return () => { presenceCh.current = null; supabase.removeChannel(ch) }
  }, [cloud, session?.user?.id, account])

  /* === cloud: write (debounced) when the manager changes data === */
  useEffect(() => {
    if (!cloud || !session || !dataReady) return
    const str = JSON.stringify(db)
    if (str === lastSynced.current) return
    if (writeTimer.current) clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(async () => {
      lastSynced.current = str
      const { error } = await supabase.from("workspaces").update({ data: db, updated_at: new Date().toISOString() }).eq("id", "default")
      if (error) console.error("Save failed:", error.message)
      // this write only runs for *local* edits, so flag myself as actively editing
      presenceCh.current?.track({ email: session.user.email, role: account || "boss", editingAt: Date.now() })
    }, 600)
    return () => { if (writeTimer.current) clearTimeout(writeTimer.current) }
    // Same here: don't let a token refresh cancel a pending write.
  }, [db, cloud, session?.user?.id, account, dataReady])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp = (email, password) => supabase.auth.signUp({ email, password })
  const signOut = () => supabase.auth.signOut()

  /* both signed-in users can edit; the Manager/Boss toggle is just a preview of the read-only layout */
  const effectiveRole = role
  const readOnly = effectiveRole === "boss"
  const canPreview = true

  /* translation */
  const t = useCallback((path) => {
    const o = I18N[lang]
    const v = path.split(".").reduce((a, p) => (a ? a[p] : undefined), o)
    return v ?? path
  }, [lang])
  const L = I18N[lang]

  /* formatting helpers */
  const locale = lang === "fa" ? "fa-IR" : "en-US"
  const money = useCallback((n) => "£" + Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 }), [])
  const fmtToman = useCallback((n) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(Number(n || 0) * tomanPerGbp)) + " تومان", [tomanPerGbp])
  const fmtDate = useCallback((iso) => iso ? new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : L.none, [locale, L])
  const fmtDateTime = useCallback((iso) => iso ? new Date(iso).toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : L.none, [locale, L])
  const fmtTime = useCallback((iso) => iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "", [locale])
  const relDay = useCallback((n) => n === 0 ? L.today : n === 1 ? L.tomorrow : n > 0 ? L.inDays(n) : L.daysAgo(-n), [L])

  const empById = useCallback((id) => db.employees.find(e => e.id === id), [db.employees])
  const teamById = useCallback((id) => db.teams.find(tm => tm.id === id), [db.teams])
  const isPaid = useCallback((empId, period) => isPaidPure(db, empId, period), [db])

  /* CRUD */
  const collKey = { employee: "employees", project: "projects", meeting: "meetings", team: "teams", task: "tasks", transaction: "transactions", business: "businesses" }
  const saveItem = useCallback((type, obj) => {
    const col = collKey[type]
    setDb(prev => {
      const list = prev[col]
      if (obj.id && list.some(x => x.id === obj.id)) {
        return { ...prev, [col]: list.map(x => x.id === obj.id ? { ...x, ...obj } : x) }
      }
      return { ...prev, [col]: [...list, { ...obj, id: uid(type[0]) }] }
    })
  }, [])
  const removeItem = useCallback((type, id) => {
    const col = collKey[type]
    setDb(prev => ({ ...prev, [col]: prev[col].filter(x => x.id !== id) }))
  }, [])
  const setPaid = useCallback((empId, period, val) => {
    setDb(prev => {
      const payments = { ...prev.payments, [empId]: { ...(prev.payments[empId] || {}) } }
      if (val) payments[empId][period] = new Date().toISOString()
      else delete payments[empId][period]
      return { ...prev, payments }
    })
  }, [])
  const toggleMeetDone = useCallback((id) => {
    setDb(prev => ({ ...prev, meetings: prev.meetings.map(m => m.id === id ? { ...m, done: !m.done } : m) }))
  }, [])
  const toggleTask = useCallback((id) => {
    setDb(prev => ({ ...prev, tasks: prev.tasks.map(k => k.id === id ? { ...k, done: !k.done } : k) }))
  }, [])
  const saveDiagram = useCallback((diagram) => {
    setDb(prev => ({ ...prev, diagram }))
  }, [])

  /* reminders */
  const reminders = useMemo(() => {
    const out = []
    db.meetings.filter(m => !m.done).forEach(m => {
      const dd = daysBetween(m.datetime)
      if (dd >= 0 && dd <= 2) out.push({ key: "m" + m.id, color: "blue", title: L.meetReminder(m.title), sub: fmtDateTime(m.datetime), when: relDay(dd), sort: dd * 10 })
    })
    db.employees.filter(e => e.status === "active").forEach(e => {
      const pd = nextPayday(e); const dd = daysBetween(pd.toISOString()); const per = periodKey(pd)
      if (isPaidPure(db, e.id, per)) return
      if (dd <= 7) {
        const overdue = dd < 0
        out.push({ key: "p" + e.id, color: overdue ? "red" : "amber", title: overdue ? L.payOverdue(e.name) : L.payReminder(e.name), sub: money(e.salary), when: relDay(dd), sort: overdue ? -100 + dd : dd })
      }
    })
    db.projects.filter(p => p.status === "active").forEach(p => {
      const dd = daysBetween(p.deadline)
      if (dd <= 5) out.push({ key: "d" + p.id, color: dd < 0 ? "red" : "amber", title: L.deadlineReminder(p.name), sub: p.client, when: relDay(dd), sort: dd })
    })
    return out.sort((a, b) => a.sort - b.sort)
  }, [db, L, money, fmtDateTime, relDay])

  /* import / export / reset */
  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "business-manager-" + new Date().toISOString().slice(0, 10) + ".json"
    a.click()
  }, [db])
  const importData = useCallback((file) => {
    const r = new FileReader()
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d.payments) d.payments = {}; setDb(d) } catch (e) { notify(L.invalidFile, "error") } }
    r.readAsText(file)
  }, [L, notify])
  const resetData = useCallback(async () => {
    if (await ask({ title: "Load sample data", message: L.replaceSample, confirmText: "Replace", danger: false })) setDb(sampleData(lang))
  }, [L, lang, ask])
  const clearAll = useCallback(async () => {
    if (await ask({ title: L.clearAll, message: L.confirmClear, confirmText: L.clearAll, danger: true })) setDb({ ...EMPTY, seeded: true })
  }, [L, ask])

  const value = {
    db, lang, setLang, theme, toggleTheme, role: effectiveRole, setRole, readOnly, canPreview,
    cloud, session, account, authReady, dataReady, presence, signIn, signUp, signOut,
    t, L, view, setView, search, setSearch,
    editing, openEditor: (type, id) => setEditing({ type, id }), closeEditor: () => setEditing(null),
    dialog, toast, ask, askText, resolveDialog, notify,
    money, fmtToman, tomanPerGbp, fmtDate, fmtDateTime, fmtTime, relDay, daysBetween, nextPayday, periodKey, isPaid,
    empById, teamById, reminders, saveItem, removeItem, setPaid, toggleMeetDone, toggleTask, saveDiagram,
    exportData, importData, resetData, clearAll,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
