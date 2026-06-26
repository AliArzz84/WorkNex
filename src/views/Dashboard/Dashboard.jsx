import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Counter, Avatar, ProjStatusTag, ProgressBar, EmptyState, Icon, TodayRow, stagger, item } from '../../components/ui/ui.jsx'
import { daysBetween, nextPayday, periodKey } from '../../lib/data.js'

function ProjectCard({ p }) {
  const { t, teamById, teamMembers, relDay } = useStore()
  const dd = daysBetween(p.deadline)
  return (
    <motion.div className="pcard" variants={item} whileHover={{ y: -3 }}>
      <div className="ph">
        <div style={{ flex: 1 }}><b>{p.name}</b><br /><small>{p.client}</small></div>
        <ProjStatusTag status={p.status} />
      </div>
      <ProgressBar value={p.progress} />
      <div className="meta">
        <span>{t("progress")}: {p.progress}%</span>
        <span style={{ color: dd < 0 ? "var(--red-ink)" : dd <= 5 ? "var(--amber-ink)" : "var(--muted)" }}>{t("deadlineIn")}: {relDay(dd)}</span>
      </div>
      <div className="meta">
        <span className="muted">{teamById(p.team)?.name || t("noTeam")}</span>
        <div className="members">{teamMembers(p.team).map(e => <Avatar key={e.id} emp={e} />)}</div>
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  const { db, t, empById, relDay, fmtTime, setView, isPaid, todayExtras } = useStore()
  const empN = db.employees.filter(e => e.status === "active").length
  const projN = db.projects.filter(p => p.status === "active").length
  const weekMeet = db.meetings.filter(m => !m.done && daysBetween(m.datetime) >= 0 && daysBetween(m.datetime) <= 7).length
  const duePay = db.employees.filter(e => e.status === "active").filter(e => {
    const pd = nextPayday(e); return daysBetween(pd.toISOString()) <= 10 && !isPaid(e.id, periodKey(pd))
  }).length
  const upMeet = db.meetings.filter(m => !m.done && daysBetween(m.datetime) >= 0)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime)).slice(0, 3)
  const actProj = db.projects.filter(p => p.status === "active")
    .sort((a, b) => daysBetween(a.deadline) - daysBetween(b.deadline)).slice(0, 4)

  const kpis = [
    { icon: "employees", n: empN, p: t("kpi.employees"), cls: "k1" },
    { icon: "projects", n: projN, p: t("kpi.projects"), cls: "k2" },
    { icon: "meetings", n: weekMeet, p: t("kpi.meetings"), cls: "k3" },
    { icon: "wallet", n: duePay, p: t("kpi.duePay"), cls: "k4" },
  ]

  return (
    <div>
      <motion.div className="kpis" variants={stagger} initial="initial" animate="animate">
        {kpis.map((k, i) => (
          <motion.div key={i} className={`kpi ${k.cls}`} variants={item} whileHover={{ y: -3 }}>
            <div className="ic"><Icon name={k.icon} size={20} /></div>
            <h3><Counter value={k.n} /></h3>
            <p>{k.p}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="panel today-panel">
        <div className="panel-h"><span className="hicon"><Icon name="clock" size={16} /></span><h2>Today</h2><span className="count">{todayExtras.length}</span></div>
        {todayExtras.length ? (
          <motion.div variants={stagger} initial="initial" animate="animate">
            <AnimatePresence>{todayExtras.map(it => <TodayRow key={it.key} it={it} />)}</AnimatePresence>
          </motion.div>
        ) : <EmptyState icon="check" text="Nothing scheduled for today ✅" />}
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="meetings" size={16} /></span><h2>{t("todayMeetings")}</h2>
          <div className="right"><button className="btn ghost sm" onClick={() => setView("meetings")}><Icon name="arrow" size={15} /></button></div>
        </div>
        {upMeet.length ? (
          <motion.div variants={stagger} initial="initial" animate="animate">
            {upMeet.map(m => (
              <motion.div key={m.id} className="alert blue" variants={item}>
                <div className="dot" />
                <div>
                  <b>{m.title}</b>
                  <p>{(m.attendees || []).map(id => empById(id)?.name).filter(Boolean).join(", ")}</p>
                </div>
                <div className="when">{relDay(daysBetween(m.datetime))} • {fmtTime(m.datetime)}</div>
              </motion.div>
            ))}
          </motion.div>
        ) : <EmptyState icon="meetings" text={t("noData")} />}
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="hicon"><Icon name="projects" size={16} /></span><h2>{t("activeProjects")}</h2>
          <div className="right"><button className="btn ghost sm" onClick={() => setView("projects")}><Icon name="arrow" size={15} /></button></div>
        </div>
        {actProj.length ? (
          <motion.div className="grid2" variants={stagger} initial="initial" animate="animate">
            {actProj.map(p => <ProjectCard key={p.id} p={p} />)}
          </motion.div>
        ) : <EmptyState icon="projects" text={t("noData")} />}
      </div>
    </div>
  )
}
