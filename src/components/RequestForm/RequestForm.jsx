import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { REQUEST_CATEGORIES } from '../../lib/data.js'
import { Logo } from '../ui/ui.jsx'

// each contact channel asks for the right kind of handle, with a real example
const CHANNELS = {
  WhatsApp: { label: "Your WhatsApp number", ph: "e.g. +98 912 345 6789", type: "tel" },
  Telegram: { label: "Your Telegram username", ph: "e.g. @sara_ahmadi", type: "text" },
  Discord: { label: "Your Discord username", ph: "e.g. sara_92", type: "text" },
  Instagram: { label: "Your Instagram handle", ph: "e.g. @sara.ahmadi", type: "text" },
  Email: { label: "Your email address", ph: "e.g. sara@email.com", type: "email" },
  Phone: { label: "Your phone number", ph: "e.g. +98 912 345 6789", type: "tel" },
  Other: { label: "How can we reach you?", ph: "a username, link, or number", type: "text" },
}
const CHANNEL_KEYS = Object.keys(CHANNELS)
const EMPTY = { name: "", category: "meeting", channel: "WhatsApp", contact: "", message: "" }

export default function RequestForm() {
  const { submitRequest } = useStore()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const ch = CHANNELS[f.channel] || CHANNELS.Other
  const valid = f.name.trim() && f.contact.trim() && f.message.trim()

  const submit = async (e) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true); setErr(null)
    try { await submitRequest({ ...f, name: f.name.trim(), contact: f.contact.trim(), message: f.message.trim() }); setSent(true) }
    catch (e2) { setErr("Couldn’t send — please try again in a moment.") }
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
          <p className="muted">Thanks{f.name ? ", " + f.name.trim().split(/\s+/)[0] : ""}! We’ve got it and will reach out on {f.channel}.</p>
          <button className="btn ghost" onClick={() => { setSent(false); setF(EMPTY) }}>Send another</button>
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
            <label>What’s this about?</label>
            <div className="multi" style={{ border: 0, padding: 0, background: "transparent" }}>
              {REQUEST_CATEGORIES.map(c => (
                <button type="button" key={c.key} className={`chip ${f.category === c.key ? "on" : ""}`} onClick={() => set("category", c.key)}>{c.label}</button>
              ))}
            </div>
          </div>

          <div className="two">
            <div className="field">
              <label>Best way to reach you</label>
              <select value={f.channel} onChange={e => set("channel", e.target.value)}>
                {CHANNEL_KEYS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{ch.label} *</label>
              <input type={ch.type} value={f.contact} onChange={e => set("contact", e.target.value)} placeholder={ch.ph} required />
            </div>
          </div>

          <div className="field">
            <label>What do you need? *</label>
            <textarea value={f.message} onChange={e => set("message", e.target.value)} rows={4} required
              placeholder="Describe your request, a meeting you’d like, a question — anything you need…" />
          </div>

          {err && <div style={{ color: "var(--red-ink)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <button className="btn" type="submit" disabled={busy || !valid} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "Sending…" : "Submit request"}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 14 }}>Your details are only shared with the team.</p>
      </motion.div>
    </div>
  )
}
