/* ---------- i18n ---------- */
export const I18N = {
  fa: {
    appName: "داشبورد مدیریت", appSub: "دستیار مدیر",
    nav: { dashboard: "داشبورد", tasks: "کارها", finance: "مالی", diagram: "دیاگرام", employees: "کارمندان", projects: "پروژه‌ها", meetings: "جلسات", payroll: "حقوق و دستمزد", teams: "تیم‌ها" },
    exportData: "خروجی گرفتن", importData: "ورود اطلاعات", loadSample: "داده نمونه",
    add: "افزودن", save: "ذخیره", cancel: "انصراف", confirmDel: "حذف شود؟",
    print: "پرینت / PDF", roleManager: "مدیر", roleBoss: "نمای رئیس",
    titles: { dashboard: "داشبورد", tasks: "کارها", finance: "مالی", diagram: "دیاگرام جریان داده", employees: "کارمندان", projects: "پروژه‌ها", meetings: "جلسات", payroll: "حقوق و دستمزد", teams: "تیم‌ها" },
    subs: { dashboard: "نمای کلی کسب‌وکار شما", tasks: "کارهایی که باید انجام بدی", finance: "درآمد و هزینه‌ی هر کسب‌وکار", diagram: "دیاگرام DFD رو بکش", employees: "مدیریت تیم و اطلاعات کارکنان", projects: "پروژه‌های جاری و وضعیتشان", meetings: "جلسات پیش‌رو", payroll: "پرداخت حقوق و یادآوری‌ها", teams: "دسته‌بندی تیم‌ها" },
    kpi: { employees: "کارمند", projects: "پروژه فعال", meetings: "جلسه این هفته", duePay: "حقوق در راه" },
    reminders: "یادآوری‌ها و هشدارها", todayMeetings: "جلسات امروز و پیش‌رو", activeProjects: "پروژه‌های فعال",
    noReminders: "الان چیز فوری‌ای نیست ✅", noData: "هنوز چیزی ثبت نشده",
    name: "نام", role: "سمت", team: "تیم", email: "ایمیل", phone: "تلفن", salary: "حقوق ماهانه",
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
    markUnpaid: "لغو پرداخت", totalPayroll: "جمع حقوق ماهانه", daysLeft: "روز مانده",
    overdue: "عقب‌افتاده", dueToday: "امروز", currency: "تومان",
    payReminder: n => `حقوق ${n} نزدیک است`, payOverdue: n => `حقوق ${n} عقب افتاده`,
    meetReminder: t => `جلسه: ${t}`, deadlineReminder: p => `مهلت پروژه «${p}»`,
    teamName: "نام تیم", teamLead: "سرپرست", newTeam: "تیم جدید", editTeam: "ویرایش تیم",
    membersCount: "نفر", projectsCount: "پروژه", none: "—",
    search2: "جستجو در همه‌جا…", all: "همه",
    daysAgo: n => `${n} روز پیش`, inDays: n => `${n} روز دیگر`,
    replaceSample: "داده‌های فعلی با نمونه جایگزین شوند؟", invalidFile: "فایل نامعتبر است",
    clearAll: "پاک‌کردن همه", confirmClear: "همه‌ی داده‌ها برای همیشه پاک شوند؟ این کار قابل بازگشت نیست.",
  },
  en: {
    appName: "Manager Dashboard", appSub: "Your manager assistant",
    nav: { dashboard: "Dashboard", tasks: "Tasks", finance: "Finance", diagram: "Diagram", employees: "Employees", projects: "Projects", meetings: "Meetings", payroll: "Payroll", teams: "Teams" },
    exportData: "Export", importData: "Import", loadSample: "Sample data",
    add: "Add", save: "Save", cancel: "Cancel", confirmDel: "Delete this?",
    print: "Print / PDF", roleManager: "Manager", roleBoss: "Boss view",
    titles: { dashboard: "Dashboard", tasks: "Tasks", finance: "Finance", diagram: "Data Flow Diagram", employees: "Employees", projects: "Projects", meetings: "Meetings", payroll: "Payroll", teams: "Teams" },
    subs: { dashboard: "Overview of your business", tasks: "Things to do", finance: "Income & outgoing per business", diagram: "Draw your DFD", employees: "Manage your team & staff info", projects: "Ongoing projects & status", meetings: "Upcoming meetings", payroll: "Salary payments & reminders", teams: "Team grouping" },
    kpi: { employees: "Employees", projects: "Active projects", meetings: "Meetings this week", duePay: "Salaries due" },
    reminders: "Reminders & alerts", todayMeetings: "Today & upcoming meetings", activeProjects: "Active projects",
    noReminders: "Nothing urgent right now ✅", noData: "Nothing here yet",
    name: "Name", role: "Role", team: "Team", email: "Email", phone: "Phone", salary: "Monthly salary",
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
    teamName: "Team name", teamLead: "Lead", newTeam: "New team", editTeam: "Edit team",
    membersCount: "people", projectsCount: "projects", none: "—",
    search2: "Search everywhere…", all: "All",
    daysAgo: n => `${n} days ago`, inDays: n => `in ${n} days`,
    replaceSample: "Replace current data with sample?", invalidFile: "Invalid file",
    clearAll: "Clear all", confirmClear: "Delete ALL data permanently? This cannot be undone.",
  }
}

/* ---------- pure helpers ---------- */
export const uid = (p) => p + "_" + Math.random().toString(36).slice(2, 9)
const COLORS = ["#6c8cff", "#9b6cff", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#f472b6", "#22d3ee"]
export function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % COLORS.length; return COLORS[h] }
export function initials(n) { return String(n || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("") }
export function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export function daysBetween(iso) { if (!iso) return 0; const d = new Date(iso); d.setHours(0, 0, 0, 0); return Math.round((d - startOfToday()) / 86400000) }
export function nextPayday(emp) {
  const now = new Date(); const today = startOfToday()
  let d = new Date(now.getFullYear(), now.getMonth(), emp.payDay || 1)
  if (d < today) d = new Date(now.getFullYear(), now.getMonth() + 1, emp.payDay || 1)
  return d
}
export function periodKey(date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") }
export function isPaid(db, empId, period) { return !!(db.payments[empId] && db.payments[empId][period]) }

/* ---------- sample data ---------- */
export function sampleData(lang = "fa") {
  const fa = lang === "fa"
  const today = new Date()
  const d = (off) => { const x = new Date(today); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10) }
  const dt = (off, h) => { const x = new Date(today); x.setDate(x.getDate() + off); x.setHours(h, 0, 0, 0); return x.toISOString().slice(0, 16) }
  const teams = [
    { id: "t_dev", name: fa ? "توسعه نرم‌افزار" : "Engineering", lead: "e1" },
    { id: "t_design", name: fa ? "طراحی" : "Design", lead: "e3" },
    { id: "t_sales", name: fa ? "فروش و بازاریابی" : "Sales & Marketing", lead: "e4" },
    { id: "t_ops", name: fa ? "عملیات" : "Operations", lead: "e7" },
  ]
  const employees = [
    { id: "e1", name: fa ? "سارا محمدی" : "Sara Mohammadi", role: fa ? "مدیر فنی" : "Tech Lead", team: "t_dev", email: "sara@company.com", phone: "0912-000-0001", salary: 3500, payDay: 1, hireDate: "2022-03-01", status: "active" },
    { id: "e2", name: fa ? "علی رضایی" : "Ali Rezaei", role: fa ? "برنامه‌نویس ارشد" : "Senior Developer", team: "t_dev", email: "ali@company.com", phone: "0912-000-0002", salary: 3000, payDay: 1, hireDate: "2022-09-15", status: "active" },
    { id: "e3", name: fa ? "نگار کریمی" : "Negar Karimi", role: fa ? "طراح محصول" : "Product Designer", team: "t_design", email: "negar@company.com", phone: "0912-000-0003", salary: 2600, payDay: 5, hireDate: "2023-01-10", status: "active" },
    { id: "e4", name: fa ? "رضا قاسمی" : "Reza Ghasemi", role: fa ? "مدیر فروش" : "Sales Manager", team: "t_sales", email: "reza@company.com", phone: "0912-000-0004", salary: 2900, payDay: 1, hireDate: "2021-06-20", status: "active" },
    { id: "e5", name: fa ? "مریم احمدی" : "Maryam Ahmadi", role: fa ? "کارشناس بازاریابی" : "Marketing Specialist", team: "t_sales", email: "maryam@company.com", phone: "0912-000-0005", salary: 2200, payDay: 5, hireDate: "2023-08-01", status: "leave" },
    { id: "e6", name: fa ? "حسین موسوی" : "Hossein Mousavi", role: "DevOps", team: "t_dev", email: "hossein@company.com", phone: "0912-000-0006", salary: 3200, payDay: 1, hireDate: "2022-11-05", status: "active" },
    { id: "e7", name: fa ? "فاطمه نوری" : "Fatemeh Nouri", role: fa ? "مدیر عملیات" : "Operations Manager", team: "t_ops", email: "fatemeh@company.com", phone: "0912-000-0007", salary: 2800, payDay: 10, hireDate: "2021-02-14", status: "active" },
  ]
  const projects = [
    { id: "p1", name: fa ? "اپلیکیشن موبایل فروشگاه" : "Shop Mobile App", client: fa ? "دیجی‌کالا" : "Acme Retail", status: "active", progress: 65, startDate: d(-40), deadline: d(8), budget: 45000, members: ["e1", "e2", "e3"], notes: fa ? "نسخه‌ی iOS در مرحله‌ی تست" : "iOS build in testing" },
    { id: "p2", name: fa ? "بازطراحی سایت شرکتی" : "Corporate Website Redesign", client: fa ? "بانک ملت" : "Globex", status: "active", progress: 40, startDate: d(-20), deadline: d(25), budget: 18000, members: ["e3", "e2"], notes: "" },
    { id: "p3", name: fa ? "کمپین تبلیغاتی بهار" : "Spring Marketing Campaign", client: fa ? "داخلی" : "Internal", status: "active", progress: 80, startDate: d(-15), deadline: d(3), budget: 9000, members: ["e4", "e5"], notes: fa ? "محتوای شبکه‌های اجتماعی آماده‌ست" : "Social content ready" },
    { id: "p4", name: fa ? "مهاجرت زیرساخت به ابر" : "Cloud Infra Migration", client: fa ? "داخلی" : "Internal", status: "planning", progress: 10, startDate: d(2), deadline: d(60), budget: 12000, members: ["e6", "e1"], notes: "" },
    { id: "p5", name: fa ? "داشبورد گزارش‌گیری" : "Analytics Dashboard", client: fa ? "اسنپ" : "Initech", status: "done", progress: 100, startDate: d(-90), deadline: d(-5), budget: 7500, members: ["e2", "e6"], notes: fa ? "تحویل داده شد" : "Delivered" },
  ]
  const meetings = [
    { id: "m1", title: fa ? "جلسه‌ی هفتگی تیم فنی" : "Weekly engineering sync", datetime: dt(0, 10), attendees: ["e1", "e2", "e6"], location: fa ? "اتاق جلسات A" : "Room A", projectId: "p1", notes: "", done: false },
    { id: "m2", title: fa ? "بازبینی طرح با کارفرما" : "Design review with client", datetime: dt(1, 14), attendees: ["e3", "e4"], location: "Google Meet", projectId: "p2", notes: "", done: false },
    { id: "m3", title: fa ? "جلسه‌ی فروش ماهانه" : "Monthly sales meeting", datetime: dt(3, 11), attendees: ["e4", "e5", "e7"], location: fa ? "اتاق جلسات B" : "Room B", projectId: "", notes: "", done: false },
    { id: "m4", title: fa ? "برنامه‌ریزی مهاجرت ابری" : "Cloud migration planning", datetime: dt(5, 9), attendees: ["e6", "e1"], location: "Zoom", projectId: "p4", notes: "", done: false },
  ]
  const businesses = [
    { id: "b1", name: fa ? "استودیو آکمی" : "Acme Studio" },
    { id: "b2", name: fa ? "مشاوره گلوبکس" : "Globex Consulting" },
  ]
  const transactions = [
    { id: "tx1", business: "b1", type: "income", amount: 25000, date: d(-25), category: "Project payment", note: "Shop App milestone 1" },
    { id: "tx2", business: "b1", type: "expense", amount: 12000, date: d(-22), category: "Salaries", note: "" },
    { id: "tx3", business: "b1", type: "expense", amount: 1800, date: d(-18), category: "Software", note: "Cloud + tools" },
    { id: "tx4", business: "b2", type: "income", amount: 9000, date: d(-12), category: "Consulting", note: "Website retainer" },
    { id: "tx5", business: "b2", type: "expense", amount: 3000, date: d(-10), category: "Ads", note: "Spring campaign" },
    { id: "tx6", business: "b1", type: "income", amount: 14000, date: d(-4), category: "Project payment", note: "Shop App milestone 2" },
    { id: "tx7", business: "b1", type: "expense", amount: 900, date: d(-2), category: "Office", note: "Rent" },
  ]
  const tasks = [
    { id: "k1", title: fa ? "تأیید بودجه‌ی فصل" : "Approve Q3 budget", done: false, priority: "high", due: d(1), assignee: "e1", projectId: "", notes: "" },
    { id: "k2", title: fa ? "بررسی طرح‌های اپ فروشگاه" : "Review Shop App designs", done: false, priority: "med", due: d(3), assignee: "e3", projectId: "p1", notes: "" },
    { id: "k3", title: fa ? "امضای قرارداد گلوبکس" : "Sign Globex contract", done: false, priority: "high", due: d(2), assignee: "e4", projectId: "p2", notes: "" },
    { id: "k4", title: fa ? "جلسه‌ی یک‌به‌یک با سارا" : "1:1 with Sara", done: true, priority: "low", due: d(-1), assignee: "e1", projectId: "", notes: "" },
    { id: "k5", title: fa ? "پرداخت اجاره‌ی دفتر" : "Pay office rent", done: false, priority: "med", due: d(5), assignee: "e7", projectId: "", notes: "" },
  ]
  const diagram = {
    nodes: [
      { id: "n1", position: { x: 40, y: 120 }, data: { label: "Customer" }, style: dfdStyle("entity") },
      { id: "n2", position: { x: 300, y: 60 }, data: { label: "Order System" }, style: dfdStyle("process") },
      { id: "n3", position: { x: 300, y: 220 }, data: { label: "Orders DB" }, style: dfdStyle("store") },
      { id: "n4", position: { x: 580, y: 120 }, data: { label: "Manager" }, style: dfdStyle("entity") },
    ],
    edges: [
      { id: "e1-2", source: "n1", target: "n2", label: "places order", animated: true },
      { id: "e2-3", source: "n2", target: "n3", label: "save" },
      { id: "e2-4", source: "n2", target: "n4", label: "report", animated: true },
    ],
  }
  return { teams, employees, projects, meetings, businesses, transactions, tasks, diagram, payments: {}, currency: "£" }
}

export function dfdStyle(kind) {
  const base = { padding: 10, fontSize: 12, fontWeight: 600, color: "#1d1d1f", width: 150, textAlign: "center" }
  if (kind === "process") return { ...base, background: "#e8f1ff", border: "2px solid #0071e3", borderRadius: 40 }
  if (kind === "store") return { ...base, background: "#eafaf0", border: "2px solid #34c759", borderRadius: 8 }
  return { ...base, background: "#fff4e6", border: "2px solid #ff9f0a", borderRadius: 8 } // entity
}
