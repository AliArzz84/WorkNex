import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import { uid } from '../../lib/data.js'
import { Icon, Logo, Toast, ConfirmDialog } from '../ui/ui.jsx'
import {
  submitAccessRequest, uploadAttachment, createInvoice, listMyInvoices,
  deleteInvoice, attachmentUrl, INVOICE_CURRENCIES, invMoney,
} from '../../lib/portalApi.js'
import styles from './Portal.module.css'

const pad = n => String(n).padStart(2, '0')
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const STATUS = {
  pending: { tag: 'amber', label: 'Pending', hint: 'Waiting for your manager to review' },
  approved: { tag: 'green', label: 'Approved', hint: 'Approved — payment on the way' },
  paid: { tag: 'blue', label: 'Paid', hint: 'Paid' },
  rejected: { tag: 'red', label: 'Rejected', hint: 'Rejected — ask your manager if unsure' },
}
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const MAX_FILE_MB = 10

/* little sun/moon button — the app theme is global, the portal just needs its own switch */
function ThemeBtn() {
  const { theme, toggleTheme } = useStore()
  return (
    <button type="button" className={styles.themeBtn} onClick={toggleTheme} title="Toggle dark mode" aria-label="Toggle theme">
      <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
    </button>
  )
}

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
      <div className={styles.brand} style={{ marginBottom: 18 }}>
        <Logo size={40} />
        <div style={{ flex: 1 }}><b style={{ fontSize: 16 }}>Invoice portal</b><br /><small className="muted">Submit your invoices to the team</small></div>
        <ThemeBtn />
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

/* ---------- logged-in employee: a proper invoice form + their history ---------- */
function InvoiceDesk() {
  const { session, signOut, notify, ask } = useStore()
  const userId = session.user.id
  const [rows, setRows] = useState(null)          // null = loading
  const [busy, setBusy] = useState(false)

  // details that rarely change are remembered on this device, so the employee
  // fills them once and every next invoice is just items + dates
  const [name, setName] = useState(() => localStorage.getItem('portal_name') || (session.user.email || '').split('@')[0])
  const [phone, setPhone] = useState(() => localStorage.getItem('portal_phone') || '')
  const [pay, setPay] = useState(() => {
    try { return { bank_name: '', account_holder: '', iban: '', ...JSON.parse(localStorage.getItem('portal_pay') || '{}') } }
    catch (e) { return { bank_name: '', account_holder: '', iban: '' } }
  })
  const setPayK = (k, v) => setPay(s => ({ ...s, [k]: v }))
  useEffect(() => { localStorage.setItem('portal_name', name) }, [name])
  useEffect(() => { localStorage.setItem('portal_phone', phone) }, [phone])
  useEffect(() => { localStorage.setItem('portal_pay', JSON.stringify(pay)) }, [pay])

  const [f, setF] = useState({ invoice_no: '', currency: 'USD', invoice_date: todayISO(), due_date: '', notes: '' })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  // line items — description × qty × price, like a real invoice
  const mkItem = () => ({ id: uid('it'), desc: '', qty: 1, rate: '' })
  const [items, setItems] = useState([mkItem()])
  const setItem = (id, k, v) => setItems(list => list.map(it => it.id === id ? { ...it, [k]: v } : it))
  const addItem = () => setItems(list => [...list, mkItem()])
  const delItem = (id) => setItems(list => list.length > 1 ? list.filter(it => it.id !== id) : list)
  const lineTotal = (it) => (Number(it.qty) || 0) * (Number(it.rate) || 0)
  const moneyRows = items.filter(it => lineTotal(it) > 0)
  const total = moneyRows.reduce((s, it) => s + lineTotal(it), 0)
  const valid = total > 0 && moneyRows.every(it => (it.desc || '').trim())

  const [file, setFile] = useState(null)
  const fileRef = useRef(null)

  const load = async () => { try { setRows(await listMyInvoices()) } catch (e) { setRows(r => r || []); notify('Couldn’t load your invoices', 'error') } }
  // realtime (own rows only via RLS) + slow poll fallback → manager status changes appear live
  useEffect(() => {
    load()
    const ch = supabase.channel('my-invoices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => load())
      .subscribe()
    const poll = setInterval(load, 45000)
    return () => { clearInterval(poll); supabase.removeChannel(ch) }
  }, [])

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

  const suggestNo = 'INV-' + String(((rows && rows.length) || 0) + 1).padStart(3, '0')

  const submit = async (e) => {
    e.preventDefault(); if (busy || !valid) return
    setBusy(true)
    try {
      let attachment = null
      if (file) attachment = await uploadAttachment(userId, file)
      const cleanItems = moneyRows.map(it => ({ desc: it.desc.trim(), qty: Number(it.qty) || 0, rate: Number(it.rate) || 0 }))
      await createInvoice({
        user_id: userId, email: session.user.email,
        name: name.trim() || null, phone: phone.trim() || null,
        invoice_no: (f.invoice_no || '').trim() || suggestNo,
        amount: total, currency: f.currency,
        invoice_date: f.invoice_date || null, due_date: f.due_date || null,
        description: cleanItems.map(i => i.desc).join(' · ').slice(0, 300) || null,   // summary for list views
        items: cleanItems,
        bank_name: (pay.bank_name || '').trim() || null,
        account_holder: (pay.account_holder || '').trim() || null,
        iban: (pay.iban || '').trim() || null,
        notes: (f.notes || '').trim() || null,
        attachment, status: 'pending',
      })
      setF({ invoice_no: '', currency: f.currency, invoice_date: todayISO(), due_date: '', notes: '' })
      setItems([mkItem()])
      clearFile()
      notify('Invoice submitted ✅', 'success'); load()
    } catch (err) { notify(err.message || 'Couldn’t submit — try again', 'error') }
    setBusy(false)
  }
  const remove = async (r) => {
    if (!await ask({ title: 'Delete invoice', message: `Delete the ${invMoney(r.amount, r.currency)} invoice? This can’t be undone.`, confirmText: 'Delete' })) return
    try { await deleteInvoice(r.id, r.attachment); notify('Invoice deleted', 'info'); load() } catch (e) { notify('Couldn’t delete', 'error') }
  }
  const openFile = async (path) => { try { const u = await attachmentUrl(path); if (u) window.open(u, '_blank') } catch (e) { notify('Couldn’t open the file', 'error') } }

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
        <div className={styles.headActions}>
          <ThemeBtn />
          <button className="btn ghost sm" onClick={signOut}><Icon name="logout" size={15} /> Sign out</button>
        </div>
      </header>

      {rows && rows.length > 0 && (
        <div className={styles.summary}>
          {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
            <span key={k} className={`tag ${STATUS[k].tag}`} title={STATUS[k].hint}>{STATUS[k].label} · {n}</span>
          ))}
          <span className={styles.summaryTotal}>
            Total: {totals.map(([code, amt]) => invMoney(amt, code)).join('  +  ')}
          </span>
        </div>
      )}

      <div className={styles.deskGrid}>
        {/* ── the invoice form ── */}
        <form className="panel" onSubmit={submit} style={{ alignSelf: 'start' }}>
          <div className="panel-h"><span className="hicon"><Icon name="plus" size={16} /></span><h2>New invoice</h2></div>

          <div className={styles.secHead}>Invoice details</div>
          <div className="two">
            <div className="field"><label>Invoice #</label>
              <input value={f.invoice_no} onChange={e => set('invoice_no', e.target.value)} placeholder={suggestNo} /></div>
            <div className="field"><label>Currency</label>
              <div className={styles.curSeg}>
                {INVOICE_CURRENCIES.map(c => (
                  <button type="button" key={c.code} className={f.currency === c.code ? styles.curOn : ''}
                    onClick={() => set('currency', c.code)}>{c.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="two">
            <div className="field"><label>Invoice date</label>
              <input type="date" value={f.invoice_date} onChange={e => set('invoice_date', e.target.value)} /></div>
            <div className="field"><label>Due date <small className="muted">(optional)</small></label>
              <input type="date" value={f.due_date} onChange={e => set('due_date', e.target.value)} /></div>
          </div>

          <div className={styles.secHead}>Items</div>
          <div className={styles.items}>
            <div className={styles.itemHead}><span>What did you do?</span><span>Qty</span><span>Price</span><span /></div>
            {items.map(it => (
              <div className={styles.itemRow} key={it.id}>
                <input value={it.desc} onChange={e => setItem(it.id, 'desc', e.target.value)} placeholder="e.g. UI design — landing page" />
                <input type="number" min="1" step="1" value={it.qty} onChange={e => setItem(it.id, 'qty', e.target.value)} />
                <input type="number" min="0" step="0.01" value={it.rate} onChange={e => setItem(it.id, 'rate', e.target.value)} placeholder="0.00" />
                <button type="button" className={styles.itemDel} onClick={() => delItem(it.id)} disabled={items.length === 1} title="Remove item">
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
            <button type="button" className={styles.addItem} onClick={addItem}><Icon name="plus" size={13} /> Add item</button>
            <div className={styles.totalRow}><span>Total</span><b>{invMoney(total, f.currency)}</b></div>
          </div>

          <div className={styles.secHead}>Your details</div>
          <div className="two">
            <div className="field"><label>Full name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></div>
            <div className="field"><label>Phone <small className="muted">(optional)</small></label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+374 …" /></div>
          </div>

          <div className={styles.secHead}>Payment details <small className="muted">· how you get paid — saved on this device</small></div>
          <div className="two">
            <div className="field"><label>Bank</label>
              <input value={pay.bank_name} onChange={e => setPayK('bank_name', e.target.value)} placeholder="e.g. Ameriabank" /></div>
            <div className="field"><label>Account holder</label>
              <input value={pay.account_holder} onChange={e => setPayK('account_holder', e.target.value)} placeholder="Name on the account" /></div>
          </div>
          <div className="field"><label>IBAN / account / card number</label>
            <input value={pay.iban} onChange={e => setPayK('iban', e.target.value)} placeholder="AM… / GB… / card number" /></div>

          <div className={styles.secHead}>Extras</div>
          <div className="field"><label>Notes <small className="muted">(optional)</small></label>
            <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Anything your manager should know…" /></div>
          <div className="field"><label>Attachment <small className="muted">(PDF or image, ≤{MAX_FILE_MB} MB)</small></label>
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
            {busy ? 'Submitting…' : total > 0 ? `Submit invoice · ${invMoney(total, f.currency)}` : 'Submit invoice'}
          </button>
          {!valid && total > 0 && <small className={styles.formHint}>Each item with a price needs a description.</small>}
        </form>

        {/* ── their invoice history ── */}
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
                      <motion.div key={r.id} className={`${styles.invRow} ${styles['st_' + (r.status || 'pending')]}`}
                        layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className={styles.invMain}>
                          <div className={styles.invTop}>
                            <b>{invMoney(r.amount, r.currency)}</b>
                            {r.invoice_no && <span className={styles.invNo}>{r.invoice_no}</span>}
                          </div>
                          <small className="muted">
                            {fmtDate(r.invoice_date)}{r.due_date ? ` · due ${fmtDate(r.due_date)}` : ''}{r.description ? ' · ' + r.description : ''}
                          </small>
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
