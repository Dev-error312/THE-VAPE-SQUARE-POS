# Password Reset Troubleshooting Guide

## Issue: "Auth session missing!" Error

### What Changed
The `ResetPasswordPage.tsx` has been updated with improved session handling to fix the password reset flow:

1. **Better Session Detection**: Now retries session checks up to 10 times instead of just once
2. **User Verification on Submit**: The form submission now verifies the user exists before attempting password update
3. **Flexible Form Submission**: Form inputs are no longer disabled while waiting for session - they allow typing and submission
4. **Better Error Messages**: More specific error messages that extract details from the URL hash if available

### How Password Reset Should Work

```
1. User enters email on login page
2. Clicks "Forgot Password?" button
3. Modal sends reset email
4. User clicks link in email
5. Browser opens: http://localhost:5173/reset-password#access_token=...&type=recovery
6. ResetPasswordPage detects the token in the URL hash
7. Supabase auth client automatically exchanges token for session
8. PASSWORD_RECOVERY event fires
9. User enters new password
10. Form submission verifies user is authenticated
11. Password is updated
12. User is redirected to login
```

### If You Still See "Auth session missing!"

#### 1. Check Supabase Configuration
- Ensure your Supabase URL and Anon Key are set in `.env`:
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

#### 2. Check Email Configuration in Supabase
- Go to Supabase Dashboard → Authentication → Email Templates
- Check that the "Reset Password" template has the correct redirect URL
- The default should be something like: `{{ .SiteURL }}/reset-password`
- Verify it matches your app's URL

#### 3. Check Allowed Redirect URLs
- In Supabase Dashboard → Authentication → URL Configuration
- Ensure your app URL (e.g., `http://localhost:5173`) is in the allowed redirect URLs
- For production, add your deployed URL

#### 4. Check Browser Console
When accessing the reset link, look for these logs in the browser console:

✅ **Success indicators:**
- "🔍 Session check attempt..." messages
- "✅ Session exists from reset link"
- "✅ User verified, proceeding with password update"
- "✅ Password updated successfully"

❌ **Error indicators:**
- "❌ Failed to establish session after maximum attempts"
- "⚠️ Session lost during password reset"
- "❌ Cannot get user before password update"

#### 5. Test the Flow
1. Get an existing user's email from Supabase
2. Go to `/auth` and click "Forgot Password?"
3. Enter the email address
4. Check the browser's Network tab in DevTools:
   - Look for `resetPasswordForEmail` request
   - Should return 200 OK
5. In Supabase, check "Auth Logs" to see if reset email was sent
6. Copy the reset link from the email (or from Supabase testing interface)
7. Paste it in the browser address bar
8. Watch the console logs as it processes the reset

#### 6. Common Issues and Solutions

**Issue**: Getting 404 on reset link
- **Cause**: Redirect URL in email template doesn't match app URL
- **Fix**: Update Supabase email template to match your app's URL

**Issue**: Token appears in URL but session doesn't establish
- **Cause**: CORS or network issue preventing Supabase auth from exchanging token
- **Fix**: Check browser Network tab for failed requests to Supabase API

**Issue**: Form shows "Session not ready" even after waiting
- **Cause**: PASSWORD_RECOVERY event not firing
- **Fix**: Try manually navigating to the reset URL (not just clicking email link)

**Issue**: Password update fails with "Auth session missing"
- **Cause**: Session expired between form display and submission
- **Fix**: Request a new reset link and try again

### Debug Mode
Add this to the browser console to enable extra logging:
```javascript
localStorage.setItem('debug_password_reset', 'true')
```

Then reload the page and watch for detailed logs about the reset process.

### Need Help?
If the issue persists:
1. Check all console logs and note any error messages
2. Verify Supabase is reachable (check Network tab)
3. Try resetting password for a different user account
4. Check if issue is specific to certain email providers
5. Review Supabase Auth Logs in the dashboard
