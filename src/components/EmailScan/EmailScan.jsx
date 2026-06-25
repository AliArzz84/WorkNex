import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Icon } from '../ui/ui.jsx'
import styles from './EmailScan.module.css'

const clip = (s) => (s || "").slice(0, 16)   // -> "YYYY-MM-DDTHH:mm"
const niceTime = (v) => v ? new Date(v).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""
const cleanFrom = (f) => (f || "").replace(/<[^>]*>/g, "").replace(/"/g, "").trim() || (f || "")

/* a meeting Claude found in an email — confirm/adjust the time, then add it to Meetings */
function SuggestionCard({ s }) {
  const { acceptSuggestion, dismissSuggestion, notify } = useStore()
  const slots = (s.proposed_slots || []).map(clip).filter(Boolean)
  const [when, setWhen] = useState(s.has_explicit_time && s.datetime ? clip(s.datetime) : (slots[0] || ""))

  const accept = () => {
    if (!when) { notify("Pick a time first", "error"); return }
    acceptSuggestion(s.id, when)
    notify("Added to Meetings ✓", "success")
  }

  return (
    <motion.div className={styles.card} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}>
      <h4 className={styles.title}>{s.title || "Meeting"}</h4>
      {s.from && <div className={styles.from}><Icon name="mail" size={12} /> {cleanFrom(s.from)}</div>}
      {s.summary && <p className={styles.summary}>{s.summary}</p>}
      {(s.attendees || []).length > 0 && <div className={styles.meta}>With: {s.attendees.join(", ")}</div>}
      {s.location && <div className={styles.meta}>{s.location}</div>}

      <div className={styles.ask}>
        {s.has_explicit_time && s.datetime
          ? <>Email says <b>{niceTime(s.datetime)}</b> — confirm or change:</>
          : <>No time given — pick one (from your working hours):</>}
      </div>
      {slots.length > 0 && (
        <div className={styles.slots}>
          {slots.map(sl => (
            <button key={sl} className={`${styles.slot} ${when === sl ? styles.slotOn : ""}`} onClick={() => setWhen(sl)}>{niceTime(sl)}</button>
          ))}
        </div>
      )}
      <input className={styles.time} type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />

      <div className={styles.actions}>
        <button className="btn ghost" onClick={() => dismissSuggestion(s.id)}>Dismiss</button>
        <button className="btn" onClick={accept} disabled={!when}><Icon name="check" size={14} /> Add to Meetings</button>
      </div>
    </motion.div>
  )
}

export default function EmailScan() {
  const { db, cloud, session, isGuest, emailConnected, connectGmail, disconnectGmail, scanInbox, addSuggestion, notify } = useStore()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // signed-in cloud users only (guests never see it)
  if (!cloud || !session || isGuest) return null

  // only the meetings that came from an email (have a sourceId)
  const pending = (db.suggestions || []).filter(s => s.sourceId)

  const connect = async () => {
    try { await connectGmail() } catch (e) { notify(e.message || "Couldn't connect Google", "error") }
  }

  const scan = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await scanInbox()
      if (res.needsConnect) {
        notify(res.reason === "reconnect_needed" ? "Please reconnect your Gmail" : "Connect your Gmail first", "info")
      } else {
        const known = new Set([...(db.suggestions || []).map(s => s.sourceId), ...(db.emailSeen || [])])
        const fresh = (res.meetings || []).filter(m => m.sourceId && !known.has(m.sourceId))
        fresh.forEach(m => addSuggestion(m, m.subject || ""))
        notify(fresh.length
          ? `Found ${fresh.length} meeting${fresh.length > 1 ? "s" : ""} in ${res.scanned} emails ✓`
          : `Scanned ${res.scanned} emails — nothing new`, fresh.length ? "success" : "info")
      }
    } catch (e) {
      notify(e.message || "Couldn't scan your inbox", "error")
    }
    setBusy(false)
  }

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen(true)} title="Scan email for meetings" aria-label="Email meetings">
        <Icon name="mail" size={18} />
        {pending.length > 0 && <span className={styles.dot}>{pending.length}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
            <motion.div className={`modal ${styles.modal}`} initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
              <div className="modal-h">
                <h2>Email → Meetings</h2>
                <button className="x" onClick={() => setOpen(false)}>✕</button>
              </div>

              <div className={styles.body}>
                <div className={styles.conn}>
                  {emailConnected ? (
                    <>
                      <span className={styles.connOn}><i /> Gmail connected</span>
                      <button className={styles.linkbtn} onClick={disconnectGmail}>Disconnect</button>
                    </>
                  ) : (
                    <div className={styles.connOff}>
                      <p>Connect your Gmail so Claude can read your recent emails (read-only) and spot meetings.</p>
                      <button className="btn" onClick={connect}><Icon name="mail" size={15} /> Connect Gmail</button>
                    </div>
                  )}
                </div>

                {emailConnected && (
                  <button className={`btn ${styles.scanBtn}`} onClick={scan} disabled={busy}>
                    {busy ? "Reading your inbox…" : <><Icon name="sparkles" size={15} /> Scan recent emails</>}
                  </button>
                )}

                <div className={styles.list}>
                  <AnimatePresence>
                    {pending.length
                      ? pending.map(s => <SuggestionCard key={s.id} s={s} />)
                      : <div className={styles.empty}>{emailConnected ? "No meetings waiting. Hit scan to check your inbox." : ""}</div>}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
