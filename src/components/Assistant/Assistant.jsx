import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Icon } from '../ui/ui.jsx'
import styles from './Assistant.module.css'

export default function Assistant() {
  const { askAssistant, cloud, session, isGuest } = useStore()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])      // { role: 'user' | 'assistant', content }
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, busy, open])

  // assistant is cloud + signed-in only; guests never see it
  if (!cloud || !session || isGuest) return null

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const history = [...msgs, { role: "user", content: text }]
    setMsgs(history); setInput(""); setBusy(true)
    try {
      const { reply } = await askAssistant(history)
      setMsgs(m => [...m, { role: "assistant", content: reply }])
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", content: "⚠️ " + (e.message || "Something went wrong.") }])
    }
    setBusy(false)
  }

  return (
    <>
      <motion.button className={styles.fab} onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} title="Assistant" aria-label="Assistant">
        <Icon name="chat" size={22} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className={styles.panel}
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
            <div className={styles.head}>
              <div><b>Assistant</b><small>Ask, or tell me to change things</small></div>
              <button className={styles.x} onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className={styles.body}>
              {msgs.length === 0 && (
                <div className={styles.hint}>
                  Try “<i>add a task to call the bank tomorrow</i>” or “<i>what’s our net profit?</i>”.
                  <small>I can edit everything except paying salaries.</small>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={`${styles.msg} ${m.role === "user" ? styles.user : styles.bot}`}>{m.content}</div>
              ))}
              {busy && <div className={`${styles.msg} ${styles.bot} ${styles.typing}`}><span /><span /><span /></div>}
              <div ref={endRef} />
            </div>

            <div className={styles.foot}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") send() }}
                placeholder="Message…" disabled={busy} autoFocus />
              <button className={styles.sendBtn} onClick={send} disabled={busy || !input.trim()} aria-label="Send">
                <Icon name="send" size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
