import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Logo } from '../ui/ui.jsx'

const CHANNELS = ["WhatsApp", "Discord", "Telegram", "Email", "Phone", "Instagram", "Other"]

export default function RequestForm() {
  const { submitRequest } = useStore()
  const [f, setF] = useState({ name: "", channel: "WhatsApp", contact: "", message: "" })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!f.name.trim() || !f.message.trim()) return
    setBusy(true); setErr(null)
    try { await submitRequest({ ...f }); setSent(true) }
    catch (e2) { setErr("Couldn't send — please try again in a moment.") }
    setBusy(false)
  }

  const wrap = { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "var(--bg, var(--surface))" }
  const card = { width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 26, boxShadow: "0 12px 44px rgba(0,0,0,.14)" }

  if (sent) return (
    <div style={wrap}>
      <motion.div style={card} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: "grid", placeItems: "center", gap: 12, textAlign: "center" }}>
          <Logo size={48} />
          <h2 style={{ margin: 0 }}>Request sent ✅</h2>
          <p className="muted">Thanks{f.name ? ", " + f.name.trim().split(/\s+/)[0] : ""}! We’ve got it and will get back to you.</p>
          <button className="btn ghost" onClick={() => { setSent(false); setF({ name: "", channel: "WhatsApp", contact: "", message: "" }) }}>Send another</button>
        </div>
      </motion.div>
    </div>
  )

  return (
    <div style={wrap}>
      <motion.div style={card} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <Logo size={40} />
          <div><b style={{ fontSize: 16 }}>Send a request</b><br /><small className="muted">Tell us what you need — we’ll get back to you.</small></div>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Your name *</label>
            <input value={f.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Sara Ahmadi" required autoFocus />
          </div>
          <div className="field">
            <label>Best way to reach you</label>
            <select value={f.channel} onChange={e => set("channel", e.target.value)}>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Your {f.channel} handle / number</label>
            <input value={f.contact} onChange={e => set("contact", e.target.value)} placeholder="how we can contact you" />
          </div>
          <div className="field">
            <label>What do you need? *</label>
            <textarea value={f.message} onChange={e => set("message", e.target.value)} rows={4} required
              placeholder="Describe your request, a meeting you want, or anything you need…" />
          </div>
          {err && <div style={{ color: "var(--red-ink)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "Sending…" : "Submit request"}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 14 }}>Your details are only shared with the team.</p>
      </motion.div>
    </div>
  )
}
