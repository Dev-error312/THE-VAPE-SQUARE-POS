// @ts-ignore - URL imports are handled by Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - URL imports are handled by Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    let requestBody: any = {}
    
    // Parse request body
    try {
      const bodyText = await req.text()
      console.log("Raw request body:", bodyText)
      if (bodyText) {
        requestBody = JSON.parse(bodyText)
      }
    } catch (parseErr) {
      console.error("Failed to parse request body:", parseErr)
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    console.log("Register request received:", { email: requestBody.email, businessName: requestBody.businessName })
    
    const { businessName, fullName, email, password } = requestBody

    // Validate input
    if (!businessName || !fullName || !email || !password) {
      console.error("Validation failed - missing fields:", { businessName: !!businessName, fullName: !!fullName, email: !!email, password: !!password })
      return new Response(
        JSON.stringify({ error: "Missing required fields: businessName, fullName, email, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create Supabase admin client (with service role key for bypass RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase env vars")
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Create auth user
    console.log("Creating auth user:", email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      user_metadata: { full_name: fullName },
      email_confirm: false,  // Require email confirmation
    })

    if (authError) {
      console.error("Auth creation error:", authError)
      
      // Check if the error is "User already exists"
      if (authError.message?.includes("already exists") || authError.message?.includes("duplicate") || authError.message?.includes("unique")) {
        return new Response(
          JSON.stringify({ error: "This email address is already registered. Please sign in or use a different email." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!authData.user) {
      console.error("No user returned from auth creation")
      return new Response(
        JSON.stringify({ error: "Failed to create auth user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const authUserId = authData.user.id
    console.log("Auth user created:", authUserId)

    // Step 2: Create business record (bypasses RLS with service role)
    console.log("Creating business:", businessName)
    const { data: businessData, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({ name: businessName })
      .select()
      .single()

    if (businessError) {
      console.error("Business creation error:", businessError)
      // Clean up auth user since business creation failed
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      return new Response(
        JSON.stringify({ error: `Failed to create business: ${businessError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!businessData) {
      console.error("No business data returned")
      // Clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      return new Response(
        JSON.stringify({ error: "Failed to create business" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const businessId = businessData.id
    console.log("Business created:", businessId)

    // Step 3: Create user profile
    console.log("Creating user profile")
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        auth_user_id: authUserId,
        business_id: businessId,
        email: email.toLowerCase(),
        name: fullName,
        role: "admin",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (profileError) {
      console.error("Profile creation error:", profileError)
      // Clean up: delete user and business
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      await supabaseAdmin.from("businesses").delete().eq("id", businessId)
      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("User profile created, registration successful")
    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        business: businessData,
        profile: profileData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Function error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: `Server error: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

