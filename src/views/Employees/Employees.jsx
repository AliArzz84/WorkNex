import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Avatar, StatusTag, Tag, EmptyState, Icon, Money, item } from '../../components/ui/ui.jsx'
import styles from './Employees.module.css'

export default function Employees() {
  const { db, t, L, lang, money, search, openEditor, removeItem, ask } = useStore()
  const [countryFilter, setCountryFilter] = useState("all")
  const [bizFilter, setBizFilter] = useState("all")

  const bizName = (id) => db.businesses.find(b => b.id === id)?.name
  const countries = [...new Set(db.employees.map(e => e.country).filter(Boolean))]
  let rows = db.employees.filter(e => JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))
  if (bizFilter !== "all") rows = rows.filter(e => (e.business || "") === bizFilter)
  if (countryFilter !== "all") rows = rows.filter(e => (e.country || "") === countryFilter)

  return (
    <div>
      {db.businesses.length > 0 && (
        <div className="pill-row">
          <span className={`pill ${bizFilter === "all" ? "on" : ""}`} onClick={() => setBizFilter("all")}>{L.all} businesses</span>
          {db.businesses.map(b => (
            <span key={b.id} className={`pill ${bizFilter === b.id ? "on" : ""}`} onClick={() => setBizFilter(b.id)}>{b.name}</span>
          ))}
        </div>
      )}
      <div className="pill-row">
        <span className={`pill ${countryFilter === "all" ? "on" : ""}`} onClick={() => setCountryFilter("all")}>{L.all}</span>
        {countries.map(c => (
          <span key={c} className={`pill ${countryFilter === c ? "on" : ""}`} onClick={() => setCountryFilter(c)}>{c}</span>
        ))}
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
                  <td><div className="person"><Avatar emp={e} /><div>
                    <b>{e.name}</b>
                    <small>{e.role} • {e.email}</small>
                    <div className={styles.empTeams}>
                      {bizName(e.business) && <Tag color="green"><Icon name="business" size={11} /> {bizName(e.business)}</Tag>}
                      {empTeams.length
                        ? empTeams.map(tm => <Tag key={tm.id} color="amber">{tm.name}</Tag>)
                        : <Tag color="gray">{t("noTeam")}</Tag>}
                    </div>
                    {e.notes && <small className={styles.empNote}>📝 {e.notes}</small>}
                  </div></div></td>
                  <td>{e.country ? <Tag color="blue">{e.country}</Tag> : L.none}</td>
                  <td><Money value={e.salary} currency={e.currency} /></td>
                  <td>{lang === "fa" ? "روز " + e.payDay : "Day " + e.payDay}</td>
                  <td><StatusTag status={e.status} /></td>
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
