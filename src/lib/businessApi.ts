import { supabase } from './supabase'

export const businessApi = {
  async registerBusiness(
    businessName: string,
    fullName: string,
    email: string,
    password: string
  ) {
    try {
      // Step 1: Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      })

      if (authError) throw new Error(authError.message)
      if (!authData.user) throw new Error('Failed to create auth user')

      const authUserId = authData.user.id

      // Step 2: Create business record
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert([{ name: businessName }])
        .select()
        .single()

      if (businessError) throw new Error(`Failed to create business: ${businessError.message}`)
      if (!businessData) throw new Error('Failed to create business')

      const businessId = businessData.id

      // Step 3: Create user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          auth_user_id: authUserId,
          business_id: businessId,
          email,
          name: fullName,
          role: 'admin',
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (profileError) throw new Error(`Failed to create user profile: ${profileError.message}`)
      if (!profileData) throw new Error('Failed to create user profile')

      // Step 4: Auto-login the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw new Error(`Login after registration failed: ${signInError.message}`)

      return { success: true, user: authData.user, business: businessData }
    } catch (error: any) {
      console.error('Registration error:', error)
      throw error
    }
  }
}
