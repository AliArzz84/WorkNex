
// import { createClient } from "npm:@supabase/supabase-js@2"

// const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!
// const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
// const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// const MODEL = "claude-sonnet-5"

// const COLL: Record<string, string> = {
//   employee: "employees", project: "projects", meeting: "meetings",
//   team: "teams", task: "tasks", transaction: "transactions", business: "businesses",
// }
// const uid = (p: string) => p + "_" + Math.random().toString(36).slice(2, 9)

// const cors = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
// }
// const json = (body: unknown, status = 200) =>
//   new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

// const TOOLS = [
//   {
//     name: "create_record",
//     description: "Create a new record. `type` is one of: employee, project, meeting, team, task, transaction, business. `fields` is an object with that record's fields (e.g. employee: name, role, salary, currency, payDay, status; transaction: business, type ('income'|'expense'), amount, date, category). Amounts are in GBP unless a currency is given.",
//     input_schema: { type: "object", properties: { type: { type: "string", enum: Object.keys(COLL) }, fields: { type: "object" } }, required: ["type", "fields"] },
//   },
//   {
//     name: "update_record",
//     description: "Update an existing record by id. Only include the fields you want to change.",
//     input_schema: { type: "object", properties: { type: { type: "string", enum: Object.keys(COLL) }, id: { type: "string" }, fields: { type: "object" } }, required: ["type", "id", "fields"] },
//   },
//   {
//     name: "delete_record",
//     description: "Delete a record by id.",
//     input_schema: { type: "object", properties: { type: { type: "string", enum: Object.keys(COLL) }, id: { type: "string" } }, required: ["type", "id"] },
//   },
//   { name: "toggle_task_done", description: "Toggle a task's done status.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
//   { name: "toggle_meeting_done", description: "Toggle a meeting's done status.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
// ]

// // deno-lint-ignore no-explicit-any
// function applyTool(data: any, name: string, input: any): string {
//   if (name === "create_record") {
//     const col = COLL[input.type]; if (!col) return "error: unknown type"
//     data[col] = data[col] || []
//     const rec = { ...input.fields, id: uid(input.type[0]) }
//     data[col].push(rec)
//     return `created ${input.type} "${rec.name || rec.title || rec.id}" (id ${rec.id})`
//   }
//   if (name === "update_record") {
//     const col = COLL[input.type]; const list = data[col] || []
//     const i = list.findIndex((x: any) => x.id === input.id); if (i < 0) return "error: not found"
//     list[i] = { ...list[i], ...input.fields }
//     return `updated ${input.type} ${input.id}`
//   }
//   if (name === "delete_record") {
//     const col = COLL[input.type]; const before = (data[col] || []).length
//     data[col] = (data[col] || []).filter((x: any) => x.id !== input.id)
//     return before === (data[col] || []).length ? "error: not found" : `deleted ${input.type} ${input.id}`
//   }
//   if (name === "toggle_task_done") {
//     const t = (data.tasks || []).find((x: any) => x.id === input.id); if (!t) return "error: not found"
//     t.done = !t.done; return `task ${input.id} done=${t.done}`
//   }
//   if (name === "toggle_meeting_done") {
//     const m = (data.meetings || []).find((x: any) => x.id === input.id); if (!m) return "error: not found"
//     m.done = !m.done; return `meeting ${input.id} done=${m.done}`
//   }
//   return "error: unknown tool"
// }

// // trim the bulky parts the assistant doesn't need, to save tokens
// // deno-lint-ignore no-explicit-any
// function context(data: any) {
//   const { activity, seen, diagram, ...rest } = data || {}
//   return rest
// }

// async function callClaude(system: string, messages: unknown[]) {
//   const r = await fetch("https://api.anthropic.com/v1/messages", {
//     method: "POST",
//     headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
//     body: JSON.stringify({
//       model: MODEL,
//       max_tokens: 1500,
//       thinking: { type: "disabled" },
//       output_config: { effort: "low" },
//       system,
//       tools: TOOLS,
//       messages,
//     }),
//   })
//   if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`)
//   return await r.json()
// }

// Deno.serve(async (req) => {
//   if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
//   try {
//     const admin = createClient(SUPABASE_URL, SERVICE_KEY)

//     // only allow-listed signed-in users may use the assistant
//     const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "")
//     const { data: userData } = await admin.auth.getUser(jwt)
//     const email = userData?.user?.email
//     if (!email) return json({ error: "Please sign in." }, 401)
//     const { data: allow } = await admin.from("allowed_emails").select("email").ilike("email", email).maybeSingle()
//     if (!allow) return json({ error: "Not authorised." }, 403)

//     const { messages } = await req.json()
//     if (!Array.isArray(messages) || !messages.length) return json({ error: "No message." }, 400)

//     const { data: ws } = await admin.from("workspaces").select("data").eq("id", "default").single()
//     // deno-lint-ignore no-explicit-any
//     const data: any = ws?.data || {}

//     const system =
//       `You are the built-in assistant inside "Manager Dashboard", a small-business management app. ` +
//       `The base currency is GBP (£). You can create, update, and delete employees, projects, meetings, tasks, transactions, teams, and businesses using the provided tools, and answer questions about the data. ` +
//       `IMPORTANT: You CANNOT pay salaries or mark payroll as paid — there is no tool for it. If the user asks you to pay or mark a salary paid, politely explain they must do it themselves on the Payroll page. ` +
//       `Be concise and confirm what you changed (with names). When the user asks a question, answer directly from the data. ` +
//       `Use ISO dates (YYYY-MM-DD). Match employees/projects to existing records by name when updating or deleting. ` +
//       `Current workspace data (JSON): ${JSON.stringify(context(data))}`

//     let convo = messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
//     let changed = false

//     for (let i = 0; i < 6; i++) {
//       const resp = await callClaude(system, convo)
//       convo = [...convo, { role: "assistant", content: resp.content }]
//       const toolUses = (resp.content || []).filter((b: { type: string }) => b.type === "tool_use")
//       if (resp.stop_reason !== "tool_use" || !toolUses.length) break
//       const results = toolUses.map((tu: { id: string; name: string; input: unknown }) => {
//         changed = true
//         return { type: "tool_result", tool_use_id: tu.id, content: applyTool(data, tu.name, tu.input) }
//       })
//       convo = [...convo, { role: "user", content: results }]
//     }

//     if (changed) {
//       const { error } = await admin.from("workspaces").update({ data, updated_at: new Date().toISOString() }).eq("id", "default")
//       if (error) throw error
//     }

//     // pull the last assistant text
//     let reply = ""
//     for (let i = convo.length - 1; i >= 0; i--) {
//       const m = convo[i] as { role: string; content: unknown }
//       if (m.role !== "assistant") continue
//       if (typeof m.content === "string") { reply = m.content; break }
//       const text = (m.content as { type: string; text?: string }[]).filter(b => b.type === "text").map(b => b.text).join("\n").trim()
//       if (text) { reply = text; break }
//     }

//     return json({ reply: reply || "Done.", changed })
//   } catch (e) {
//     return json({ error: String((e as Error).message || e) }, 500)
//   }
// })
