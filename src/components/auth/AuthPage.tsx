import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from './AuthLayout'
import EmailConfirmationModal from './EmailConfirmationModal'
import ForgotPasswordModal from './ForgotPasswordModal'

// ─── Google Icon SVG ──────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('auth_remember_me') === 'true')
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const { signIn, signInWithGoogle, user, initialized } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Only redirect if initialized and user exists
  // This prevents race condition on mobile/Safari
  useEffect(() => {
    if (initialized && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate, initialized])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { error } = await signIn(email, password, rememberMe)
      if (error) {
        // Check if error is due to unconfirmed email
        if (error.includes('confirm your email')) {
          setUnconfirmedEmail(email)
        } else {
          toast.error(error)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    try {
      const { error } = await signInWithGoogle('login')
      if (error) toast.error(error)
    } catch {
      toast.error('Google sign-in failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleBackFromConfirmation = () => {
    setUnconfirmedEmail(null)
    setEmail('')
    setPassword('')
  }

  // Don't render form until initialization is complete
  // This prevents the race condition on mobile/Safari where form shows but session exists
  if (!initialized) {
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
    <>
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

        .btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          padding: 0.75rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: rgba(255,255,255,0.85);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
          margin-bottom: 1.5rem;
        }
        .btn-google:hover:not(:disabled) {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.18);
          transform: translateY(-1px);
        }
        .btn-google:disabled { opacity: 0.6; cursor: not-allowed; }

        .divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          color: rgba(255,255,255,0.2);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
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
        .btn-submit:active:not(:disabled) { transform: translateY(0); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .spin {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .form-footer {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.35);
        }
        .footer-link {
          color: #818cf8;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem;
          transition: color 0.2s;
          padding: 0;
        }
        .footer-link:hover { color: #a5b4fc; }

        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 2rem;
        }
        @media (min-width: 1024px) { .mobile-brand { display: none; } }

        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .checkbox-input {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #6366f1;
        }
        .checkbox-label {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          user-select: none;
          font-family: 'DM Sans', sans-serif;
        }
        .checkbox-label:hover {
          color: rgba(255,255,255,0.8);
        }
      `}</style>

      <div className={`form-card ${mounted ? 'mounted' : ''}`}>
        <div className="mobile-brand">
          <div className="brand-icon" style={{ width: 36, height: 36, borderRadius: 10 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Vyapaar</span>
        </div>

        <p className="form-title">Welcome back</p>
        <p className="form-sub">Sign in to your Vyapaar account.</p>

        <button className="btn-google" onClick={handleGoogleAuth} disabled={googleLoading}>
          {googleLoading ? <span className="spin" /> : <GoogleIcon />}
          {googleLoading ? 'Connecting…' : 'Continue with Google'}
        </button>

        <div className="divider">or continue with email</div>

        <form onSubmit={handleSubmit} className="fields-enter">
          <div className="field">
            <label className="field-label">Email Address</label>
            <input type="email" className="field-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="field">
            <label className="field-label">Password</label>
            <div className="field-pw">
              <input
                type={showPassword ? 'text' : 'password'}
                className="field-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required minLength={6}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
            <button
              type="button"
              className="footer-link"
              onClick={() => setShowForgotPassword(true)}
              style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}
            >
              Forgot password?
            </button>
          </div>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="rememberMe"
              className="checkbox-input"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe" className="checkbox-label">
              Remember me on this device
            </label>
          </div>

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? <span className="spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="form-footer">
          New? Register Business →{' '}
          <button type="button" className="footer-link" onClick={() => navigate('/register')}>Get Started</button>
        </div>
      </div>
    </AuthLayout>

      {unconfirmedEmail && (
        <EmailConfirmationModal
          email={unconfirmedEmail}
          onBack={handleBackFromConfirmation}
        />
      )}

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  )
}
