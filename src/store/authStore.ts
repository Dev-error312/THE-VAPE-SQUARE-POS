import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface AuthState {
  user: User | null
  session: unknown | null
  loading: boolean
  rememberMe: boolean
  initialized: boolean
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signInWithGoogle: (origin?: 'login' | 'register') => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  clearUser: () => void
  initialize: () => Promise<void>
  fetchProfile: (authUserId: string) => Promise<void>
  checkUserStatus: () => Promise<{ isNewUser: boolean; hasBusiness: boolean }>
}

async function getOrCreateUserProfile(authUser: {
  id: string
  email?: string
  user_metadata?: Record<string, string>
  created_at: string
}): Promise<User> {

  try {
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Profile query error:', profileError)
      throw new Error(`Failed to fetch user profile: ${profileError.message}`)
    }

    if (existingProfile) {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', existingProfile.business_id)
        .single()

      // Business lookup errors are non-critical (we log but continue)
      if (businessError) {
        console.warn('⚠️ Business lookup error (non-critical):', businessError.message)
      }

      const role = (existingProfile.role === 'admin' || existingProfile.role === 'cashier')
        ? existingProfile.role
        : 'cashier'

      return {
        id: existingProfile.id,
        auth_user_id: existingProfile.auth_user_id,
        email: existingProfile.email,
        full_name: existingProfile.name,
        name: existingProfile.name,
        role,
        business_id: existingProfile.business_id,
        business_name: businessData?.name ?? `Business (${existingProfile.business_id})`,
        created_at: existingProfile.created_at,
      }
    }

    // No profile found and not a "not found" error - this is unexpected
    throw new Error(`No user profile found for auth user ${authUser.id}`)

  } catch (error) {
    console.error('Error in getOrCreateUserProfile:', error)
    throw error
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  rememberMe: localStorage.getItem('auth_remember_me') === 'true',
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      const rememberMe = localStorage.getItem('auth_remember_me') === 'true'
      
      // Session retrieval failed (could be network error or invalid token)
      if (error) {
        console.warn('⚠️ Session expired, re-establishing from stored tokens...')
        console.debug('Session error details:', {
          message: error.message,
          status: (error as any)?.status,
          code: (error as any)?.code,
        })
        
        // Try to refresh the token using the refresh token
        try {
          const refreshToken = localStorage.getItem('supabase.auth.token')?.includes('refresh_token')
            ? JSON.parse(localStorage.getItem('supabase.auth.token') || '{}').refresh_token
            : sessionStorage.getItem('supabase.auth.token')?.includes('refresh_token')
            ? JSON.parse(sessionStorage.getItem('supabase.auth.token') || '{}').refresh_token
            : null

          if (refreshToken) {
            console.debug('Attempting to refresh session with stored refresh token...')
            const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession()
            if (!refreshError && refreshedSession?.session) {
              console.log('✅ Session refreshed successfully')
              // Successfully refreshed - load user profile
              try {
                const user = await getOrCreateUserProfile(refreshedSession.session.user)
                set({ session: refreshedSession.session, user, loading: false, initialized: true, rememberMe })
                return
              } catch (profileError) {
                console.error('Failed to load profile after refresh:', profileError)
                set({ user: null, session: null, loading: false, initialized: true, rememberMe })
                return
              }
            } else if (refreshError) {
              console.error('❌ Failed to re-establish session: AuthSessionMissingError: Auth session missing!')
              console.debug('Refresh error details:', {
                message: refreshError.message,
                status: (refreshError as any)?.status,
                code: (refreshError as any)?.code,
              })
            }
          } else {
            console.warn('No refresh token found in storage')
          }
        } catch (refreshError) {
          console.error('Token refresh attempt threw error:', refreshError)
        }

        // If refresh failed or no refresh token, clear the session
        console.log('Clearing invalid session...')
        await supabase.auth.signOut().catch(() => {})
        set({ user: null, session: null, loading: false, initialized: true, rememberMe })
        return
      }
      
      // No session found
      if (!session) {
        console.debug('No session found in storage')
        set({ user: null, session: null, loading: false, initialized: true, rememberMe })
        return
      }

      // Check if user selected "Remember Me" when logging in
      if (!rememberMe) {
        // If not remembering me, clear the session immediately
        // This will log them out when they close the app
        console.debug('Remember Me not selected, clearing session')
        await supabase.auth.signOut().catch(() => {})
        set({ user: null, session: null, loading: false, initialized: true, rememberMe: false })
        return
      }
      
      // Session exists and user selected "Remember Me", load user profile
      try {
        const user = await getOrCreateUserProfile(session.user)
        console.log('✅ Session restored and profile loaded')
        set({ session, user, loading: false, initialized: true, rememberMe: true })
      } catch (profileError) {
        console.error('Failed to load profile:', profileError)
        set({ user: null, session: null, loading: false, initialized: true, rememberMe })
      }
    } catch (error) {
      console.error('Error during auth initialization:', error)
      set({ user: null, session: null, loading: false, initialized: true, rememberMe: localStorage.getItem('auth_remember_me') === 'true' })
    }
  },

  signIn: async (email, password, rememberMe = false) => {
    try {
      // Set the "Remember Me" preference BEFORE authentication
      // This ensures Supabase stores the token in the correct storage
      if (rememberMe) {
        localStorage.setItem('auth_remember_me', 'true')
      } else {
        localStorage.removeItem('auth_remember_me')
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        // User-friendly error messages
        if (error.message?.includes('Invalid login credentials')) {
          // Clear the remember me flag if login failed
          localStorage.removeItem('auth_remember_me')
          return { error: 'Incorrect email or password' }
        }
        if (error.message?.includes('Email not confirmed')) {
          // Clear the remember me flag if login failed
          localStorage.removeItem('auth_remember_me')
          return { error: 'Please confirm your email before signing in' }
        }
        // Clear the remember me flag if login failed
        localStorage.removeItem('auth_remember_me')
        return { error: error.message || 'Login failed' }
      }
      
      if (!data.session || !data.user) {
        // Clear the remember me flag if login failed
        localStorage.removeItem('auth_remember_me')
        return { error: 'Login failed. Please try again.' }
      }

      try {
        const user = await getOrCreateUserProfile(data.user)
        set({ session: data.session, user, loading: false, rememberMe, initialized: true })
        return { error: null }
      } catch (profileError) {
        console.error('Failed to load profile after login:', profileError)
        // Still log them in even if profile load fails
        set({ session: data.session, user: null, loading: false, rememberMe, initialized: true })
        return { error: null }
      }
    } catch (e: unknown) {
      // Clear the remember me flag if an exception occurs
      localStorage.removeItem('auth_remember_me')
      const message = e instanceof Error ? e.message : 'Login failed'
      return { error: message }
    }
  },

  signUp: async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      })
      if (error) return { error: error.message }
      if (!data.user) return { error: 'Signup failed. Please try again.' }
      return { error: null }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Signup failed' }
    }
  },

  signInWithGoogle: async (origin = 'login') => {
    // Use the env var on production, fall back to current origin for local dev
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
    const redirectUrl = new URL(`${baseUrl}/auth-callback`)
    redirectUrl.searchParams.set('origin', origin)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl.toString() },
    })
    if (error) return { error: error.message }
    return { error: null }
  },

  signOut: async () => {
    localStorage.removeItem('auth_remember_me')
    await supabase.auth.signOut()
    set({ user: null, session: null, loading: false, rememberMe: false, initialized: true })
    // Also clear cart when user signs out
    try {
      const { useCartStore } = await import('./cartStore')
      useCartStore.getState().clearCart?.()
    } catch {
      // Cart store might not be loaded yet
    }
  },

  clearUser: () => {
    set({ user: null, session: null, loading: false, rememberMe: false, initialized: true })
  },

  fetchProfile: async (authUserId: string) => {
    try {
      const user = await getOrCreateUserProfile({
        id: authUserId,
        email: '',
        user_metadata: {},
        created_at: new Date().toISOString(),
      })
      set({ user, loading: false })
    } catch (error) {
      console.error('Failed to fetch profile:', error)
      set({ loading: false })
    }
  },

  // ─── FIX: Determine new vs existing user by whether a profile row exists ────
  // Previously, the code checked `business_id !== fallback_uuid` which wrongly
  // flagged existing Google users as new if their business wasn't found.
  // Now we do a clean, direct check: does a user_profiles row exist for this user?
  checkUserStatus: async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser) {
        set({ initialized: true })
        return { isNewUser: true, hasBusiness: false }
      }

      // ── Step 1: Does a profile row exist for this auth user? ──────────────
      const { data: profileRow, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, business_id, role')
        .eq('auth_user_id', authUser.id)
        .single()

      // PGRST116 = no row found → genuinely new user
      const profileExists = !profileError || profileError.code !== 'PGRST116'

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('Profile lookup error:', profileError)
        // On unexpected DB errors, fail safe: send to register rather than crash
        set({ initialized: true })
        return { isNewUser: true, hasBusiness: false }
      }

      const isNewUser = !profileExists || !profileRow

      // ── Step 2: Does their business exist and is it a real one? ──────────
      let hasBusiness = false
      if (profileRow?.business_id) {
        const FALLBACK_BUSINESS_ID = '00000000-0000-0000-0000-000000000001'
        if (profileRow.business_id !== FALLBACK_BUSINESS_ID) {
          const { data: biz, error: bizError } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', profileRow.business_id)
            .single()
          hasBusiness = !bizError && !!biz
        }
      }

      // ── Step 3: Load full profile into store if they're an existing user ──
      if (!isNewUser) {
        const userProfile = await getOrCreateUserProfile(authUser)
        set({ user: userProfile, loading: false, initialized: true })
      } else {
        set({ initialized: true })
      }

      return { isNewUser, hasBusiness }
    } catch (error) {
      console.error('Error checking user status:', error)
      set({ initialized: true })
      return { isNewUser: true, hasBusiness: false }
    }
  },
}))