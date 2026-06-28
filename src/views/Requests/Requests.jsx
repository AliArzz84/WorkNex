import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { EmptyState, Icon, Tag, stagger, item } from '../../components/ui/ui.jsx'
import { REQUEST_CAT } from '../../lib/data.js'

export default function Requests() {
  // `requests` is kept live by the store (realtime + polling) — new submissions appear on their own
  const { requests, requestsReady, setRequestStatus, deleteRequest, reloadRequests, notify, ask, timeAgo } = useStore()
  const [filter, setFilter] = useState("new")

  const reqs = requests || []
  const loading = !requestsReady

  const link = `${window.location.origin}${window.location.pathname}?request=1`
  const copyLink = async () => { try { await navigator.clipboard.writeText(link); notify("Form link copied — send it to your team", "success") } catch (e) {} }

  const statusOf = (r) => r.status || "new"
  const newCount = reqs.filter(r => statusOf(r) === "new").length
  const shown = filter === "all" ? reqs : reqs.filter(r => statusOf(r) === filter)

  const toggleDone = async (r) => { try { await setRequestStatus(r.id, statusOf(r) === "done" ? "new" : "done"); reloadRequests() } catch (e) { notify("Couldn't update", "error") } }
  const remove = async (r) => { if (await ask({ title: "Delete request", message: "Delete this request?" })) { try { await deleteRequest(r.id); reloadRequests() } catch (e) { notify("Couldn't delete", "error") } } }

  const filters = [["new", `New (${newCount})`], ["done", "Done"], ["all", "All"]]

  return (
    <div>
      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="chat" size={16} /></span>
          <h2>Requests<span className="count">{reqs.length}</span></h2>
          <div className="right"><button className="btn ghost sm" onClick={copyLink}><Icon name="link" size={14} /> Copy form link</button></div>
        </div>
        <p className="muted" style={{ margin: "-2px 2px 14px", fontSize: 13 }}>
          Share the form link with your team — anyone with it can submit a request (their name, contact, and what they need), no account needed. Submissions land here.
        </p>
        <div className="pill-row">
          {filters.map(([k, l]) => <span key={k} className={`pill ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</span>)}
        </div>
        {loading ? <p className="muted" style={{ padding: "10px 2px" }}>Loading…</p>
          : shown.length ? (
            <motion.div variants={stagger} initial="initial" animate="animate">
              <AnimatePresence>
                {shown.map(r => (
                  <motion.div key={r.id} className={`alert ${statusOf(r) === "done" ? "gray" : "blue"}`} variants={item} layout exit={{ opacity: 0, x: 24 }}>
                    <div className="dot" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{r.name} {r.category && REQUEST_CAT[r.category] && <Tag color={REQUEST_CAT[r.category].color}>{REQUEST_CAT[r.category].label}</Tag>} {statusOf(r) === "done" && <Tag color="green">done</Tag>}</b>
                      <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
                      <small className="muted">{r.channel || "—"}{r.contact ? " · " + r.contact : ""} · {timeAgo(new Date(r.created_at).getTime())}</small>
                    </div>
                    <div className="row-actions">
                      <button className="iconbtn" title={statusOf(r) === "done" ? "Mark as new" : "Mark done"} onClick={() => toggleDone(r)}><Icon name="check" size={16} /></button>
                      <button className="iconbtn del" title="Delete" onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : <EmptyState icon="chat" text={filter === "new" ? "No new requests" : "Nothing here"} />}
      </div>
    </div>
  )
}
