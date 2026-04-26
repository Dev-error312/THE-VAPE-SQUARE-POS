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

// Create custom storage that respects "Remember Me" preference
// If user didn't check "Remember Me", use sessionStorage (cleared on close)
// If user checked "Remember Me", use localStorage (persistent)
class ConditionalStorage {
  private primaryStorage = localStorage
  private fallbackStorage = sessionStorage

  getItem(key: string): string | null {
    // Try to find the item in either storage location
    // This handles the case where tokens were saved before preference changed
    let value = this.primaryStorage.getItem(key)
    if (value === null) {
      value = this.fallbackStorage.getItem(key)
    }
    return value
  }

  setItem(key: string, value: string): void {
    const rememberMe = localStorage.getItem('auth_remember_me') === 'true'
    const storage = rememberMe ? this.primaryStorage : this.fallbackStorage
    storage.setItem(key, value)
    // Also clear from the other storage to avoid conflicts
    const otherStorage = rememberMe ? this.fallbackStorage : this.primaryStorage
    otherStorage.removeItem(key)
  }

  removeItem(key: string): void {
    this.primaryStorage.removeItem(key)
    this.fallbackStorage.removeItem(key)
  }
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
      storage: new ConditionalStorage(),
    },
  }
)

// ─── Auth State Change Listener ─────────────────────────────────────────────
// Handle token refresh failures and session expiration
// IMPORTANT: Keep this synchronous to avoid "message channel closed" errors
// Any async work must happen WITHOUT returning true from the listener
const authUnsubscribe = supabase.auth.onAuthStateChange((event, session) => {
  // CRITICAL: Never interfere with password recovery flow
  // PASSWORD_RECOVERY events contain valid recovery sessions that must not be cleared
  if (event === 'PASSWORD_RECOVERY') {
    console.log('🔐 PASSWORD_RECOVERY in progress - skipping cleanup to preserve recovery session')
    return
  }

  if (event === 'SIGNED_OUT') {
    // User explicitly signed out or session invalidated
    console.log('✋ User signed out or session invalidated')
    // Do NOT await here - execute async cleanup in background
    if (typeof window !== 'undefined') {
      Promise.resolve().then(async () => {
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
      }).catch(err => console.error('Async cleanup failed:', err))
    }
  }

  if (event === 'TOKEN_REFRESHED' && !session) {
    // Token refresh failed — session is dead
    console.error('❌ Token refresh failed — session expired or invalid')
    if (typeof window !== 'undefined') {
      Promise.resolve().then(async () => {
        try {
          const { useAuthStore } = await import('../store/authStore')
          const authStore = useAuthStore.getState()
          authStore.clearUser?.()
          // Redirect to login only if not already on auth page
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
      }).catch(err => console.error('Token refresh error handling failed:', err))
    }
  }

  if (event === 'USER_UPDATED' && !session) {
    // Session became invalid during app usage
    console.warn('⚠️ Session became invalid during app usage')
    if (typeof window !== 'undefined') {
      Promise.resolve().then(async () => {
        try {
          const { useAuthStore } = await import('../store/authStore')
          useAuthStore.getState().clearUser?.()
        } catch {
          // continue
        }
      }).catch(err => console.error('User update cleanup failed:', err))
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
