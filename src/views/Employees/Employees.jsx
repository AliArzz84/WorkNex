import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Avatar, StatusTag, Tag, EmptyState, Icon, Money, item } from '../../components/ui/ui.jsx'
import styles from './Employees.module.css'

export default function Employees() {
  const { db, t, L, lang, search, openEditor, removeItem, ask, notify } = useStore()
  const copy = async (text, label) => { try { await navigator.clipboard.writeText(text); notify((label || "Copied") + " copied", "success") } catch (e) { } }
  const [countryFilter, setCountryFilter] = useState("all")
  const [bizFilter, setBizFilter] = useState("all")
  const [open, setOpen] = useState(() => new Set())   // employee rows whose contact details are expanded
  const toggle = (id) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const bizName = (id) => db.businesses.find(b => b.id === id)?.name
  const countries = [...new Set(db.employees.map(e => e.country).filter(Boolean))]
  let rows = db.employees.filter(e => JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))
  if (bizFilter !== "all") rows = rows.filter(e => (e.business || "") === bizFilter)
  if (countryFilter !== "all") rows = rows.filter(e => (e.country || "") === countryFilter)

  return (
    <div>
      <div className="filters">
        {db.businesses.length > 0 && (
          <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}>
            <option value="all">All businesses</option>
            {db.businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
          <option value="all">All locations</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>{t("nav.employees")}<span className="count">{rows.length}</span></h2></div>
        <table>
          <thead><tr>
            <th>{t("name")}</th><th>{t("country")}</th><th>{t("salary")}</th><th>{t("payDay")}</th><th>{t("status")}</th><th className="right">{t("actions")}</th>
          </tr></thead>
          <tbody>
            <AnimatePresence>
              {rows.map(e => {
                const empTeams = db.teams.filter(tm => (tm.members || []).includes(e.id))
                return (
                  <motion.tr key={e.id} variants={item} initial="initial" animate="animate" exit={{ opacity: 0 }} layout>
                    <td><div className="person" style={{ alignItems: "flex-start" }}><Avatar emp={e} /><div className={styles.pmain}>
                      <div className={styles.nameRow}>
                        <b>{e.name}</b>
                        <button className={`${styles.expandBtn} ${open.has(e.id) ? styles.expandOn : ""}`}
                          onClick={() => toggle(e.id)} aria-label="Show contact details"
                          title={open.has(e.id) ? "Hide contact" : "Show email & phone"}>
                          <Icon name="chevron" size={14} />
                        </button>
                      </div>
                      {e.role
                        ? <span className={styles.role}>{e.role}</span>
                        : <span className={styles.roleNone}>No role set</span>}
                      <div className={styles.empTeams}>
                        {bizName(e.business) && <Tag color="green"><Icon name="business" size={11} /> {bizName(e.business)}</Tag>}
                        {empTeams.length
                          ? empTeams.map(tm => <Tag key={tm.id} color="amber">{tm.name}</Tag>)
                          : <Tag color="gray">{t("noTeam")}</Tag>}
                      </div>
                      {e.notes && <div className={styles.empNote}><span className={styles.noteIcon}>📝</span><span>{e.notes}</span></div>}
                      <AnimatePresence initial={false}>
                        {open.has(e.id) && (
                          <motion.div className={styles.details} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div className={styles.detailsInner}>
                              {e.email
                                ? <a className={styles.detailRow} href={`mailto:${e.email}`}><Icon name="mail" size={13} /> {e.email}</a>
                                : <span className={`${styles.detailRow} ${styles.detailMuted}`}><Icon name="mail" size={13} /> No email on file</span>}
                              {e.phone && <a className={styles.detailRow} href={`tel:${e.phone}`}><Icon name="phone" size={13} /> {e.phone}</a>}
                              {(e.cardNumber || e.iban || e.bankName) && <div className={styles.bankDiv} />}
                              {e.cardNumber && (
                                <div className={styles.detailRow}><Icon name="wallet" size={13} />
                                  <span className={styles.detailNum}>{e.cardNumber}</span>
                                  <button type="button" className={styles.copyBtn} onClick={() => copy(e.cardNumber, "Card number")} title="Copy card number"><Icon name="copy" size={12} /></button>
                                </div>
                              )}
                              {e.iban && (
                                <div className={styles.detailRow}><Icon name="finance" size={13} />
                                  <span className={styles.detailNum}>{e.iban}</span>
                                  <button type="button" className={styles.copyBtn} onClick={() => copy(e.iban, "IBAN")} title="Copy IBAN"><Icon name="copy" size={12} /></button>
                                </div>
                              )}
                              {(e.bankName || e.accountHolder) && <span className={`${styles.detailRow} ${styles.detailMuted}`}><Icon name="business" size={13} /> {[e.bankName, e.accountHolder].filter(Boolean).join(" · ")}</span>}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div></div></td>
                    <td data-label={t("country")}>{e.country ? <Tag color="blue">{e.country}</Tag> : L.none}</td>
                    <td data-label={t("salary")}><Money value={e.salary} currency={e.currency} convertible /></td>
                    <td data-label={t("payDay")}>{lang === "fa" ? "روز " + e.payDay : "Day " + e.payDay}</td>
                    <td data-label={t("status")}><StatusTag status={e.status} /></td>
                    <td className="right">
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="iconbtn" onClick={() => openEditor("employee", e.id)}><Icon name="edit" size={16} /></button>
                        <button className="iconbtn del" onClick={async () => { if (await ask(t("confirmDel"))) removeItem("employee", e.id) }}><Icon name="trash" size={16} /></button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {!rows.length && <EmptyState icon="employees" text={t("noData")} />}
      </div>
    </div>
  )
}
