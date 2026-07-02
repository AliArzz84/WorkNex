import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Avatar, Counter, Tag, Icon, Money, CurrencyToggle, EmptyState, stagger, item } from '../../components/ui/ui.jsx'
import { daysBetween, nextPayday, periodKey } from '../../lib/data.js'

export default function Payroll() {
  const { db, t, toUsd, fmtDate, relDay, isPaid, setPaid, ask, notify } = useStore()
  const copyCard = async (card) => { try { await navigator.clipboard.writeText(card); notify("Card number copied", "success") } catch (e) { } }
  const [bizFilter, setBizFilter] = useState("all")
  const bizName = (id) => db.businesses.find(b => b.id === id)?.name
  const inBiz = (e) => bizFilter === "all" || (e.business || "") === bizFilter

  const active = db.employees.filter(e => e.status !== "inactive" && inBiz(e))
  // mixed currencies → sum the USD-base equivalent of each salary
  const total = db.employees.filter(e => e.status === "active" && inBiz(e)).reduce((s, e) => s + toUsd(e.salary, e.currency), 0)
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
      <div className="pill-row" style={{ alignItems: "center" }}>
        {db.businesses.length > 0 && (<>
          <span className={`pill ${bizFilter === "all" ? "on" : ""}`} onClick={() => setBizFilter("all")}>{t("all")} businesses</span>
          {db.businesses.map(b => (
            <span key={b.id} className={`pill ${bizFilter === b.id ? "on" : ""}`} onClick={() => setBizFilter(b.id)}>{b.name}</span>
          ))}
        </>)}
        <span style={{ marginInlineStart: "auto" }}><CurrencyToggle /></span>
      </div>

      <motion.div className="kpis" variants={stagger} initial="initial" animate="animate">
        {kpis.map((k, i) => (
          <motion.div key={i} className={`kpi ${k.cls}`} variants={item} whileHover={{ y: -3 }}>
            <div className="ic"><Icon name={k.icon} size={20} /></div>
            <h3>{k.small ? k.v : <Counter value={k.v} />}</h3>
            <p>{k.p}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="panel">
        <div className="panel-h"><h2>{t("nav.payroll")}<span className="count">{rows.length}</span></h2></div>
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("salary")}</th><th>{t("nextPay")}</th><th>{t("status")}</th><th className="right">{t("actions")}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <motion.tr key={r.e.id} variants={item} initial="initial" animate="animate" layout>
                <td><div className="person"><Avatar emp={r.e} /><div>
                  <b>{r.e.name}</b>
                  <small>{r.e.role}{bizFilter === "all" && bizName(r.e.business) ? " · " + bizName(r.e.business) : ""}</small>
                  {r.e.cardNumber && (
                    <small className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      <Icon name="wallet" size={12} /> {r.e.cardNumber}
                      <button onClick={() => copyCard(r.e.cardNumber)} title="Copy card number"
                        style={{ background: "transparent", border: 0, color: "var(--accent)", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}>
                        <Icon name="copy" size={12} />
                      </button>
                    </small>
                  )}
                </div></div></td>
                <td data-label={t("salary")}>
                  <Money value={toUsd(r.e.salary, r.e.currency)} />
                  {r.e.currency !== "USD" && <small className="muted" style={{ display: "block", fontSize: 11 }}><Money value={r.e.salary} currency={r.e.currency} /></small>}
                </td>
                <td data-label={t("nextPay")}>{fmtDate(r.pd.toISOString())}<br /><small className="muted">{r.paid ? "" : relDay(r.dd)}</small></td>
                <td data-label={t("status")}>
                  {r.paid ? <Tag color="green">✓ {t("paid")}</Tag>
                    : r.dd < 0 ? <Tag color="red">{t("overdue")}</Tag>
                      : r.dd === 0 ? <Tag color="amber">{t("dueToday")}</Tag>
                        : <Tag color="amber">{r.dd} {t("daysLeft")}</Tag>}
                </td>
                <td className="right">
                  {r.paid ? (
                    <button className="btn sm ghost danger pay-action"
                      onClick={async () => { if (await ask({ title: t("deletePayment"), message: t("confirmDelPay"), confirmText: t("deletePayment") })) setPaid(r.e.id, r.per, false) }}>
                      <Icon name="trash" size={14} /> {t("deletePayment")}
                    </button>
                  ) : (
                    <button className="btn sm pay-action" onClick={() => setPaid(r.e.id, r.per, true)}>
                      <Icon name="check" size={14} /> {t("markPaid")}
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <EmptyState icon="wallet" text={db.businesses.length && bizFilter !== "all" ? "No staff in this business yet" : t("noData")} />}
      </div>
    </div>
  )
}
