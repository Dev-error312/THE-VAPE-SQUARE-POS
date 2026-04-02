import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface AuthState {
  user: User | null
  session: unknown | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
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

  const fallback: User = {
    id: authUser.id,
    auth_user_id: authUser.id,
    email: authUser.email ?? '',
    full_name: authUser.user_metadata?.full_name ?? '',
    name: authUser.user_metadata?.full_name ?? '',
    role: 'cashier',
    business_id: '00000000-0000-0000-0000-000000000001',
    business_name: 'The Vape Square',
    created_at: authUser.created_at,
  }

  try {
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('Profile query error:', profileError)
      return fallback
    }

    if (existingProfile) {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', existingProfile.business_id)
        .single()

      if (businessError) {
        console.warn('Business query error:', businessError, 'business_id:', existingProfile.business_id)
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

    console.log('No existing profile found for:', authUser.id, '- treating as new user')
    return fallback

  } catch (error) {
    console.error('Error in getOrCreateUserProfile:', error)
    return fallback
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  initialize: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        set({ user: null, session: null, loading: false })
        return
      }
      const user = await getOrCreateUserProfile(session.user)
      set({ session, user, loading: false })
    } catch {
      set({ user: null, session: null, loading: false })
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      if (!data.session || !data.user) return { error: 'Login failed. Please try again.' }

      const user = await getOrCreateUserProfile(data.user)
      set({ session: data.session, user, loading: false })
      return { error: null }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Login failed' }
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
    const redirectUrl = new URL(`${window.location.origin}/auth-callback`)
    redirectUrl.searchParams.set('origin', origin)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl.toString() },
    })
    if (error) return { error: error.message }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, loading: false })
  },

  clearUser: () => {
    set({ user: null, session: null, loading: false })
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
        console.warn('No authenticated user found:', authError?.message)
        return { isNewUser: true, hasBusiness: false }
      }

      console.log('Authenticated user found:', authUser.email)

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

      console.log('User status check:', {
        email: authUser.email,
        isNewUser,
        hasBusiness,
        profileExists,
        business_id: profileRow?.business_id,
      })

      // ── Step 3: Load full profile into store if they're an existing user ──
      if (!isNewUser) {
        const userProfile = await getOrCreateUserProfile(authUser)
        set({ user: userProfile, loading: false })
      }

      return { isNewUser, hasBusiness }
    } catch (error) {
      console.error('Error checking user status:', error)
      return { isNewUser: true, hasBusiness: false }
    }
  },
}))