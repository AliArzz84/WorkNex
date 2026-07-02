import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import { EmptyState, Icon, Tag, stagger, item } from '../../components/ui/ui.jsx'
import {
  listAllInvoices, updateInvoice, deleteInvoice, attachmentUrl,
  approveAccessRequest, rejectAccessRequest, deleteAccessRequest,
} from '../../lib/portalApi.js'
import styles from './Invoices.module.css'

const STATUS = { pending: ['amber', 'Pending'], approved: ['green', 'Approved'], paid: ['blue', 'Paid'], rejected: ['red', 'Rejected'] }
const STATUS_OPTS = [['pending', 'Pending'], ['approved', 'Approved'], ['paid', 'Paid'], ['rejected', 'Rejected']]
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtWhen = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

/* pending access requests — approve adds them to the allow-list as an employee */
function AccessRequests() {
  const { accessRequests, reloadAccessRequests, notify, ask } = useStore()
  const [busy, setBusy] = useState(null)
  const reqs = accessRequests || []
  const pending = reqs.filter(r => (r.status || 'pending') === 'pending')
  const [showAll, setShowAll] = useState(false)
  const list = showAll ? reqs : pending
  if (!reqs.length) return null

  const act = async (id, fn, okMsg) => {
    setBusy(id)
    try { await fn(id); notify?.(okMsg, 'success') } catch (e) { notify?.(e.message || 'Failed', 'error') }
    reloadAccessRequests?.(); setBusy(null)
  }
  const approve = (r) => act(r.id, approveAccessRequest, `${r.name} approved — they can sign up now`)
  const reject = (r) => act(r.id, rejectAccessRequest, 'Request rejected')
  const remove = async (r) => { if (await ask({ title: 'Delete request', message: `Remove ${r.name}'s request?` })) act(r.id, deleteAccessRequest, 'Deleted') }

  return (
    <div className="panel">
      <div className="panel-h">
        <span className="hicon"><Icon name="employees" size={16} /></span>
        <h2>Access requests</h2>
        {pending.length > 0 && <span className="count">{pending.length}</span>}
        <div className="right">
          <button className="btn ghost sm" onClick={() => setShowAll(s => !s)}>{showAll ? 'Show pending' : 'Show all'}</button>
        </div>
      </div>
      {list.length === 0
        ? <p className="muted" style={{ padding: '8px 2px' }}>No pending requests.</p>
        : (
          <motion.div variants={stagger} initial="initial" animate="animate">
            <AnimatePresence>
              {list.map(r => {
                const status = r.status || 'pending'
                return (
                  <motion.div key={r.id} className={`alert ${status === 'pending' ? 'blue' : status === 'approved' ? 'green' : 'gray'}`} variants={item} layout exit={{ opacity: 0, x: 24 }}>
                    <div className="dot" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{r.name} {status !== 'pending' && <Tag color={status === 'approved' ? 'green' : 'gray'}>{status}</Tag>}</b>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{r.email}{r.note ? ' · ' + r.note : ''}</p>
                      <small className="muted">{fmtWhen(r.created_at)}</small>
                    </div>
                    <div className="row-actions">
                      {status === 'pending' && <>
                        <button className="btn sm" disabled={busy === r.id} onClick={() => approve(r)}><Icon name="check" size={14} /> Approve</button>
                        <button className="iconbtn" title="Reject" disabled={busy === r.id} onClick={() => reject(r)}><Icon name="alert" size={16} /></button>
                      </>}
                      <button className="iconbtn del" title="Delete" onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
    </div>
  )
}

export default function Invoices() {
  const { db, cloud, money, toUsd, fmtBase, notify, ask } = useStore()
  const [rows, setRows] = useState(null)      // null = loading
  const [filter, setFilter] = useState('all')

  const load = async () => { try { setRows(await listAllInvoices()) } catch (e) { setRows([]); notify?.('Couldn’t load invoices', 'error') } }
  useEffect(() => {
    if (!cloud) { setRows([]); return }
    load()
    const ch = supabase.channel('invoices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, load).subscribe()
    return () => supabase.removeChannel(ch)
  }, [cloud])

  const projName = (id) => db.projects.find(p => p.id === id)?.name || ''
  const setStatus = async (r, status) => { try { await updateInvoice(r.id, { status }); load() } catch (e) { notify?.('Couldn’t update', 'error') } }
  const setProject = async (r, project) => { try { await updateInvoice(r.id, { project: project || null }); load() } catch (e) { notify?.('Couldn’t update', 'error') } }
  const remove = async (r) => { if (await ask({ title: 'Delete invoice', message: 'Delete this invoice and its file?' })) { try { await deleteInvoice(r.id, r.attachment); load() } catch (e) { notify?.('Couldn’t delete', 'error') } } }
  const openFile = async (path) => { try { const u = await attachmentUrl(path); if (u) window.open(u, '_blank') } catch (e) { notify?.('Couldn’t open the file', 'error') } }

  const shown = useMemo(() => (rows || []).filter(r => filter === 'all' || (r.status || 'pending') === filter), [rows, filter])
  // group by employee (user_id), newest activity first
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of shown) {
      const g = map.get(r.user_id) || { userId: r.user_id, name: r.name, email: r.email, items: [] }
      if (!g.name && r.name) g.name = r.name
      g.items.push(r)
      map.set(r.user_id, g)
    }
    return [...map.values()]
  }, [shown])

  const pendingCount = (rows || []).filter(r => (r.status || 'pending') === 'pending').length
  const filters = [['all', 'All'], ['pending', `Pending${pendingCount ? ` (${pendingCount})` : ''}`], ['approved', 'Approved'], ['paid', 'Paid'], ['rejected', 'Rejected']]

  if (!cloud) return <div className="panel"><EmptyState icon="invoice" text="The invoice portal needs the cloud (Supabase) setup." /></div>

  return (
    <div>
      <AccessRequests />

      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="invoice" size={16} /></span>
          <h2>Invoices</h2>
          {rows && <span className="count">{rows.length}</span>}
        </div>
        <div className="pill-row" style={{ marginBottom: 12 }}>
          {filters.map(([k, l]) => <span key={k} className={`pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</span>)}
        </div>

        {rows === null ? <p className="muted" style={{ padding: '10px 2px' }}>Loading…</p>
          : groups.length === 0 ? <EmptyState icon="invoice" text={filter === 'all' ? 'No invoices submitted yet' : 'None in this status'} />
            : groups.map(g => {
              const total = g.items.reduce((s, r) => s + toUsd(Number(r.amount || 0), r.currency), 0)
              return (
                <div className={styles.group} key={g.userId}>
                  <div className={styles.groupHead}>
                    <b>{g.name || (g.email || '').split('@')[0] || 'Employee'}</b>
                    <small className="muted">{g.email}</small>
                    <span className={styles.groupTotal}>{g.items.length} · {fmtBase(total)}</span>
                  </div>
                  <div className={styles.table}>
                    {g.items.map(r => {
                      const st = STATUS[r.status] || STATUS.pending
                      return (
                        <div className={styles.row} key={r.id}>
                          <div className={styles.amt}>
                            <b>{money(r.amount, r.currency)}</b>
                            {r.currency !== 'USD' && <small className="muted">{fmtBase(toUsd(Number(r.amount || 0), r.currency))}</small>}
                          </div>
                          <div className={styles.desc}>
                            <span>{r.description || <span className="muted">—</span>}</span>
                            <small className="muted">{fmtDate(r.invoice_date)}</small>
                          </div>
                          <select className={styles.proj} value={r.project || ''} onChange={e => setProject(r, e.target.value)} title="Link to a project">
                            <option value="">No project</option>
                            {/* keep a linked-but-deleted project visible instead of a blank select */}
                            {r.project && !db.projects.some(p => p.id === r.project) && <option value={r.project}>(deleted project)</option>}
                            {db.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select className={`${styles.status} ${styles['s_' + (r.status || 'pending')]}`} value={r.status || 'pending'} onChange={e => setStatus(r, e.target.value)}>
                            {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <div className={styles.rowActions}>
                            {r.attachment
                              ? <button className="iconbtn" title="View file" onClick={() => openFile(r.attachment)}><Icon name="eye" size={16} /></button>
                              : <span className={styles.noFile} title="No attachment"><Icon name="mail" size={15} /></span>}
                            <button className="iconbtn del" title="Delete" onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
      </div>
    </div>
  )
}
