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
  initialize: () => Promise<void>
}

async function getOrCreateUser(authUser: {
  id: string
  email?: string
  user_metadata?: Record<string, string>
  created_at: string
}): Promise<User> {

  const fallback: User = {
    id: authUser.id,
    email: authUser.email ?? '',
    full_name: authUser.user_metadata?.full_name ?? '',
    role: 'cashier',
    created_at: authUser.created_at,
  }

  try {
    // 🔍 Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    // 🆕 If NOT exists → create with default role
    if (!existingUser) {
      await supabase.from('users').insert({
        id: authUser.id,
        email: authUser.email ?? '',
        full_name: authUser.user_metadata?.full_name ?? '',
        role: 'cashier',
      })
    }

    // 📦 Always fetch latest user data
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    return (data as User) ?? fallback

  } catch {
    return fallback
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  initialize: async () => {
    try {
      // Directly check for session — most reliable method
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        set({ user: null, session: null, loading: false })
        return
      }

      // Session exists — get/create user profile
      const user = await getOrCreateUser(session.user)
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

      const user = await getOrCreateUser(data.user)
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
}))
