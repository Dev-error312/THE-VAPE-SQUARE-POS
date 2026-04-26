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

// ─── Recovery Flow Guard ────────────────────────────────────────────────────
// Set to true when a PASSWORD_RECOVERY event is received.
// ConditionalStorage will refuse to removeItem() while this is true,
// preventing the SIGNED_OUT cleanup from wiping the recovery session.
let isPasswordRecoveryFlow = false

export function setPasswordRecoveryFlow(active: boolean) {
  isPasswordRecoveryFlow = active
  console.log(`🔐 Password recovery flow: ${active ? 'ACTIVE' : 'inactive'}`)
}

// ─── Conditional Storage ────────────────────────────────────────────────────
// If user checked "Remember Me", persist to localStorage; otherwise sessionStorage.
class ConditionalStorage {
  private primaryStorage = localStorage
  private fallbackStorage = sessionStorage

  getItem(key: string): string | null {
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
    // Clear from the other storage to avoid stale conflicts
    const otherStorage = rememberMe ? this.fallbackStorage : this.primaryStorage
    otherStorage.removeItem(key)
  }

  removeItem(key: string): void {
    // CRITICAL: During password recovery, do NOT remove auth tokens.
    // The SIGNED_OUT event fires after PASSWORD_RECOVERY and would otherwise
    // wipe the session before the user can submit the new password form.
    if (isPasswordRecoveryFlow) {
      console.log(`🛡️ Recovery flow active — skipping removeItem("${key}")`)
      return
    }
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
const authUnsubscribe = supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    console.log('🔐 PASSWORD_RECOVERY in progress - activating recovery guard')
    // Activate the storage guard so SIGNED_OUT can't wipe the session
    setPasswordRecoveryFlow(true)
    return
  }

  if (event === 'SIGNED_OUT') {
    // If we're in recovery flow, ignore this SIGNED_OUT — it's a side effect
    // of Supabase clearing the old session when it receives the recovery token.
    if (isPasswordRecoveryFlow) {
      console.log('🛡️ Ignoring SIGNED_OUT during password recovery flow')
      return
    }

    console.log('✋ User signed out or session invalidated')
    if (typeof window !== 'undefined') {
      Promise.resolve().then(async () => {
        try {
          const { useAuthStore } = await import('../store/authStore')
          const authStore = useAuthStore.getState()
          authStore.clearUser?.()
          const { useCartStore } = await import('../store/cartStore')
          useCartStore.getState().clearCart?.()
        } catch {
          // clearUser/clearCart might not exist yet
        }
      }).catch(err => console.error('Async cleanup failed:', err))
    }
  }

  if (event === 'TOKEN_REFRESHED' && !session) {
    console.error('❌ Token refresh failed — session expired or invalid')
    if (typeof window !== 'undefined') {
      Promise.resolve().then(async () => {
        try {
          const { useAuthStore } = await import('../store/authStore')
          const authStore = useAuthStore.getState()
          authStore.clearUser?.()
          const isAuthPage = window.location.pathname === '/auth' || window.location.pathname.startsWith('/auth/')
          if (!isAuthPage) {
            window.location.href = '/auth'
          }
        } catch {
          const isAuthPage = window.location.pathname === '/auth' || window.location.pathname.startsWith('/auth/')
          if (!isAuthPage) {
            window.location.href = '/auth'
          }
        }
      }).catch(err => console.error('Token refresh error handling failed:', err))
    }
  }

  if (event === 'USER_UPDATED' && !session) {
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

export function unsubscribeFromAuthChanges(): void {
  authUnsubscribe?.data?.subscription?.unsubscribe?.()
}

export function isRefreshTokenExpired(error: unknown): boolean {
  if (!error) return false
  const err = error as { message?: string; status?: number }
  return (
    err.message?.includes?.('Refresh Token Not Found') ||
    err.message?.includes?.('invalid_grant') ||
    err.status === 400
  )
}
