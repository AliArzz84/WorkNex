import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient(url, key) : null

// The Google refresh token only appears in the SIGNED_IN event fired right after the OAuth
// redirect — getSession() never returns it. Subscribe here, at module load (before React
// mounts), so we never miss that event, and persist it for the scan-email function to use.
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const refresh_token = session?.provider_refresh_token
    if (!refresh_token || !session?.user) return
    // defer: calling supabase synchronously inside this callback can deadlock the auth lock
    setTimeout(() => {
      supabase
        .from('email_connections')
        .upsert({ user_id: session.user.id, email: session.user.email, provider: 'google', refresh_token })
        .then(
          ({ error }) => { if (!error) { try { localStorage.setItem('bm_gmail_connected', '1') } catch (e) {} } },
          () => {},
        )
    }, 0)
  })
}
