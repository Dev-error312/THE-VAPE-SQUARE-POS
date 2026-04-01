/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Missing Supabase environment variables.\n' +
    'Create a .env file in the project root with:\n' +
    'VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
)

// ─── Auth State Change Listener ─────────────────────────────────────────────
// Handle token refresh failures and session expiration
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT') {
    // User explicitly signed out
    console.log('✋ User signed out')
    try {
      const { useAuthStore } = await import('../store/authStore')
      useAuthStore.getState().clearUser?.()
    } catch {
      // clearUser might not exist yet
    }
  }

  if (event === 'TOKEN_REFRESHED' && !session) {
    // Token refresh failed — session is dead
    console.error('❌ Token refresh failed — session expired')
    try {
      const { useAuthStore } = await import('../store/authStore')
      const authStore = useAuthStore.getState()
      authStore.clearUser?.()
      window.location.href = '/auth'
    } catch {
      window.location.href = '/auth'
    }
  }
})

// ─── Error Detection Helper ────────────────────────────────────────────────
export function isRefreshTokenExpired(error: unknown): boolean {
  if (!error) return false
  const err = error as { message?: string; status?: number }
  return (
    err.message?.includes?.('Refresh Token Not Found') ||
    err.message?.includes?.('invalid_grant') ||
    err.status === 400
  )
}
