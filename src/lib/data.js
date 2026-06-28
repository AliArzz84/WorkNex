/* ---------- i18n ---------- */
export const I18N = {
  fa: {
    appName: "داشبورد مدیریت", appSub: "دستیار مدیر",
    nav: { dashboard: "داشبورد", businesses: "کسب‌وکارها", tasks: "کارها", requests: "درخواست‌ها", finance: "مالی", diagram: "دیاگرام", employees: "کارمندان", projects: "پروژه‌ها", meetings: "جلسات", payroll: "حقوق و دستمزد", teams: "تیم‌ها", activity: "فعالیت‌ها" },
    exportData: "خروجی گرفتن", importData: "ورود اطلاعات", loadSample: "داده نمونه",
    add: "افزودن", save: "ذخیره", cancel: "انصراف", confirmDel: "حذف شود؟",
    print: "پرینت / PDF", roleManager: "مدیر", roleBoss: "نمای رئیس",
    titles: { dashboard: "داشبورد", businesses: "کسب‌وکارها", tasks: "کارها", requests: "درخواست‌ها", finance: "مالی", diagram: "دیاگرام جریان داده", employees: "کارمندان", projects: "پروژه‌ها", meetings: "جلسات", payroll: "حقوق و دستمزد", teams: "تیم‌ها", activity: "فعالیت و دسترسی" },
    subs: { dashboard: "نمای کلی کسب‌وکار شما", businesses: "همه‌ی کسب‌وکارهات رو یکجا مدیریت کن", tasks: "کارهایی که باید انجام بدی", requests: "درخواست‌های تیم از طریقِ فرمِ اشتراکی", finance: "درآمد و هزینه‌ی هر کسب‌وکار", diagram: "دیاگرام DFD رو بکش", employees: "مدیریت تیم و اطلاعات کارکنان", projects: "پروژه‌های جاری و وضعیتشان", meetings: "جلسات پیش‌رو", payroll: "پرداخت حقوق و یادآوری‌ها", teams: "دسته‌بندی تیم‌ها", activity: "چه کسی آنلاین است و چه چیزی تغییر کرده" },
    kpi: { employees: "کارمند", projects: "پروژه فعال", meetings: "جلسه این هفته", duePay: "حقوق در راه" },
    reminders: "یادآوری‌ها و هشدارها", todayMeetings: "جلسات امروز و پیش‌رو", activeProjects: "پروژه‌های فعال",
    noReminders: "الان چیز فوری‌ای نیست ✅", noData: "هنوز چیزی ثبت نشده",
    name: "نام", role: "سمت", team: "تیم", country: "محل استقرار", email: "ایمیل", phone: "تلفن", salary: "حقوق ماهانه",
    noTeam: "بدون تیم", selectMembers: "اعضای این تیم را انتخاب کن", teamMembersLabel: "اعضا",
    payDay: "روز پرداخت (هر ماه)", hireDate: "تاریخ استخدام", status: "وضعیت", actions: "عملیات",
    statusActive: "فعال", statusLeave: "مرخصی", statusInactive: "غیرفعال",
    newEmployee: "کارمند جدید", editEmployee: "ویرایش کارمند",
    projName: "نام پروژه", client: "کارفرما", progress: "پیشرفت", startDate: "شروع", deadline: "مهلت",
    budget: "بودجه", members: "اعضا", notes: "یادداشت",
    psPlanning: "برنامه‌ریزی", psActive: "در حال انجام", psPaused: "متوقف", psDone: "تمام‌شده",
    newProject: "پروژه جدید", editProject: "ویرایش پروژه", deadlineIn: "مهلت تا",
    meetTitle: "عنوان جلسه", dateTime: "تاریخ و ساعت", attendees: "شرکت‌کنندگان",
    location: "محل/لینک", relProject: "پروژه مرتبط", done: "برگزار شد",
    newMeeting: "جلسه جدید", editMeeting: "ویرایش جلسه", today: "امروز", tomorrow: "فردا",
    nextPay: "پرداخت بعدی", paid: "پرداخت‌شده", unpaid: "پرداخت‌نشده", markPaid: "ثبت پرداخت",
    markUnpaid: "لغو پرداخت", deletePayment: "حذف پرداخت", confirmDelPay: "این رکورد پرداخت حذف شود؟ دوباره به حالت پرداخت‌نشده برمی‌گردد.", totalPayroll: "جمع حقوق ماهانه", daysLeft: "روز مانده",
    overdue: "عقب‌افتاده", dueToday: "امروز", currency: "تومان",
    payReminder: n => `حقوق ${n} نزدیک است`, payOverdue: n => `حقوق ${n} عقب افتاده`,
    meetReminder: t => `جلسه: ${t}`, deadlineReminder: p => `مهلت پروژه «${p}»`,
    teamName: "نام تیم", teamLead: "سرپرست", basedIn: "مستقر در", newTeam: "تیم جدید", editTeam: "ویرایش تیم",
    membersCount: "نفر", projectsCount: "پروژه", none: "—",
    search2: "جستجو در همه‌جا…", all: "همه",
    daysAgo: n => `${n} روز پیش`, inDays: n => `${n} روز دیگر`,
    replaceSample: "داده‌های فعلی با نمونه جایگزین شوند؟", invalidFile: "فایل نامعتبر است",
    clearAll: "پاک‌کردن همه", confirmClear: "همه‌ی داده‌ها برای همیشه پاک شوند؟ این کار قابل بازگشت نیست.",
  },
  en: {
    appName: "Manager Dashboard", appSub: "Your manager assistant",
    nav: { dashboard: "Dashboard", businesses: "Businesses", tasks: "Tasks", requests: "Requests", finance: "Finance", diagram: "Diagram", employees: "Employees", projects: "Projects", meetings: "Meetings", payroll: "Payroll", teams: "Teams", activity: "Activity" },
    exportData: "Export", importData: "Import", loadSample: "Sample data",
    add: "Add", save: "Save", cancel: "Cancel", confirmDel: "Delete this?",
    print: "Print / PDF", roleManager: "Manager", roleBoss: "Boss view",
    titles: { dashboard: "Dashboard", businesses: "Businesses", tasks: "Tasks", requests: "Requests", finance: "Finance", diagram: "Data Flow Diagram", employees: "Employees", projects: "Projects", meetings: "Meetings", payroll: "Payroll", teams: "Teams", activity: "Activity & Access" },
    subs: { dashboard: "Overview of your business", businesses: "Manage all your businesses in one place", tasks: "Things to do", requests: "Requests from your team via the shared form", finance: "Income & outgoing per business", diagram: "Draw your DFD", employees: "Manage your team & staff info", projects: "Ongoing projects & status", meetings: "Upcoming meetings", payroll: "Salary payments & reminders", teams: "Team grouping", activity: "Who's online and what changed" },
    kpi: { employees: "Employees", projects: "Active projects", meetings: "Meetings this week", duePay: "Salaries due" },
    reminders: "Reminders & alerts", todayMeetings: "Today & upcoming meetings", activeProjects: "Active projects",
    noReminders: "Nothing urgent right now ✅", noData: "Nothing here yet",
    name: "Name", role: "Role", team: "Team", country: "Based in", email: "Email", phone: "Phone", salary: "Monthly salary",
    noTeam: "No team", selectMembers: "Pick members for this team", teamMembersLabel: "Members",
    payDay: "Pay day (each month)", hireDate: "Hire date", status: "Status", actions: "Actions",
    statusActive: "Active", statusLeave: "On leave", statusInactive: "Inactive",
    newEmployee: "New employee", editEmployee: "Edit employee",
    projName: "Project name", client: "Client", progress: "Progress", startDate: "Start", deadline: "Deadline",
    budget: "Budget", members: "Members", notes: "Notes",
    psPlanning: "Planning", psActive: "In progress", psPaused: "Paused", psDone: "Completed",
    newProject: "New project", editProject: "Edit project", deadlineIn: "Due in",
    meetTitle: "Meeting title", dateTime: "Date & time", attendees: "Attendees",
    location: "Location/link", relProject: "Related project", done: "Done",
    newMeeting: "New meeting", editMeeting: "Edit meeting", today: "Today", tomorrow: "Tomorrow",
    nextPay: "Next payment", paid: "Paid", unpaid: "Unpaid", markPaid: "Mark paid",
    markUnpaid: "Mark unpaid", deletePayment: "Delete payment", confirmDelPay: "Delete this payment record? It will show as unpaid again.",
    totalPayroll: "Total monthly payroll", daysLeft: "days left",
    overdue: "Overdue", dueToday: "Today", currency: "Toman",
    payReminder: n => `${n}'s salary is due soon`, payOverdue: n => `${n}'s salary is overdue`,
    meetReminder: t => `Meeting: ${t}`, deadlineReminder: p => `Deadline for "${p}"`,
    teamName: "Team name", teamLead: "Lead", basedIn: "Based in", newTeam: "New team", editTeam: "Edit team",
    membersCount: "people", projectsCount: "projects", none: "—",
    search2: "Search everywhere…", all: "All",
    daysAgo: n => `${n} days ago`, inDays: n => `in ${n} days`,
    replaceSample: "Replace current data with sample?", invalidFile: "Invalid file",
    clearAll: "Clear all", confirmClear: "Delete ALL data permanently? This cannot be undone.",
  }
}

/* salary currencies an employee can be paid in */
export const CURRENCIES = [
  { code: "GBP", symbol: "£", label: "£  GBP" },
  { code: "USD", symbol: "$", label: "$  USD" },
  { code: "EUR", symbol: "€", label: "€  EUR" },
  { code: "IRR", symbol: "تومان", label: "Toman" },
  { code: "AED", symbol: "د.إ", label: "AED" },
  { code: "TRY", symbol: "₺", label: "₺  TRY" },
]

/* request-form categories (shared by the public form + the manager inbox) */
export const REQUEST_CATEGORIES = [
  { key: "meeting", label: "Meeting", color: "blue" },
  { key: "task", label: "Task", color: "amber" },
  { key: "question", label: "Question", color: "green" },
  { key: "access", label: "Access", color: "red" },
  { key: "other", label: "Other", color: "gray" },
]
export const REQUEST_CAT = Object.fromEntries(REQUEST_CATEGORIES.map(c => [c.key, c]))

/* ---------- pure helpers ---------- */
export const uid = (p) => p + "_" + Math.random().toString(36).slice(2, 9)
const COLORS = ["#6c8cff", "#9b6cff", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#f472b6", "#22d3ee"]
export function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % COLORS.length; return COLORS[h] }
export function initials(n) { return String(n || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("") }
export function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export function daysBetween(iso) {
  if (!iso) return 0
  // treat a plain YYYY-MM-DD as a LOCAL calendar date (not UTC) so "today" lines up
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - startOfToday()) / 86400000)
}
export function nextPayday(emp) {
  const now = new Date(); const today = startOfToday()
  let d = new Date(now.getFullYear(), now.getMonth(), emp.payDay || 1)
  if (d < today) d = new Date(now.getFullYear(), now.getMonth() + 1, emp.payDay || 1)
  return d
}
export function periodKey(date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") }
// short relative time for the activity log ("just now", "5m ago", "3h ago", "2d ago", then a date)
export function timeAgo(ts) {
  if (!ts) return "—"
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 45) return "just now"
  const m = Math.floor(s / 60); if (m < 60) return m + "m ago"
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago"
  const d = Math.floor(h / 24); if (d < 7) return d + "d ago"
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}
export function isPaid(db, empId, period) { return !!(db.payments[empId] && db.payments[empId][period]) }


export function dfdStyle(kind) {
  const base = { padding: 10, fontSize: 12, fontWeight: 600, color: "#1d1d1f", width: 150, textAlign: "center" }
  if (kind === "process") return { ...base, background: "#e8f1ff", border: "2px solid #0071e3", borderRadius: 40 }
  if (kind === "store") return { ...base, background: "#eafaf0", border: "2px solid #34c759", borderRadius: 8 }
  return { ...base, background: "#fff4e6", border: "2px solid #ff9f0a", borderRadius: 8 } // entity
}
