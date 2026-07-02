import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import { CURRENCIES } from '../../lib/data.js'
import { Icon, Logo, Toast, ConfirmDialog } from '../ui/ui.jsx'
import {
  submitAccessRequest, uploadAttachment, createInvoice, listMyInvoices,
  deleteInvoice, attachmentUrl,
} from '../../lib/portalApi.js'
import styles from './Portal.module.css'

const pad = n => String(n).padStart(2, '0')
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const CURS = CURRENCIES.filter(c => ['USD', 'GBP', 'EUR', 'IRR', 'AED', 'TRY'].includes(c.code))
const symOf = (code) => (CURRENCIES.find(c => c.code === code) || {}).symbol || '$'
const money = (n, code) => {
  const amt = Number(n || 0)
  if (code === 'IRR') return amt.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' تومان'
  const dp = Math.round(amt * 100) % 100 === 0 ? 0 : 2
  return symOf(code) + amt.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
const STATUS = {
  pending: { tag: 'amber', label: 'Pending', hint: 'Waiting for your manager to review' },
  approved: { tag: 'green', label: 'Approved', hint: 'Approved — payment on the way' },
  paid: { tag: 'blue', label: 'Paid', hint: 'Paid' },
  rejected: { tag: 'red', label: 'Rejected', hint: 'Rejected — ask your manager if unsure' },
}
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const MAX_FILE_MB = 10

/* ---------- logged-out: sign in / sign up / request access ---------- */
function PortalAuth() {
  const { signIn, signUp } = useStore()
  const [tab, setTab] = useState('signin')       // signin | signup | request
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)           // { type, text }
  const [sent, setSent] = useState(false)

  const authErr = (error) => {
    let m = ''; try { m = String((error && (error.message || error.error_description)) ?? '').trim() } catch (e) {}
    const gate = !m || m === '{}' || m.startsWith('{') || /database error|unexpected_failure|saving new user|not authoris/i.test(m)
    if (tab === 'signup' && gate) return 'This email isn’t approved yet. Ask your manager to approve your access request first.'
    if (tab === 'signin' && /invalid login/i.test(m)) return 'Wrong email or password. If you haven’t made an account yet, use Sign up.'
    return m || 'Something went wrong — please try again.'
  }

  const submit = async (e) => {
    e.preventDefault(); if (busy) return
    setBusy(true); setMsg(null)
    try {
      if (tab === 'request') {
        if (!name.trim() || !email.trim()) { setMsg({ type: 'err', text: 'Add your name and email.' }); setBusy(false); return }
        await submitAccessRequest({ name, email, note })
        setSent(true)
      } else if (tab === 'signin') {
        const { error } = await signIn(email.trim(), password)
        if (error) setMsg({ type: 'err', text: authErr(error) })
      } else {
        const { error } = await signUp(email.trim(), password)
        if (error) setMsg({ type: 'err', text: authErr(error) })
        else setMsg({ type: 'ok', text: 'Account created — you can sign in now.' })
      }
    } catch (err) { setMsg({ type: 'err', text: authErr(err) }) }
    setBusy(false)
  }

  if (sent) return (
    <div className={styles.centered}>
      <Logo size={46} />
      <h2 style={{ margin: '10px 0 4px' }}>Request sent ✅</h2>
      <p className="muted" style={{ textAlign: 'center' }}>
        Your manager will review it. Once approved, come back and <b>Sign up</b> with a password using the same email.
      </p>
      <button className="btn ghost" onClick={() => { setSent(false); setTab('signin'); setName(''); setNote('') }}>Back</button>
    </div>
  )

  const TABS = [['signin', 'Sign in'], ['signup', 'Sign up'], ['request', 'Request access']]
  return (
    <>
      <div className={styles.brand}>
        <Logo size={40} />
        <div><b style={{ fontSize: 16 }}>Invoice portal</b><br /><small className="muted">Submit your invoices to the team</small></div>
      </div>
      <div className={styles.tabs}>
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? styles.tabOn : ''} onClick={() => { setTab(k); setMsg(null) }}>{l}</button>
        ))}
      </div>
      <form onSubmit={submit}>
        {tab === 'request' && (
          <div className="field"><label>Your full name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sara Ahmadi" autoFocus /></div>
        )}
        <div className="field"><label>Email{tab === 'request' ? ' *' : ''}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" required autoFocus={tab !== 'request'} /></div>
        {tab !== 'request' && (
          <div className="field"><label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required /></div>
        )}
        {tab === 'request' && (
          <div className="field"><label>Anything to add? (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Your role, which team… (optional)" /></div>
        )}
        {msg && <div className={`${styles.msg} ${msg.type === 'ok' ? styles.ok : styles.err}`}>{msg.text}</div>}
        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
          {busy ? '…' : tab === 'signin' ? 'Sign in' : tab === 'signup' ? 'Create account' : 'Send request'}
        </button>
      </form>
      {tab === 'signin' && (
        <p className={styles.hintFoot}>First time here?{' '}
          <button type="button" className={styles.linkBtn} onClick={() => { setTab('request'); setMsg(null) }}>Request access</button> — then sign up once approved.
        </p>
      )}
      {tab === 'signup' && <p className={styles.hintFoot}>Sign-up only works after a manager approves your access request.</p>}
    </>
  )
}

/* ---------- logged-in employee: submit + list invoices ---------- */
function InvoiceDesk() {
  const { session, signOut, notify, ask } = useStore()
  const userId = session.user.id
  const [name, setName] = useState(() => localStorage.getItem('portal_name') || (session.user.email || '').split('@')[0])
  const [rows, setRows] = useState(null)          // null = loading
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ amount: '', currency: 'USD', invoice_date: todayISO(), description: '' })
  const [file, setFile] = useState(null)
  const fileRef = useRef(null)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  const load = async () => { try { setRows(await listMyInvoices()) } catch (e) { setRows(r => r || []); notify('Couldn’t load your invoices', 'error') } }
  // realtime (own rows only, thanks to RLS) + a slow poll fallback, so status changes
  // made by the manager appear without a manual refresh
  useEffect(() => {
    load()
    const ch = supabase.channel('my-invoices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => load())
      .subscribe()
    const poll = setInterval(load, 45000)
    return () => { clearInterval(poll); supabase.removeChannel(ch) }
  }, [])
  useEffect(() => { localStorage.setItem('portal_name', name) }, [name])

  const pickFile = (e) => {
    const picked = e.target.files[0] || null
    if (picked && picked.size > MAX_FILE_MB * 1024 * 1024) {
      notify(`File is too big — ${MAX_FILE_MB} MB max`, 'error')
      e.target.value = ''
      return
    }
    setFile(picked)
  }
  const clearFile = () => { setFile(null); if (fileRef.current) fileRef.current.value = '' }

  const valid = Number(f.amount) > 0
  const submit = async (e) => {
    e.preventDefault(); if (busy || !valid) return
    setBusy(true)
    try {
      let attachment = null
      if (file) attachment = await uploadAttachment(userId, file)
      await createInvoice({
        user_id: userId, email: session.user.email, name: name.trim() || null,
        amount: Number(f.amount || 0), currency: f.currency, invoice_date: f.invoice_date || null,
        description: (f.description || '').trim() || null, attachment, status: 'pending',
      })
      setF({ amount: '', currency: f.currency, invoice_date: todayISO(), description: '' })
      clearFile()
      notify('Invoice submitted ✅', 'success'); load()
    } catch (err) { notify(err.message || 'Couldn’t submit — try again', 'error') }
    setBusy(false)
  }
  const remove = async (r) => {
    if (!await ask({ title: 'Delete invoice', message: `Delete the ${money(r.amount, r.currency)} invoice? This can’t be undone.`, confirmText: 'Delete' })) return
    try { await deleteInvoice(r.id, r.attachment); notify('Invoice deleted', 'info'); load() } catch (e) { notify('Couldn’t delete', 'error') }
  }
  const openFile = async (path) => { try { const u = await attachmentUrl(path); if (u) window.open(u, '_blank') } catch (e) { notify('Couldn’t open the file', 'error') } }

  // status counts + a per-currency total, so the employee sees where they stand at a glance
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, paid: 0, rejected: 0 }
    for (const r of rows || []) c[r.status || 'pending'] = (c[r.status || 'pending'] || 0) + 1
    return c
  }, [rows])
  const totals = useMemo(() => {
    const m = new Map()
    for (const r of rows || []) m.set(r.currency, (m.get(r.currency) || 0) + Number(r.amount || 0))
    return [...m.entries()]
  }, [rows])

  return (
    <div className={styles.deskWrap}>
      <header className={styles.deskHead}>
        <div className={styles.brand}>
          <Logo size={30} />
          <div><b>Invoice portal</b><br /><small className="muted">{session.user.email}</small></div>
        </div>
        <button className="btn ghost sm" onClick={signOut}><Icon name="logout" size={15} /> Sign out</button>
      </header>

      {rows && rows.length > 0 && (
        <div className={styles.summary}>
          {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
            <span key={k} className={`tag ${STATUS[k].tag}`} title={STATUS[k].hint}>{STATUS[k].label} · {n}</span>
          ))}
          <span className={styles.summaryTotal}>
            Total: {totals.map(([code, amt]) => money(amt, code)).join('  +  ')}
          </span>
        </div>
      )}

      <div className={styles.deskGrid}>
        {/* submit */}
        <form className="panel" onSubmit={submit} style={{ alignSelf: 'start' }}>
          <div className="panel-h"><span className="hicon"><Icon name="plus" size={16} /></span><h2>New invoice</h2></div>
          <div className="field"><label>Your name <small className="muted">(shown to your manager)</small></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></div>
          <div className="two">
            <div className="field"><label>Amount *</label>
              <input type="number" step="0.01" min="0.01" value={f.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" required /></div>
            <div className="field"><label>Currency</label>
              <select value={f.currency} onChange={e => set('currency', e.target.value)}>
                {CURS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select></div>
          </div>
          <div className="field"><label>Invoice date</label>
            <input type="date" value={f.invoice_date} onChange={e => set('invoice_date', e.target.value)} /></div>
          <div className="field"><label>What’s it for?</label>
            <textarea value={f.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Describe the work / expense…" /></div>
          <div className="field"><label>Attachment <small className="muted">(PDF or image, optional, ≤{MAX_FILE_MB} MB)</small></label>
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={pickFile} />
            {file ? (
              <div className={styles.fileChip}>
                <Icon name="copy" size={14} />
                <span className={styles.fileName} title={file.name}>{file.name}</span>
                <button type="button" className={styles.fileClear} onClick={clearFile} title="Remove file">✕</button>
              </div>
            ) : (
              <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} /> Choose file
              </button>
            )}
          </div>
          <button className="btn" type="submit" disabled={busy || !valid} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Submitting…' : 'Submit invoice'}
          </button>
        </form>

        {/* my invoices */}
        <div className="panel">
          <div className="panel-h">
            <span className="hicon"><Icon name="invoice" size={16} /></span><h2>Your invoices</h2>
            {rows && <span className="count">{rows.length}</span>}
            <div className="right"><button type="button" className="iconbtn" onClick={load} title="Refresh"><Icon name="refresh" size={16} /></button></div>
          </div>
          {rows === null ? <p className="muted" style={{ padding: '10px 2px' }}>Loading…</p>
            : rows.length === 0 ? (
              <div className="empty" style={{ padding: '30px 10px', lineHeight: 1.6 }}>
                <div className="big"><Icon name="invoice" size={30} strokeWidth={1.4} /></div>
                No invoices yet — submit your first one with the form.
              </div>
            ) : (
              <div className={styles.invList}>
                <AnimatePresence>
                  {rows.map(r => {
                    const st = STATUS[r.status] || STATUS.pending
                    return (
                      <motion.div key={r.id} className={styles.invRow} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className={styles.invMain}>
                          <b>{money(r.amount, r.currency)}</b>
                          <small className="muted">{fmtDate(r.invoice_date)}{r.description ? ' · ' + r.description : ''}</small>
                        </div>
                        <span className={`tag ${st.tag}`} title={st.hint}>{st.label}</span>
                        {r.attachment && <button type="button" className="iconbtn" title="View file" onClick={() => openFile(r.attachment)}><Icon name="eye" size={16} /></button>}
                        {(r.status || 'pending') === 'pending' && <button type="button" className="iconbtn del" title="Delete" onClick={() => remove(r)}><Icon name="trash" size={16} /></button>}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          <p className={styles.deskNote}><Icon name="alert" size={12} /> You can only delete an invoice while it’s still pending.</p>
        </div>
      </div>
    </div>
  )
}

/* ---------- a manager who opened the portal link by mistake ---------- */
function StaffNotice() {
  const { session, signOut } = useStore()
  const dashUrl = `${window.location.origin}${window.location.pathname}`
  return (
    <div className={styles.centered}>
      <Logo size={46} />
      <h2 style={{ margin: '10px 0 4px' }}>You’re signed in as staff</h2>
      <p className="muted" style={{ textAlign: 'center' }}>The invoice portal is for employees. Open your dashboard instead.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <a className="btn" href={dashUrl}>Open dashboard</a>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </div>
      <small className="muted" style={{ marginTop: 8 }}>{session.user.email}</small>
    </div>
  )
}

export default function Portal() {
  const { cloud, session, account, authReady } = useStore()
  let body
  if (!cloud) body = <div className={styles.authWrap}><div className={styles.card}><p className="muted">The portal needs the cloud (Supabase) setup.</p></div></div>
  else if (!authReady) body = <div className="splash"><Logo size={54} className="loading-logo" /></div>
  else if (!session) body = <div className={styles.authWrap}><div className={styles.card}><PortalAuth /></div></div>
  else if (account === 'employee') body = <InvoiceDesk />
  else if (account) body = <div className={styles.authWrap}><div className={styles.card}><StaffNotice /></div></div>
  else body = <div className="splash"><Logo size={54} className="loading-logo" /></div>

  return (
    <div className={styles.wrap}>
      {body}
      {/* the portal is its own page — without these, notifications & confirms would be invisible here */}
      <Toast />
      <ConfirmDialog />
    </div>
  )
}
