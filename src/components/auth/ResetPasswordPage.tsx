import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import AuthLayout from './AuthLayout'

type ResetStep = 'waiting' | 'form' | 'success' | 'error'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<ResetStep>('waiting')
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setMounted(true)
    console.log('🔄 ResetPasswordPage mounted')
    console.log('📍 Current URL:', window.location.href)
    console.log('📍 Hash:', window.location.hash)
  }, [])

  // Listen for PASSWORD_RECOVERY event - Supabase automatically exchanges hash tokens
  // This is the signal that the reset token has been successfully validated
  useEffect(() => {
    console.log('⏳ Waiting for PASSWORD_RECOVERY event from Supabase...')
    console.log('🔗 URL:', window.location.href)
    
    let sessionCheckAttempts = 0
    const maxAttempts = 10
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event, 'Session:', !!session)
      
      if (event === 'PASSWORD_RECOVERY' && session) {
        console.log('✅ PASSWORD_RECOVERY event received - reset link is valid!')
        setStep('form')
        setError('')
      } else if (event === 'SIGNED_OUT') {
        console.warn('⚠️ Session lost during password reset')
        // Don't treat as error - user might have naturally signed out
      }
    })

    // Check if we already have a valid session (in case event was processed before this mounted)
    const checkSession = async () => {
      sessionCheckAttempts++
      console.log(`🔍 Session check attempt ${sessionCheckAttempts}/${maxAttempts}`)
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('❌ Session check error:', sessionError.message)
          // Only show error after multiple attempts
          if (sessionCheckAttempts >= maxAttempts) {
            setStep('error')
            setError('Invalid or expired reset link. Please request a new one.')
            return
          }
        }
        
        if (session) {
          console.log('✅ Session exists from reset link')
          setStep('form')
          return
        }
        
        // If no session and we haven't hit max attempts, retry after a short delay
        if (sessionCheckAttempts < maxAttempts) {
          console.log('⏳ No session yet, retrying...')
          setTimeout(checkSession, 300)
        } else {
          // Max attempts reached without finding a session
          console.error('❌ Failed to establish session after maximum attempts')
          // Check if there's an error in the URL that we can extract
          const hash = window.location.hash
          if (hash.includes('error_description')) {
            const errorMatch = hash.match(/error_description=([^&]+)/)
            if (errorMatch) {
              const errorMsg = decodeURIComponent(errorMatch[1]).replace(/\+/g, ' ')
              setError(`Reset link error: ${errorMsg}`)
            } else {
              setError('Invalid or expired reset link. Please request a new one.')
            }
          } else {
            setError('Auth session missing! Please request a new password reset link.')
          }
          setStep('error')
        }
      } catch (err) {
        console.error('Exception during session check:', err)
        if (sessionCheckAttempts >= maxAttempts) {
          setError('An error occurred while processing your reset link.')
          setStep('error')
        } else {
          setTimeout(checkSession, 300)
        }
      }
    }

    // Start checking for session
    checkSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const validatePassword = (password: string): boolean => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords first
    if (!validatePassword(newPassword)) {
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      console.log('🔄 Updating password...')
      
      // Even if sessionReady is false, try to update - Supabase might have the session
      const { data: { user }, error: getUserError } = await supabase.auth.getUser()
      
      if (getUserError) {
        console.error('❌ Cannot get user before password update:', getUserError)
        setError('Unable to verify your identity. Please use a fresh reset link.')
        setStep('error')
        setLoading(false)
        return
      }
      
      if (!user) {
        console.error('❌ No authenticated user found')
        setError('Session expired. Please request a new password reset link.')
        setStep('error')
        setLoading(false)
        return
      }
      
      console.log('✅ User verified, proceeding with password update')
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        console.error('❌ Password update failed:', updateError)
        setError(updateError.message)
        setStep('error')
        toast.error(`Failed to reset password: ${updateError.message}`)
        setLoading(false)
        return
      }

      // Success!
      console.log('✅ Password updated successfully')
      setStep('success')
      toast.success('Password reset successfully!')

      // Sign them out so they log in with new password
      await supabase.auth.signOut().catch(() => {})

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth', { replace: true })
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      console.error('❌ Exception during password reset:', message, err)
      setError(message)
      setStep('error')
      toast.error(message)
      setLoading(false)
    }
  }

  if (!mounted) {
    return (
      <AuthLayout>
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin" />
            <p className="text-slate-600 dark:text-slate-400 text-sm">Loading...</p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <style>{`
        .form-card {
          width: 100%;
          max-width: 420px;
          position: relative;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .form-card.mounted { opacity: 1; transform: translateY(0); }

        .form-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0;
          margin-bottom: 0.375rem;
        }
        .form-sub {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.4);
          margin-bottom: 1.75rem;
        }

        .field { margin-bottom: 1rem; }
        .field-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          margin-bottom: 0.5rem;
          letter-spacing: 0.02em;
        }
        .field-input {
          width: 100%;
          box-sizing: border-box;
          padding: 0.75rem 1rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: #fff;
          font-size: 0.9375rem;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.2); }
        .field-input:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.05);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        
        .field-pw { position: relative; }
        .field-pw .field-input { padding-right: 2.75rem; }
        .pw-toggle {
          position: absolute;
          right: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: rgba(255,255,255,0.65); }

        .btn-submit {
          width: 100%;
          padding: 0.875rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 0.9375rem;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.25rem;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(99,102,241,0.3);
          letter-spacing: 0.01em;
        }
        .btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(99,102,241,0.45);
        }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .error-box {
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .success-card {
          text-align: center;
          padding: 2rem 0;
        }
        .success-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1rem;
          color: #10b981;
        }
        .success-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.5rem;
        }
        .success-text {
          color: rgba(255,255,255,0.6);
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }

        .back-link {
          text-align: center;
          margin-top: 1.5rem;
        }
        .back-link-btn {
          color: #818cf8;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        .back-link-btn:hover { color: #a5b4fc; }
      `}</style>

      <div className={`form-card ${mounted ? 'mounted' : ''}`}>
        {step === 'waiting' && (
          <div className="success-card">
            <div className="w-12 h-12 mx-auto mb-4">
              <div className="w-full h-full border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            </div>
            <p className="success-title">Verifying Reset Link</p>
            <p className="success-text">
              Please wait while we validate your password reset link...
            </p>
          </div>
        )}

        {step === 'form' && (
          <>
            <p className="form-title">Reset Password</p>
            <p className="form-sub">Enter your new password below.</p>

            {error && (
              <div className="error-box">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label className="field-label">New Password</label>
                <div className="field-pw">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="field-input"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Confirm Password</label>
                <div className="field-pw">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="field-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="btn-submit"
              >
                {loading ? (
                  <>
                    <span
                      className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </>
        )}

        {step === 'success' && (
          <div className="success-card">
            <CheckCircle className="success-icon" />
            <p className="success-title">Password Reset Successfully</p>
            <p className="success-text">
              Your password has been changed. You'll be redirected to login shortly.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="success-card">
            <AlertCircle className="success-icon" style={{ color: '#ef4444' }} />
            <p className="success-title">Unable to Reset Password</p>
            <p className="success-text">{error}</p>
            <a href="/auth" className="back-link-btn">
              Back to Login
            </a>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
