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
    
    const { userId, businessName, fullName, email } = requestBody

    // Validate input
    if (!userId || !businessName || !fullName || !email) {
      console.error("Validation failed - missing fields")
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, businessName, fullName, email" }),
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

    // Step 1: Create business record (bypasses RLS with service role)
    console.log("Creating business:", businessName)
    const { data: businessData, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({ name: businessName })
      .select()
      .single()

    if (businessError) {
      console.error("Business creation error:", businessError)
      return new Response(
        JSON.stringify({ error: `Failed to create business: ${businessError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!businessData) {
      console.error("No business data returned")
      return new Response(
        JSON.stringify({ error: "Failed to create business" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const businessId = businessData.id
    console.log("Business created:", businessId)

    // Step 2: Create user profile
    console.log("Creating user profile")
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        auth_user_id: userId,
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
      // Clean up: delete business
      await supabaseAdmin.from("businesses").delete().eq("id", businessId)
      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Business and profile created successfully")
    return new Response(
      JSON.stringify({
        success: true,
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
