import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Icon } from '../ui/ui.jsx'

export default function Backups({ open, onClose }) {
  const { listSnapshots, restoreSnapshot, fmtDateTime, timeAgo, ask, notify } = useStore()
  const [rows, setRows] = useState(null)   // null = loading
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setRows(null)
    try { setRows(await listSnapshots()) }
    catch (e) { setRows([]); notify("Couldn’t load backups: " + (e.message || ""), "error") }
  }
  useEffect(() => { if (open) load() }, [open])

  const restore = async (r) => {
    const when = fmtDateTime(r.saved_at)
    const ok = await ask({
      title: "Restore this backup?",
      message: "This replaces ALL current data with the version saved on " + when + ". The restore is itself saved to history, so you can undo it.",
      confirmText: "Restore", danger: true,
    })
    if (!ok) return
    setBusy(true)
    try { await restoreSnapshot(r.id); notify("Workspace restored from " + when, "success"); onClose() }
    catch (e) { notify("Restore failed: " + (e.message || ""), "error") }
    setBusy(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div className="modal" initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} style={{ maxWidth: 560 }}>
            <div className="modal-h">
              <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="history" size={17} /> Backups &amp; restore</h2>
              <button className="x" onClick={onClose}>✕</button>
            </div>
            <div className="modal-b">
              <p className="muted" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6 }}>
                Your workspace is backed up automatically on every change. Pick a point in time below to roll back —
                the restore is saved too, so it can always be undone.
              </p>
              {rows === null ? (
                <div className="empty" style={{ padding: "30px 10px" }}>Loading…</div>
              ) : rows.length === 0 ? (
                <div className="empty" style={{ padding: "30px 10px", lineHeight: 1.6 }}>
                  <div className="big"><Icon name="history" size={30} strokeWidth={1.4} /></div>
                  No backups visible yet. If this looks wrong, the one-time read permission on
                  <b> workspace_history</b> may still need to be enabled (see setup notes).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", maxHeight: "48vh", overflow: "auto" }}>
                  {rows.map((r, i) => (
                    <div key={r.id} className="srow">
                      <span className="datetile" data-tone={i === 0 ? "green" : "gray"}>
                        <span className="m">{i === 0 ? "NOW" : "VER"}</span>
                        <span className="d" style={{ fontSize: 13 }}>{rows.length - i}</span>
                      </span>
                      <div className="mid">
                        <b>{fmtDateTime(r.saved_at)}</b>
                        <small>{timeAgo(new Date(r.saved_at).getTime())}{r.saved_by ? " • " + r.saved_by : ""}</small>
                      </div>
                      <button className="btn ghost sm" disabled={busy} onClick={() => restore(r)}>
                        <Icon name="undo" size={14} /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-f">
              <button className="btn ghost" disabled={busy} onClick={load}><Icon name="refresh" size={15} /> Refresh</button>
              <button className="btn ghost" onClick={onClose}>Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
