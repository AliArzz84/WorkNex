import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store.jsx'
import { Avatar, StatusTag, Tag, EmptyState, Icon, Money, item } from '../ui.jsx'

export default function Employees() {
  const { db, t, L, lang, money, teamById, search, openEditor, removeItem } = useStore()
  const [teamFilter, setTeamFilter] = useState("all")

  let rows = db.employees.filter(e => JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))
  if (teamFilter !== "all") rows = rows.filter(e => e.team === teamFilter)

  return (
    <div>
      <div className="pill-row">
        <span className={`pill ${teamFilter === "all" ? "on" : ""}`} onClick={() => setTeamFilter("all")}>{L.all}</span>
        {db.teams.map(tm => (
          <span key={tm.id} className={`pill ${teamFilter === tm.id ? "on" : ""}`} onClick={() => setTeamFilter(tm.id)}>{tm.name}</span>
        ))}
      </div>
      <div className="panel">
        <div className="panel-h"><h2>{t("nav.employees")}<span className="count">{rows.length}</span></h2></div>
        <table>
          <thead><tr>
            <th>{t("name")}</th><th>{t("team")}</th><th>{t("salary")}</th><th>{t("payDay")}</th><th>{t("status")}</th><th className="right">{t("actions")}</th>
          </tr></thead>
          <tbody>
            <AnimatePresence>
              {rows.map(e => (
                <motion.tr key={e.id} variants={item} initial="initial" animate="animate" exit={{ opacity: 0 }} layout>
                  <td><div className="person"><Avatar emp={e} /><div><b>{e.name}</b><small>{e.role} • {e.email}</small></div></div></td>
                  <td>{teamById(e.team) ? <Tag color="blue">{teamById(e.team).name}</Tag> : L.none}</td>
                  <td><Money value={e.salary} /></td>
                  <td>{lang === "fa" ? "روز " + e.payDay : "Day " + e.payDay}</td>
                  <td><StatusTag status={e.status} /></td>
                  <td className="right">
                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="iconbtn" onClick={() => openEditor("employee", e.id)}><Icon name="edit" size={16} /></button>
                      <button className="iconbtn del" onClick={() => confirm(t("confirmDel")) && removeItem("employee", e.id)}><Icon name="trash" size={16} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {!rows.length && <EmptyState icon="employees" text={t("noData")} />}
      </div>
    </div>
  )
}
