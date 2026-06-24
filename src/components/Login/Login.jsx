import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Icon } from '../ui/ui.jsx'
import styles from './Login.module.css'

export default function Login() {
  const { signIn, signUp } = useStore()
  const [mode, setMode] = useState("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      if (mode === "signin") {
        const { error } = await signIn(email.trim(), password)
        if (error) setMsg({ type: "err", text: error.message })
      } else {
        const { error } = await signUp(email.trim(), password)
        if (error) setMsg({ type: "err", text: error.message })
        else setMsg({ type: "ok", text: "Account created. If email confirmation is on, check your inbox — otherwise just sign in." })
      }
    } catch (err) {
      setMsg({ type: "err", text: String(err.message || err) })
    }
    setBusy(false)
  }

  return (
    <div className={styles.wrap}>
      <motion.div className={styles.card} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
        <div className={styles.brand}>
          <div className={styles.logo}>M</div>
          <div><b>Manager Dashboard</b><small>Sign in to continue</small></div>
        </div>

        <div className={styles.tabs}>
          <button className={mode === "signin" ? styles.on : undefined} onClick={() => { setMode("signin"); setMsg(null) }}>Sign in</button>
          <button className={mode === "signup" ? styles.on : undefined} onClick={() => { setMode("signup"); setMsg(null) }}>Sign up</button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
          </div>

          {msg && <div className={`${styles.msg} ${styles[msg.type]}`}>{msg.text}</div>}

          <button className="btn" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
            {busy ? "…" : (mode === "signin" ? "Sign in" : "Create account")}
          </button>
        </form>

        <p className={styles.foot}><Icon name="alert" size={13} /> Your data is private — only signed-in users can see it.</p>
      </motion.div>
    </div>
  )
}
