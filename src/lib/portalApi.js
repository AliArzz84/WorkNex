// Employee-portal + invoices API — thin wrappers over Supabase, kept out of the main
// store so the battle-tested workspace logic stays untouched. Everything here is
// gated by RLS (see supabase/invoices.sql): employees only ever touch their own rows.
import { supabase } from './supabaseClient.js'

const BUCKET = 'invoices'

/* the only currencies an invoice can be issued in */
export const INVOICE_CURRENCIES = [
  { code: 'USD', symbol: '$', label: '$ USD' },
  { code: 'GBP', symbol: '£', label: '£ GBP' },
  { code: 'AMD', symbol: '֏', label: '֏ AMD' },
]
export const invMoney = (n, code) => {
  const amt = Number(n || 0)
  const dp = Math.round(amt * 100) % 100 === 0 ? 0 : 2
  const num = amt.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return code === 'GBP' ? '£' + num : code === 'AMD' ? num + ' AMD' : '$' + num
}

/* ---------- access requests (public → manager approves) ---------- */
// goes through a guarded DB function so it can't create duplicates or requests from
// people who are already approved. Returns: 'ok' | 'already_member' | 'already_requested' | 'invalid'
export async function submitAccessRequest({ name, email, note }) {
  const { data, error } = await supabase.rpc('request_access', {
    p_name: (name || '').trim(),
    p_email: (email || '').trim().toLowerCase(),
    p_note: (note || '').trim() || null,
  })
  if (error) throw error
  return data
}
export async function listAccessRequests() {
  const { data, error } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
export async function approveAccessRequest(id) {
  const { error } = await supabase.rpc('approve_access_request', { p_id: id })
  if (error) throw error
}
export async function rejectAccessRequest(id) {
  const { error } = await supabase.rpc('reject_access_request', { p_id: id })
  if (error) throw error
}
export async function deleteAccessRequest(id) {
  const { error } = await supabase.from('access_requests').delete().eq('id', id)
  if (error) throw error
}

/* ---------- invoices ---------- */
// upload an attachment into the caller's own <uid>/ folder; returns the storage path
export async function uploadAttachment(userId, file) {
  if (!file) return null
  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
  const path = `${userId}/${Date.now()}_${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return path
}
// employee submits one invoice (optionally with a file already uploaded → attachment path)
export async function createInvoice(row) {
  const { error } = await supabase.from('invoices').insert(row)
  if (error) throw error
}
export async function listMyInvoices() {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
export async function listAllInvoices() {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
export async function updateInvoice(id, patch) {
  const { error } = await supabase.from('invoices').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteInvoice(id, attachment) {
  if (attachment) { try { await supabase.storage.from(BUCKET).remove([attachment]) } catch (e) { } }
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}
// short-lived signed URL so a manager (or the owner) can open a private attachment
export async function attachmentUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data?.signedUrl || null
}
