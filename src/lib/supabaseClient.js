import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

// detectSessionInUrl is OFF on purpose: we exchange the OAuth code OURSELVES (below) so we
// can read the Google `provider_refresh_token`, which is ONLY present in the return value of
// exchangeCodeForSession — it is stripped from the session later seen by getSession()/onAuthStateChange.
export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    })
  : null

// Resolves once any OAuth `?code=` in the URL has been exchanged for a session.
// store.jsx awaits this before reading the session, so the user is logged in straight after redirect.
export const oauthCodeExchanged = (async () => {
  if (!supabase || typeof window === 'undefined') return
  const sp = new URLSearchParams(window.location.search)
  const code = sp.get('code')
  if (!code) return
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    const session = data?.session
    const refresh_token = session?.provider_refresh_token
    // If this sign-in was a "Connect Gmail" (Google returned a refresh token), persist it so
    // the scan-email function can mint fresh access tokens. Client can write but never read it back.
    if (!error && refresh_token && session?.user) {
      await supabase.from('email_connections').upsert({
        user_id: session.user.id, email: session.user.email, provider: 'google', refresh_token,
      })
      try { localStorage.setItem('bm_gmail_connected', '1') } catch (_e) {}
    }
  } catch (_e) { /* ignore — leaves the user on the login screen to retry */ }
  finally {
    // strip the ?code (and any error params) from the address bar
    try { window.history.replaceState({}, document.title, window.location.pathname) } catch (_e) {}
  }
})()
