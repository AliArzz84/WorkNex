import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  I18N, uid, daysBetween, nextPayday, periodKey, isPaid as isPaidPure, timeAgo
} from './data.js'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const KEY = "bm_react_v2"
const MAX_LOG = 250   // how many activity entries we keep in the shared workspace
const EMPTY = { teams: [], employees: [], projects: [], meetings: [], businesses: [], transactions: [], tasks: [], diagram: { nodes: [], edges: [] }, payments: {}, activity: [], seen: {}, currency: "£" }
// Always guarantee the collections exist so views never crash on missing arrays.
const norm = (d) => ({
  ...EMPTY, ...(d || {}),
  payments: (d && d.payments) || {},
  activity: (d && Array.isArray(d.activity)) ? d.activity : [],
  seen: (d && d.seen) || {},
  diagram: { nodes: [], edges: [], ...((d && d.diagram) || {}) },
})
const StoreContext = createContext(null)
export const useStore = () => useContext(StoreContext)

function loadLocalDB() {
  const raw = localStorage.getItem(KEY)
  // norm() guarantees every collection exists, so older/partial blobs can't crash the views
  if (raw) { try { return norm(JSON.parse(raw)) } catch (e) {} }
  return norm(null)   // fresh start = empty workspace (no sample data)
}

export function StoreProvider({ children }) {
  const cloud = isSupabaseConfigured
  // guest "view-only" share link: ?view=<token> in the URL
  const viewToken = cloud ? new URLSearchParams(window.location.search).get("view") : null
  const isGuest = Boolean(viewToken)
  // public request form: ?request=1 — anyone can submit, no login
  const isRequest = cloud ? Boolean(new URLSearchParams(window.location.search).get("request")) : false
  const [guestMeta, setGuestMeta] = useState(null)                              // { label, role, sections, expires_at }
  const [guestStatus, setGuestStatus] = useState(isGuest ? "loading" : "ok")    // 'loading' | 'ok' | 'invalid'
  const [db, setDb] = useState(() => cloud ? EMPTY : loadLocalDB())
  const lang = "en"
  const setLang = () => {}
  const [theme, setTheme] = useState(localStorage.getItem("bm_theme") || "light")
  // base currency is USD; this just toggles how base amounts are *displayed* (USD or GBP)
  const [displayCurrency, setDisplayCurrencyState] = useState(localStorage.getItem("bm_disp") || "USD")
  const setDisplayCurrency = (c) => { setDisplayCurrencyState(c); localStorage.setItem("bm_disp", c) }
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
  // extra-destructive confirm: user must type `confirmPhrase` before the button enables
  const askType = useCallback((opts) => new Promise(resolve => {
    setDialog({ kind: "type", confirmText: "Delete", cancelText: "Cancel", danger: true, value: "", ...(opts || {}), resolve })
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
  const [requests, setRequests] = useState([])        // request-form submissions (admin inbox + nav badge)
  const [requestsReady, setRequestsReady] = useState(false)
  const lastSynced = useRef("")
  const writeTimer = useRef(null)
  const presenceCh = useRef(null)
  // true while this client has a local edit waiting to be saved — so an incoming
  // realtime snapshot doesn't overwrite work the user is still in the middle of
  const dirty = useRef(false)
  // who is acting right now — kept in a ref so the CRUD callbacks stay dependency-free
  const actorRef = useRef({ userId: "local", email: "local", role: "manager" })

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

  // Live USD / EUR (and more) prices in Toman from nerkh.io, cached 30 min
  const [currencyRates, setCurrencyRates] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bm_nerkh")).value } catch (e) { return {} }
  })
  useEffect(() => {
    let cached; try { cached = JSON.parse(localStorage.getItem("bm_nerkh")) } catch (e) {}
    if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return
    const key = import.meta.env.VITE_NERKH_KEY
    if (!key) return
    let cancelled = false
    ;(async () => {
      try {
        const d = await (await fetch("https://api.nerkh.io/v1/prices/json/currency", {
          headers: { Authorization: "Bearer " + key },
        })).json()
        const p = d?.data?.prices
        if (!p || cancelled) return
        const out = {}
        for (const c of ["USD", "EUR", "GBP", "AED", "TRY"]) if (p[c]?.current) out[c] = Number(p[c].current)
        setCurrencyRates(out)
        localStorage.setItem("bm_nerkh", JSON.stringify({ value: out, ts: Date.now() }))
      } catch (e) {}
    })()
    return () => { cancelled = true }
  }, [])

  /* local persistence */
  useEffect(() => { if (!cloud) localStorage.setItem(KEY, JSON.stringify(db)) }, [db, cloud])

  /* === cloud: auth session === */
  useEffect(() => {
    if (!cloud || isGuest || isRequest) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub?.subscription?.unsubscribe?.()
  }, [cloud])

  /* === cloud: load role + workspace + realtime when logged in === */
  useEffect(() => {
    if (!cloud || isGuest || isRequest) return
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
      // First time only: start with an EMPTY workspace and mark it seeded so we never re-init.
      const alreadySetup = raw && (raw.seeded === true || (Array.isArray(raw.employees) && raw.employees.length > 0))
      let data
      if (!alreadySetup) {
        data = norm(null)
        data.seeded = true
        await supabase.from("workspaces").update({ data, updated_at: new Date().toISOString() }).eq("id", "default")
      } else {
        data = norm(raw)
      }
      if (cancelled) return
      lastSynced.current = JSON.stringify(data)
      setDb(data)
      setDataReady(true)
      dirty.current = false   // fresh load — nothing pending

      // record that this account just came in (drives "last seen" in the Activity view)
      setDb(prev => ({
        ...prev,
        seen: { ...(prev.seen || {}), [session.user.id]: { email: session.user.email, role: acct, lastSeen: Date.now() } },
      }))

      channel = supabase.channel("ws-default")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workspaces", filter: "id=eq.default" }, (payload) => {
          const nd = norm(payload.new?.data)
          const str = JSON.stringify(nd)
          if (str === lastSynced.current) return   // ignore our own echo
          if (dirty.current) return                // we have an unsaved edit in flight — our save will win; don't clobber it
          lastSynced.current = str
          setDb(nd)
        })
        .subscribe()
    })().catch(e => console.error("Workspace load failed:", e))
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel) }
  }, [cloud, session?.user?.id])

  useEffect(() => {
    if (!isGuest) return
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.rpc("fetch_shared_view", { p_token: viewToken })
      if (cancelled) return
      if (error || !data) { setGuestStatus("invalid"); return }
      setGuestMeta({ label: data.label, role: data.role, sections: data.sections || [], expires_at: data.expires_at })
      setDb(norm(data.data))
      setView(prev => (data.sections || []).includes(prev) ? prev : ((data.sections || [])[0] || "dashboard"))
      setGuestStatus("ok")
    }
    load()
    const timer = setInterval(load, 45000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [isGuest, viewToken])

  /* === cloud: live presence — who else is online / editing right now === */
  useEffect(() => {
    if (!cloud || isGuest || !session) { setPresence([]); return }
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
    if (!cloud || isGuest || !session || !dataReady) return
    const str = JSON.stringify(db)
    if (str === lastSynced.current) return
    dirty.current = true   // a local edit is now waiting to be saved
    if (writeTimer.current) clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(async () => {
      lastSynced.current = str
      const { error } = await supabase.from("workspaces").update({ data: db, updated_at: new Date().toISOString() }).eq("id", "default")
      if (error) console.error("Save failed:", error.message)
      dirty.current = false   // saved — safe to accept remote snapshots again
      // this write only runs for *local* edits, so flag myself as actively editing
      presenceCh.current?.track({ email: session.user.email, role: account || "boss", editingAt: Date.now() })
    }, 600)
    return () => { if (writeTimer.current) clearTimeout(writeTimer.current) }
    // Same here: don't let a token refresh cancel a pending write.
  }, [db, cloud, session?.user?.id, account, dataReady])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp = (email, password) => supabase.auth.signUp({ email, password })
  const signOut = () => supabase.auth.signOut()

  /* both signed-in users can edit; the Manager/Boss toggle is just a preview of the read-only layout.
     guests (shared view-only links) are always read-only and can't switch roles. */
  const effectiveRole = isGuest ? "guest" : role
  const readOnly = isGuest || effectiveRole === "boss"
  const canPreview = !isGuest

  /* shared view-only links — created & revoked by managers/boss */
  const createViewLink = useCallback(async ({ label, sections, expiresAt }) => {
    const { data, error } = await supabase
      .from("view_links")
      .insert({ label, sections, expires_at: expiresAt, created_by: session?.user?.email })
      .select("token").single()
    if (error) throw error
    return data.token
  }, [session?.user?.email])
  const listViewLinks = useCallback(async () => {
    const { data, error } = await supabase.from("view_links").select("*").order("created_at", { ascending: false })
    if (error) throw error
    return data || []
  }, [])
  const revokeViewLink = useCallback(async (token) => {
    const { error } = await supabase.from("view_links").delete().eq("token", token)
    if (error) throw error
  }, [])

  /* requests — a public form (anon insert) + manager-side inbox */
  const submitRequest = useCallback(async ({ name, channel, contact, message }) => {
    const { error } = await supabase.from("requests").insert({ name, channel, contact, message })
    if (error) throw error
  }, [])
  const listRequests = useCallback(async () => {
    const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false })
    if (error) throw error
    return data || []
  }, [])
  const setRequestStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from("requests").update({ status }).eq("id", id)
    if (error) throw error
  }, [])
  const deleteRequest = useCallback(async (id) => {
    const { error } = await supabase.from("requests").delete().eq("id", id)
    if (error) throw error
  }, [])
  const reloadRequests = useCallback(async () => {
    if (!cloud) return
    const { data } = await supabase.from("requests").select("*").order("created_at", { ascending: false })
    setRequests(data || []); setRequestsReady(true)
  }, [cloud])
  // keep the requests inbox + nav badge live: realtime on the table, with a 20s polling fallback
  useEffect(() => {
    if (!cloud || isGuest || isRequest || !session) { setRequests([]); setRequestsReady(false); return }
    reloadRequests()
    const ch = supabase.channel("requests-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => reloadRequests())
      .subscribe()
    const poll = setInterval(reloadRequests, 20000)
    return () => { clearInterval(poll); supabase.removeChannel(ch) }
  }, [cloud, isGuest, isRequest, session?.user?.id, reloadRequests])

  /* in-app AI assistant — calls the `assistant` Edge Function (Claude) */
  const askAssistant = useCallback(async (history) => {
    const { data, error } = await supabase.functions.invoke("assistant", { body: { messages: history } })
    if (error) {
      let msg = error.message
      try { const body = await error.context?.json?.(); if (body?.error) msg = body.error } catch (e) {}
      throw new Error(msg || "Assistant unavailable")
    }
    if (data?.error) throw new Error(data.error)
    return data   // { reply, changed }
  }, [])

  /* translation */
  const t = useCallback((path) => {
    const o = I18N[lang]
    const v = path.split(".").reduce((a, p) => (a ? a[p] : undefined), o)
    return v ?? path
  }, [lang])
  const L = I18N[lang]

  /* formatting helpers */
  const locale = lang === "fa" ? "fa-IR" : "en-US"
  const CUR_SYMBOL = { GBP: "£", USD: "$", EUR: "€", AED: "د.إ ", TRY: "₺", IRR: "" }
  const money = useCallback((n, code = "USD") => {
    const amt = Number(n || 0)
    if (code === "IRR") return amt.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " تومان"
    return (CUR_SYMBOL[code] || "$") + amt.toLocaleString("en-GB", { maximumFractionDigits: 0 })
  }, [])
  // prefer the live nerkh GBP price; fall back to the exchangerate.host value
  const gbpToman = (currencyRates && currencyRates.GBP) || tomanPerGbp
  const fmtToman = useCallback((n, code = "GBP") => {
    const amt = Number(n || 0)
    const toman = code === "IRR" ? amt
      : (!code || code === "GBP") ? amt * gbpToman
        : (currencyRates && currencyRates[code]) ? amt * currencyRates[code] : amt * gbpToman
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(toman)) + " تومان"
  }, [gbpToman, currencyRates])
  // convert an amount in `code` currency to GBP (used for mixed-currency totals)
  const toGbp = useCallback((n, code = "GBP") => {
    const amt = Number(n || 0)
    if (!code || code === "GBP") return amt
    if (code === "IRR") return gbpToman ? amt / gbpToman : amt
    const r = currencyRates && currencyRates[code]
    return (r && gbpToman) ? amt * r / gbpToman : amt
  }, [gbpToman, currencyRates])
  // USD is the base currency; GBP is an optional display. Derive USD↔GBP from the live Toman rates.
  const usdToGbp = (currencyRates && currencyRates.USD && gbpToman) ? currencyRates.USD / gbpToman : 0.79
  const toUsd = useCallback((n, code = "USD") => {
    const inGbp = toGbp(n, code)                 // any currency → GBP
    return usdToGbp ? inGbp / usdToGbp : inGbp   // GBP → USD (base)
  }, [toGbp, usdToGbp])
  // format a USD-base amount in the currently selected display currency
  const fmtBase = useCallback((n) => displayCurrency === "GBP" ? money(Number(n || 0) * usdToGbp, "GBP") : money(n, "USD"), [displayCurrency, usdToGbp, money])
  const fmtDate = useCallback((iso) => iso ? new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : L.none, [locale, L])
  const fmtDateTime = useCallback((iso) => iso ? new Date(iso).toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : L.none, [locale, L])
  const fmtTime = useCallback((iso) => iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "", [locale])
  const relDay = useCallback((n) => n === 0 ? L.today : n === 1 ? L.tomorrow : n > 0 ? L.inDays(n) : L.daysAgo(-n), [L])

  const empById = useCallback((id) => db.employees.find(e => e.id === id), [db.employees])
  const teamById = useCallback((id) => db.teams.find(tm => tm.id === id), [db.teams])
  const teamMembers = useCallback((teamId) => {
    const tm = db.teams.find(t => t.id === teamId)
    return (tm?.members || []).map(id => db.employees.find(e => e.id === id)).filter(Boolean)
  }, [db.teams, db.employees])
  const isPaid = useCallback((empId, period) => isPaidPure(db, empId, period), [db])

  /* === activity log helpers === */
  // keep the current actor fresh; CRUD reads this ref so its callbacks never go stale
  useEffect(() => {
    actorRef.current = {
      userId: session?.user?.id || "local",
      email: session?.user?.email || (cloud ? "unknown" : "local"),
      role: account || role,
    }
  }, [session?.user?.id, session?.user?.email, account, role, cloud])
  const logEntry = (action, entity, name, detail = "") => {
    const a = actorRef.current
    return { id: uid("log"), ts: Date.now(), userId: a.userId, email: a.email, role: a.role, action, entity, name: name || "", detail }
  }
  // append `entry` to the shared log (newest first, capped) on top of a mutated db
  const withLog = (prev, next, entry) => ({ ...next, activity: [entry, ...(prev.activity || [])].slice(0, MAX_LOG) })

  /* CRUD */
  const collKey = { employee: "employees", project: "projects", meeting: "meetings", team: "teams", task: "tasks", transaction: "transactions", business: "businesses" }
  const nameOf = (o) => o ? (o.name || o.title || o.client || "") : ""
  const saveItem = useCallback((type, obj) => {
    const col = collKey[type]
    setDb(prev => {
      const list = prev[col]
      const existing = obj.id && list.find(x => x.id === obj.id)
      if (existing) {
        const merged = { ...existing, ...obj }
        // saved without actually changing anything → no write, no log
        if (JSON.stringify(merged) === JSON.stringify(existing)) return prev
        const next = { ...prev, [col]: list.map(x => x.id === obj.id ? merged : x) }
        return withLog(prev, next, logEntry("update", type, nameOf(merged)))
      }
      const next = { ...prev, [col]: [...list, { ...obj, id: uid(type[0]) }] }
      return withLog(prev, next, logEntry("create", type, nameOf(obj)))
    })
  }, [])
  const removeItem = useCallback((type, id) => {
    const col = collKey[type]
    setDb(prev => {
      const it = prev[col].find(x => x.id === id)
      const next = { ...prev, [col]: prev[col].filter(x => x.id !== id) }
      return withLog(prev, next, logEntry("delete", type, nameOf(it)))
    })
  }, [])
  const setPaid = useCallback((empId, period, val) => {
    setDb(prev => {
      const payments = { ...prev.payments, [empId]: { ...(prev.payments[empId] || {}) } }
      if (val) payments[empId][period] = new Date().toISOString()
      else delete payments[empId][period]
      const emp = prev.employees.find(e => e.id === empId)
      return withLog(prev, { ...prev, payments }, logEntry(val ? "pay" : "unpay", "salary", emp?.name || "", period))
    })
  }, [])
  const toggleMeetDone = useCallback((id) => {
    setDb(prev => {
      const m = prev.meetings.find(x => x.id === id)
      const next = { ...prev, meetings: prev.meetings.map(x => x.id === id ? { ...x, done: !x.done } : x) }
      return withLog(prev, next, logEntry("update", "meeting", m?.title, m && !m.done ? "completed" : "reopened"))
    })
  }, [])
  const toggleTask = useCallback((id) => {
    setDb(prev => {
      const k = prev.tasks.find(x => x.id === id)
      const next = { ...prev, tasks: prev.tasks.map(x => x.id === id ? { ...x, done: !x.done } : x) }
      return withLog(prev, next, logEntry("update", "task", k?.title, k && !k.done ? "completed" : "reopened"))
    })
  }, [])
  const saveDiagram = useCallback((diagram) => {
    setDb(prev => {
      // the diagram autosaves on every drag — coalesce rapid edits into one log line
      const a = actorRef.current
      const last = (prev.activity || [])[0]
      const merge = last && last.entity === "diagram" && last.userId === a.userId && (Date.now() - last.ts) < 5 * 60 * 1000
      const activity = merge
        ? [{ ...last, ts: Date.now() }, ...prev.activity.slice(1)]
        : [logEntry("update", "diagram", "Workflow diagram"), ...(prev.activity || [])].slice(0, MAX_LOG)
      return { ...prev, diagram, activity }
    })
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
        out.push({ key: "p" + e.id, color: overdue ? "red" : "amber", title: overdue ? L.payOverdue(e.name) : L.payReminder(e.name), sub: money(e.salary, e.currency), when: relDay(dd), sort: overdue ? -100 + dd : dd })
      }
    })
    db.projects.filter(p => p.status === "active").forEach(p => {
      const dd = daysBetween(p.deadline)
      if (dd <= 5) out.push({ key: "d" + p.id, color: dd < 0 ? "red" : "amber", title: L.deadlineReminder(p.name), sub: p.client, when: relDay(dd), sort: dd })
    })
    return out.sort((a, b) => a.sort - b.sort)
  }, [db, L, money, fmtDateTime, relDay])

  /* everything happening TODAY (checkable): meetings, salaries, project deadlines, tasks */
  const todayExtras = useMemo(() => {
    const PC = { high: "red", med: "amber", low: "gray" }
    const meet = db.meetings.filter(m => !m.done && daysBetween(m.datetime) === 0)
      .map(m => ({ key: "m" + m.id, type: "meeting", id: m.id, color: "blue", icon: "meetings", title: m.title, sub: "Meeting" + (m.location ? " • " + m.location : ""), when: fmtTime(m.datetime), priority: m.priority }))
    const pay = db.employees.filter(e => e.status === "active")
      .filter(e => { const pd = nextPayday(e); return daysBetween(pd.toISOString()) === 0 && !isPaidPure(db, e.id, periodKey(pd)) })
      .map(e => { const pd = nextPayday(e); return { key: "p" + e.id, type: "salary", empId: e.id, period: periodKey(pd), color: "amber", icon: "wallet", title: e.name, sub: "Salary due today", when: money(e.salary, e.currency) } })
    const proj = db.projects.filter(p => p.status !== "done" && p.deadline && daysBetween(p.deadline) === 0)
      .map(p => ({ key: "d" + p.id, type: "project", id: p.id, color: "red", icon: "projects", title: p.name, sub: "Project deadline" + (p.client ? " • " + p.client : ""), when: "Due today" }))
    const tasks = db.tasks.filter(k => !k.done && k.due && daysBetween(k.due) === 0)
      .map(k => { const a = db.employees.find(e => e.id === k.assignee); return { key: "t" + k.id, type: "task", id: k.id, color: PC[k.priority] || "gray", icon: "tasks", title: k.title, sub: "Task" + (a ? " • " + a.name : ""), when: "To-do", priority: k.priority } })
    return [...meet, ...pay, ...proj, ...tasks]
  }, [db, money, fmtTime])

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
    r.onload = () => {
      try {
        const d = JSON.parse(r.result)
        // keep this account's access history + the running log, and record the import
        setDb(prev => withLog(prev, { ...norm(d), seen: prev.seen }, logEntry("update", "workspace", "Imported data", "replaced everything from a file")))
      } catch (e) { notify(L.invalidFile, "error") }
    }
    r.readAsText(file)
  }, [L, notify])
  const clearAll = useCallback(async () => {
    if (await askType({ title: L.clearAll, message: L.confirmClear, confirmPhrase: "DELETE", confirmText: L.clearAll, danger: true })) {
      // wipe the data but keep the access history + log the wipe itself
      setDb(prev => withLog(prev, { ...EMPTY, seeded: true, seen: prev.seen }, logEntry("delete", "workspace", "All data", "cleared the workspace")))
    }
  }, [L, askType])

  const value = {
    db, lang, setLang, theme, toggleTheme, role: effectiveRole, setRole, readOnly, canPreview,
    cloud, session, account, authReady, dataReady, presence, signIn, signUp, signOut,
    isGuest, guestMeta, guestStatus, createViewLink, listViewLinks, revokeViewLink, askAssistant,
    isRequest, submitRequest, listRequests, setRequestStatus, deleteRequest, requests, requestsReady, reloadRequests,
    t, L, view, setView, search, setSearch,
    editing, openEditor: (type, id) => { if (!isGuest) setEditing({ type, id }) }, closeEditor: () => setEditing(null),
    dialog, toast, ask, askText, askType, resolveDialog, notify,
    money, fmtToman, toGbp, toUsd, fmtBase, displayCurrency, setDisplayCurrency, usdToGbp, tomanPerGbp: gbpToman, currencyRates, fmtDate, fmtDateTime, fmtTime, timeAgo, relDay, daysBetween, nextPayday, periodKey, isPaid,
    empById, teamById, teamMembers, reminders, todayExtras, saveItem, removeItem, setPaid, toggleMeetDone, toggleTask, saveDiagram,
    exportData, importData, clearAll,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
