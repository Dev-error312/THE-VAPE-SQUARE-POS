/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ FATAL: Missing Supabase environment variables.\n' +
    'Create a .env file in the project root with:\n' +
    'VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// ─── Auth State Change Listener ─────────────────────────────────────────────
// Handle token refresh failures and session expiration
// IMPORTANT: Store the unsubscribe function to prevent memory leaks
const authUnsubscribe = supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT') {
    // User explicitly signed out or session invalidated
    console.log('✋ User signed out or session invalidated')
    try {
      const { useAuthStore } = await import('../store/authStore')
      const authStore = useAuthStore.getState()
      authStore.clearUser?.()
      // Also clear cart when user logs out
      const { useCartStore } = await import('../store/cartStore')
      useCartStore.getState().clearCart?.()
    } catch {
      // clearUser/clearCart might not exist yet
    }
  }

  if (event === 'TOKEN_REFRESHED' && !session) {
    // Token refresh failed — session is dead
    console.error('❌ Token refresh failed — session expired or invalid')
    try {
      const { useAuthStore } = await import('../store/authStore')
      const authStore = useAuthStore.getState()
      authStore.clearUser?.()
      // Redirect to login only if not already on auth page
      // Check carefully to avoid redirect loops (e.g., /auth?error=...)
      const isAuthPage = window.location.pathname === '/auth' || window.location.pathname.startsWith('/auth/')
      if (!isAuthPage) {
        window.location.href = '/auth'
      }
    } catch {
      // If auth import fails, still try to redirect safely
      const isAuthPage = window.location.pathname === '/auth' || window.location.pathname.startsWith('/auth/')
      if (!isAuthPage) {
        window.location.href = '/auth'
      }
    }
  }

  if (event === 'USER_UPDATED' && !session) {
    // Session became invalid during app usage
    console.warn('⚠️ Session became invalid during login')
    try {
      const { useAuthStore } = await import('../store/authStore')
      useAuthStore.getState().clearUser?.()
    } catch {
      // continue
    }
  }
})

// Export the unsubscribe function so it can be called during cleanup if needed
export function unsubscribeFromAuthChanges(): void {
  authUnsubscribe?.data?.subscription?.unsubscribe?.()
}

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
