import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Icon, Logo } from '../ui/ui.jsx'
import styles from './Login.module.css'

export default function Login() {
  const { signIn, signUp } = useStore()
  const [mode, setMode] = useState("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  // Turn raw auth errors into a clear message. A failed signup trigger (e.g. an
  // email that isn't on the allow-list) comes back from Supabase as a vague/empty
  // "Database error saving new user" / {} — surface that as a human sentence.
  const errText = (error, isSignup) => {
    let m = ""
    try { m = String((error && (error.message || error.error_description)) ?? "").trim() } catch (e) { m = "" }
    const dbGate = !m || m === "{}" || m.startsWith("{") || /database error|unexpected_failure|saving new user|not authoris/i.test(m)
    if (isSignup && dbGate) return "This email isn’t authorised to sign up. Please contact your administrator."
    if (!isSignup && /invalid login/i.test(m)) return "Wrong email or password."
    return m || "Something went wrong — please try again."
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      if (mode === "signin") {
        const { error } = await signIn(email.trim(), password)
        if (error) setMsg({ type: "err", text: errText(error, false) })
      } else {
        const { error } = await signUp(email.trim(), password)
        if (error) setMsg({ type: "err", text: errText(error, true) })
        else setMsg({ type: "ok", text: "Account created. If email confirmation is on, check your inbox — otherwise just sign in." })
      }
    } catch (err) {
      setMsg({ type: "err", text: errText(err, mode === "signup") })
    }
    setBusy(false)
  }

  return (
    <div className={styles.wrap}>
      <motion.div className={styles.card} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
        <div className={styles.brand}>
          <Logo size={38} />
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
