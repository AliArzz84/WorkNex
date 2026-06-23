import { motion } from 'framer-motion'
import { useStore } from '../store.jsx'
import { Avatar, Counter, Tag, Icon, Money, stagger, item } from '../ui.jsx'
import { daysBetween, nextPayday, periodKey } from '../data.js'

export default function Payroll() {
  const { db, t, money, fmtDate, relDay, isPaid, setPaid } = useStore()
  const active = db.employees.filter(e => e.status !== "inactive")
  const total = db.employees.filter(e => e.status === "active").reduce((s, e) => s + Number(e.salary || 0), 0)
  const rows = active.map(e => {
    const pd = nextPayday(e); const per = periodKey(pd)
    return { e, pd, dd: daysBetween(pd.toISOString()), per, paid: isPaid(e.id, per) }
  }).sort((a, b) => (a.paid - b.paid) || (a.dd - b.dd))

  const kpis = [
    { icon: "wallet", v: <Money value={total} />, p: t("totalPayroll"), small: true, cls: "k1" },
    { icon: "clock", v: rows.filter(r => !r.paid && r.dd <= 7).length, p: t("kpi.duePay"), cls: "k3" },
    { icon: "alert", v: rows.filter(r => !r.paid && r.dd < 0).length, p: t("overdue"), cls: "k4" },
    { icon: "check", v: rows.filter(r => r.paid).length, p: t("paid"), cls: "k2" },
  ]

  return (
    <div>
      <motion.div className="kpis" variants={stagger} initial="initial" animate="animate">
        {kpis.map((k, i) => (
          <motion.div key={i} className={`kpi ${k.cls}`} variants={item} whileHover={{ y: -3 }}>
            <div className="ic"><Icon name={k.icon} size={20} /></div>
            <h3 style={{ fontSize: k.small ? 19 : 28 }}>{k.small ? k.v : <Counter value={k.v} />}</h3>
            <p>{k.p}</p>
          </motion.div>
        ))}
      </motion.div>
      <div className="panel">
        <div className="panel-h"><h2>{t("nav.payroll")}</h2></div>
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("salary")}</th><th>{t("nextPay")}</th><th>{t("status")}</th><th className="right">{t("actions")}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <motion.tr key={r.e.id} variants={item} initial="initial" animate="animate" layout>
                <td><div className="person"><Avatar emp={r.e} /><div><b>{r.e.name}</b><small>{r.e.role}</small></div></div></td>
                <td><Money value={r.e.salary} /></td>
                <td>{fmtDate(r.pd.toISOString())}<br /><small className="muted">{r.paid ? "" : relDay(r.dd)}</small></td>
                <td>
                  {r.paid ? <Tag color="green">✓ {t("paid")}</Tag>
                    : r.dd < 0 ? <Tag color="red">{t("overdue")}</Tag>
                      : r.dd === 0 ? <Tag color="amber">{t("dueToday")}</Tag>
                        : <Tag color="amber">{r.dd} {t("daysLeft")}</Tag>}
                </td>
                <td className="right">
                  <button className={`btn sm pay-action ${r.paid ? "ghost" : ""}`} onClick={() => setPaid(r.e.id, r.per, !r.paid)}>
                    <Icon name={r.paid ? "undo" : "check"} size={14} /> {r.paid ? t("markUnpaid") : t("markPaid")}
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
