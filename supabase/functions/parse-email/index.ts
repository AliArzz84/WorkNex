
import { createClient } from "npm:@supabase/supabase-js@2"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!
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

// the single tool Claude is forced to call — its input IS the structured proposal we return
const TOOL = {
  name: "propose_meeting",
  description: "Report whether a work email implies a meeting/call/appointment to put on the calendar, and the extracted details.",
  input_schema: {
    type: "object",
    properties: {
      is_meeting: { type: "boolean", description: "true if the email proposes, requests, or confirms a meeting/call/appointment to schedule" },
      title: { type: "string", description: "short meeting title, e.g. 'Call with Acme about pricing'. Empty when is_meeting is false." },
      attendees: { type: "array", items: { type: "string" }, description: "names or emails of the people involved besides the app owner" },
      has_explicit_time: { type: "boolean", description: "true ONLY if the email states a specific date AND time" },
      datetime: { type: "string", description: "meeting start as local 'YYYY-MM-DDTHH:mm' when has_explicit_time is true; empty string otherwise" },
      proposed_slots: { type: "array", items: { type: "string" }, description: "when there is no explicit time: 2-3 suggested start times as local 'YYYY-MM-DDTHH:mm' on the soonest working days, within working hours" },
      duration_minutes: { type: "number", description: "best guess of meeting length in minutes; 0 if unknown" },
      location: { type: "string", description: "place or video link if any; empty string otherwise" },
      agenda: { type: "string", description: "one short line: the purpose / what to discuss; same language as the email" },
      summary: { type: "string", description: "one short sentence describing what you found, in the same language as the email" },
    },
    required: ["is_meeting", "title", "attendees", "has_explicit_time", "datetime", "proposed_slots", "summary"],
  },
}

async function callClaude(system: string, messages: unknown[]) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "propose_meeting" },
      messages,
    }),
  })
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`)
  return await r.json()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // only allow-listed signed-in users may use this (same gate as the assistant)
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "")
    const { data: userData } = await admin.auth.getUser(jwt)
    const email = userData?.user?.email
    if (!email) return json({ error: "Please sign in." }, 401)
    const { data: allow } = await admin.from("allowed_emails").select("email").ilike("email", email).maybeSingle()
    if (!allow) return json({ error: "Not authorised." }, 403)

    const { text, now, tz } = await req.json()
    if (!text || typeof text !== "string" || !text.trim()) return json({ error: "Paste an email first." }, 400)

    const nowLocal = (typeof now === "string" && now) ? now : new Date().toISOString().slice(0, 16)
    const zone = (typeof tz === "string" && tz) ? tz : "Europe/London"

    const system =
      `You analyse a work email and decide whether it implies a meeting, call, or appointment that should go on the calendar. ` +
      `The current local date-time is ${nowLocal} (timezone ${zone}). ` +
      `Working hours are Monday to Friday, 09:00–18:00 local time — never propose a weekend or a time outside working hours. ` +
      `Always answer by calling the propose_meeting tool. ` +
      `If the email proposes, requests, or confirms a meeting, set is_meeting=true. ` +
      `If it gives a specific date AND time, set has_explicit_time=true and put it in "datetime" as 'YYYY-MM-DDTHH:mm'. ` +
      `If it wants to meet but gives no specific time, set has_explicit_time=false and fill "proposed_slots" with 2-3 concrete start times ('YYYY-MM-DDTHH:mm') on the soonest working days, within working hours. ` +
      `Resolve relative dates ("tomorrow", "next Tuesday", "end of week") against the current date. ` +
      `Keep "title" and "agenda" in the same language as the email. ` +
      `If there is no meeting to schedule, set is_meeting=false and leave the other fields empty.`

    const messages = [{ role: "user", content: `Here is the email:\n\n${text.slice(0, 8000)}` }]
    const resp = await callClaude(system, messages)
    const block = (resp.content || []).find((b: { type: string }) => b.type === "tool_use")
    if (!block) return json({ error: "Could not read that email." }, 502)

    return json({ proposal: block.input })
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
