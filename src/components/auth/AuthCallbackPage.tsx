import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { checkUserStatus } = useAuthStore()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    handleCallback()
  }, [])

  async function handleCallback() {
    try {
      // ── Check if user already has a valid session before OAuth
      const { data: existingSession } = await supabase.auth.getSession()
      const isReauth = !!existingSession?.session

      // ── The implicit flow puts tokens in the URL hash: #access_token=...
      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace('#', ''))

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        // Explicitly set the session
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          console.error('❌ setSession error:', error.message)
          navigate('/auth?error=session_failed', { replace: true })
          return
        }

        // Wait for the auth state to actually fire SIGNED_IN event
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('⏱️ Auth event timeout, proceeding anyway')
            resolve()
          }, 3000)

          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
              clearTimeout(timeout)
              subscription.unsubscribe()
              resolve()
            }
          })
        })
      } else {
        // No hash tokens — maybe it's already set (e.g. page refresh on /auth-callback)
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) {
          console.error('❌ No tokens in URL and no existing session')
          navigate('/auth?error=no_tokens', { replace: true })
          return
        }
      }

      // ── If they were already logged in (re-auth flow), just go to dashboard ──
      if (isReauth) {
        navigate('/dashboard', { replace: true })
        return
      }

      // ── New login: Check user status to route correctly ──
      const { isNewUser, hasBusiness } = await checkUserStatus()

      if (isNewUser || !hasBusiness) {
        navigate('/register', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }

    } catch (err) {
      console.error('❌ Auth callback error:', err)
      navigate('/auth?error=callback_failed', { replace: true })
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b12',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      fontFamily: 'DM Sans, sans-serif',
      color: 'rgba(255,255,255,0.6)',
    }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(99,102,241,0.3)',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: '0.9rem', margin: 0 }}>Signing you in…</p>
    </div>
  )
}
