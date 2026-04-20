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
    
    const { email } = requestBody

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create Supabase admin client
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

    console.log("Resending confirmation email to:", email)

    // Use the REST API to resend confirmation email
    // This calls the Supabase auth service's resend endpoint
    const resendResponse = await fetch(
      `${supabaseUrl}/auth/v1/resend`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          type: 'signup'
        })
      }
    )

    const resendData = await resendResponse.json()
    console.log("Resend response status:", resendResponse.status)
    console.log("Resend response data:", resendData)

    if (!resendResponse.ok) {
      const errorMsg = resendData?.msg || resendData?.error || `Failed to resend email with status ${resendResponse.status}`
      console.error("Resend error:", errorMsg)
      return new Response(
        JSON.stringify({ error: `Failed to resend email: ${errorMsg}` }),
        { status: resendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Confirmation email resent successfully")
    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email resent successfully",
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
