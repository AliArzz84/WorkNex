
import { createClient } from "npm:@supabase/supabase-js@2"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const MODEL = "claude-sonnet-4-6"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

/* one batched tool: Claude reports every email that is actually a meeting */
const TOOL = {
  name: "report_meetings",
  description: "Report which of the given emails imply a meeting/call/appointment to put on the calendar, with details.",
  input_schema: {
    type: "object",
    properties: {
      meetings: {
        type: "array",
        description: "one entry per email that IS a meeting (skip emails that are not). Omit the rest.",
        items: {
          type: "object",
          properties: {
            source_index: { type: "number", description: "the # of the email this came from" },
            title: { type: "string", description: "short meeting title" },
            attendees: { type: "array", items: { type: "string" }, description: "people involved besides the owner" },
            has_explicit_time: { type: "boolean", description: "true only if the email states a specific date AND time" },
            datetime: { type: "string", description: "'YYYY-MM-DDTHH:mm' when has_explicit_time; empty otherwise" },
            proposed_slots: { type: "array", items: { type: "string" }, description: "2-3 'YYYY-MM-DDTHH:mm' slots within working hours when no explicit time" },
            location: { type: "string", description: "place or video link; empty if none" },
            agenda: { type: "string", description: "one short line: the purpose; same language as the email" },
            summary: { type: "string", description: "one short sentence about what was found, in the email's language" },
          },
          required: ["source_index", "title", "attendees", "has_explicit_time", "datetime", "proposed_slots", "summary"],
        },
      },
    },
    required: ["meetings"],
  },
}

// ---- Gmail body decoding ----
function b64urlDecode(data: string): string {
  try {
    const s = data.replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(s + "=".repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0))
    return new TextDecoder("utf-8").decode(bytes)
  } catch (_e) { return "" }
}
// deno-lint-ignore no-explicit-any
function extractText(payload: any): string {
  if (!payload) return ""
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64urlDecode(payload.body.data)
  if (payload.parts) {
    // prefer text/plain anywhere in the tree, else fall back to stripped html
    for (const p of payload.parts) { const t = extractText(p); if (t) return t }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return b64urlDecode(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
  }
  return ""
}
// deno-lint-ignore no-explicit-any
const header = (msg: any, name: string): string =>
  (msg?.payload?.headers || []).find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || ""

async function googleAccessToken(refreshToken: string): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  })
  const d = await r.json()
  if (!r.ok || !d.access_token) throw new Error("google_auth_failed")
  return d.access_token as string
}

async function callClaude(system: string, content: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2000,
      thinking: { type: "disabled" }, output_config: { effort: "low" },
      system, tools: [TOOL], tool_choice: { type: "tool", name: "report_meetings" },
      messages: [{ role: "user", content }],
    }),
  })
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`)
  return await r.json()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // only allow-listed signed-in users
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "")
    const { data: userData } = await admin.auth.getUser(jwt)
    const user = userData?.user
    if (!user?.email) return json({ error: "Please sign in." }, 401)
    const { data: allow } = await admin.from("allowed_emails").select("email").ilike("email", user.email).maybeSingle()
    if (!allow) return json({ error: "Not authorised." }, 403)

    // look up this user's stored Google refresh token
    const { data: conn } = await admin.from("email_connections").select("refresh_token").eq("user_id", user.id).maybeSingle()
    if (!conn?.refresh_token) return json({ error: "not_connected" }, 200)

    const { now, tz } = await req.json().catch(() => ({}))
    const nowLocal = (typeof now === "string" && now) ? now : new Date().toISOString().slice(0, 16)
    const zone = (typeof tz === "string" && tz) ? tz : "Europe/London"

    // 1) fresh Google access token
    const accessToken = await googleAccessToken(conn.refresh_token)
    const gHeaders = { Authorization: "Bearer " + accessToken }

    // 2) recent inbox messages
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=" +
      encodeURIComponent("in:inbox newer_than:7d -category:promotions -category:social"),
      { headers: gHeaders })
    if (!listRes.ok) {
      if (listRes.status === 401 || listRes.status === 403) return json({ error: "reconnect_needed" }, 200)
      throw new Error("gmail_list_failed")
    }
    const list = await listRes.json()
    const ids: string[] = (list.messages || []).map((m: { id: string }) => m.id)
    if (!ids.length) return json({ meetings: [], scanned: 0 })

    // 3) fetch each message
    const msgs = await Promise.all(ids.map(async (id) => {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: gHeaders })
      if (!r.ok) return null
      const m = await r.json()
      return {
        id,
        from: header(m, "From"),
        subject: header(m, "Subject"),
        date: header(m, "Date"),
        body: (extractText(m.payload) || m.snippet || "").slice(0, 1800),
      }
    }))
    const emails = msgs.filter(Boolean) as { id: string; from: string; subject: string; date: string; body: string }[]
    if (!emails.length) return json({ meetings: [], scanned: 0 })

    // 4) one batched Claude call
    const system =
      `You scan a batch of work emails and report ONLY the ones that imply a meeting, call, or appointment to put on the calendar. ` +
      `The current local date-time is ${nowLocal} (timezone ${zone}). Working hours are Monday–Friday 09:00–18:00 local; never propose weekends or times outside working hours. ` +
      `Answer by calling report_meetings with one entry per email that is a meeting (skip newsletters, receipts, notifications, marketing, threads with no scheduling intent). ` +
      `For each: if the email gives a specific date AND time, set has_explicit_time=true and "datetime" ('YYYY-MM-DDTHH:mm'). ` +
      `If it wants to meet but gives no specific time, set has_explicit_time=false and fill proposed_slots with 2-3 'YYYY-MM-DDTHH:mm' slots on the soonest working days. ` +
      `Resolve relative dates against the current date. Keep title/agenda in the email's language. Always include the correct source_index.`
    const content = emails.map((e, i) =>
      `Email #${i}\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\n\n${e.body}`).join("\n\n----------\n\n")

    const resp = await callClaude(system, content)
    const block = (resp.content || []).find((b: { type: string }) => b.type === "tool_use")
    const found = (block?.input?.meetings || [])

    // 5) attach source metadata so the app can de-dupe and show provenance
    // deno-lint-ignore no-explicit-any
    const meetings = found.map((m: any) => {
      const src = emails[m.source_index] || {}
      return { ...m, sourceId: src.id || "", from: src.from || "", subject: src.subject || "" }
    }).filter((m: { sourceId: string }) => m.sourceId)

    return json({ meetings, scanned: emails.length })
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
