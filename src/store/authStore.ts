import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface AuthState {
  user: User | null
  session: unknown | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  clearUser: () => void
  initialize: () => Promise<void>
  fetchProfile: (authUserId: string) => Promise<void>
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
    // 🔍 Check if user profile already exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single()

    // Handle query errors explicitly
    if (profileError) {
      console.warn('Profile query error:', profileError)
      return fallback
    }

    // 📦 If profile exists, fetch with business info
    if (existingProfile) {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', existingProfile.business_id)
        .single()

      if (businessError) {
        console.warn('Business query error:', businessError, 'business_id:', existingProfile.business_id)
      }

      // ✅ Double-check role is valid (admin or cashier)
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
      // Directly check for session
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        set({ user: null, session: null, loading: false })
        return
      }

      // Session exists — get/create user profile
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

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, loading: false })
  },

  clearUser: () => {
    // Force clear user without calling signOut (for token expiration scenarios)
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
}))
