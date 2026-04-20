import { supabase } from './supabase'

export const businessApi = {
  async registerBusiness(
    businessName: string,
    fullName: string,
    email: string,
    password: string
  ) {
    try {
      // Step 1: Create auth user using client-side signUp
      // This automatically sends confirmation email
      console.log("Creating auth user via signUp:", email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })

      if (authError) {
        console.error("Auth signup error:", authError)
        if (authError.message?.includes("already exists") || authError.message?.includes("duplicate")) {
          throw new Error("This email address is already registered. Please sign in or use a different email.")
        }
        throw new Error(authError.message || 'Signup failed')
      }

      if (!authData.user?.id) {
        throw new Error('Failed to create user')
      }

      const userId = authData.user.id
      console.log("Auth user created:", userId)

      // Step 2: Create business and user profile via Edge Function
      console.log("Creating business record")
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-business`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ 
            userId,
            businessName,
            fullName,
            email: email.toLowerCase()
          })
        }
      )

      // Parse the response body
      let responseData: any
      try {
        responseData = await response.json()
      } catch (e) {
        console.error('Failed to parse response:', e)
        throw new Error('Invalid response from server')
      }

      // Check if request was successful
      if (!response.ok) {
        // Extract and throw the error message
        const errorMessage = responseData?.error || `Failed to create business with status ${response.status}`
        throw new Error(errorMessage)
      }

      // Success case
      if (!responseData?.business?.id) {
        throw new Error('Failed to create business - no business ID returned')
      }

      // Return user and business data
      return { 
        success: true, 
        user: authData.user, 
        business: responseData.business,
        profile: responseData.profile
      }
    } catch (error: any) {
      // Re-throw with the message so the UI can display it
      throw new Error(error?.message || 'Registration failed. Please try again.')
    }
  }
}
