import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

// detectSessionInUrl is OFF on purpose: we process auth redirects ourselves so we can read the
// Google `provider_refresh_token`, which is ONLY present in exchangeCodeForSession's return value.
// We also handle hash-token email links (confirm / magic / recovery) so those keep working.
export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    })
  : null

// remove only the auth params (and any hash) from the address bar, preserving the rest
function cleanAuthParamsFromUrl() {
  try {
    const u = new URL(window.location.href)
    ;['code', 'error', 'error_description', 'error_code', 'state'].forEach((p) => u.searchParams.delete(p))
    const search = u.searchParams.toString()
    window.history.replaceState({}, document.title, u.pathname + (search ? '?' + search : ''))
  } catch (_e) {}
}

// Persist the Google refresh token (with retries) so scan-email can mint fresh access tokens.
// The token is emitted by Google ONLY ONCE per consent, so we must not lose it to a transient error.
async function storeGoogleRefreshToken(session) {
  const refresh_token = session?.provider_refresh_token
  if (!session?.user) return
  if (!refresh_token) { console.warn('[gmail] signed in but no Google refresh token returned'); return }
  for (let i = 0; i < 3; i++) {
    const { error } = await supabase.from('email_connections').upsert({
      user_id: session.user.id, email: session.user.email, provider: 'google',
      refresh_token, connected_at: new Date().toISOString(),
    })
    if (!error) { try { localStorage.setItem('bm_gmail_connected', '1') } catch (_e) {} return }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)))
  }
  console.warn('[gmail] could not persist refresh token after retries')
}

// Resolves once any auth redirect in the URL has been processed, so login lands cleanly.
export const oauthCodeExchanged = (async () => {
  if (!supabase || typeof window === 'undefined') return
  const sp = new URLSearchParams(window.location.search)

  // 1) the user denied consent / Google returned an error
  if (sp.get('error')) { cleanAuthParamsFromUrl(); return }

  // 2) PKCE auth code (Google "Connect Gmail" + PKCE email links)
  const code = sp.get('code')
  if (code) {
    try {
      const { data } = await supabase.auth.exchangeCodeForSession(code)
      await storeGoogleRefreshToken(data?.session)
    } catch (_e) { /* e.g. PKCE verifier missing (link opened in another browser) — user can retry */ }
    finally { cleanAuthParamsFromUrl() }
    return
  }

  // 3) hash-token links (email confirm / magic link / password recovery, implicit-style)
  const hash = window.location.hash.startsWith('#') ? new URLSearchParams(window.location.hash.slice(1)) : null
  const at = hash?.get('access_token'), rt = hash?.get('refresh_token')
  if (at && rt) {
    try { await supabase.auth.setSession({ access_token: at, refresh_token: rt }) } catch (_e) {}
    finally { cleanAuthParamsFromUrl() }
  }
})()
