import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { businessApi } from '../../lib/businessApi'
import AuthLayout from './AuthLayout'
import EmailConfirmationModal from './EmailConfirmationModal'

export default function RegisterBusinessPage() {
  const navigate = useNavigate()
  
  const [businessName, setBusinessName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted] = useState(true)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!businessName.trim()) {
      toast.error('Business name is required')
      return
    }
    if (!fullName.trim()) {
      toast.error('Full name is required')
      return
    }
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await businessApi.registerBusiness(
        businessName,
        fullName,
        email,
        password
      )

      // Show email confirmation modal instead of toast
      setRegisteredEmail(email)
      
      // Reset form
      setBusinessName('')
      setFullName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Registration failed. Please try again.')
      console.error('Registration error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBackFromConfirmation = () => {
    setRegisteredEmail(null)
    navigate('/auth')
  }

  return (
    <>
      <AuthLayout>
        <style>{`
        .form-card {
          width: 100%;
          max-width: 420px;
          position: relative;
          opacity: 1;
          transform: translateY(0);
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(255,255,255,0.6);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.875rem;
          transition: color 0.2s;
          margin-bottom: 1.5rem;
          font-family: 'DM Sans', sans-serif;
        }
        .back-button:hover { color: rgba(255,255,255,0.9); }

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
        .field-input:disabled { opacity: 0.6; cursor: not-allowed; }

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
        .pw-toggle:disabled { cursor: not-allowed; opacity: 0.5; }

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
          margin-bottom: 1.5rem;
        }
        @media (min-width: 1024px) { .mobile-brand { display: none; } }
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

        <button type="button" onClick={() => navigate('/login')} className="back-button">
          <ArrowLeft size={16} />
          Back to Sign In
        </button>

        <p className="form-title">Register Business</p>
        <p className="form-sub">Create your business account and get started</p>

        <form onSubmit={handleRegister}>
          <div className="field">
            <label className="field-label">Business Name</label>
            <input
              type="text"
              className="field-input"
              placeholder="Your Business Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label className="field-label">Full Name</label>
            <input
              type="text"
              className="field-input"
              placeholder="Your Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label className="field-label">Email Address</label>
            <input
              type="email"
              className="field-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label className="field-label">Password</label>
            <div className="field-pw">
              <input
                type={showPassword ? 'text' : 'password'}
                className="field-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="pw-toggle"
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
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="pw-toggle"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <span className="spin" />
            ) : (
              'Register Business'
            )}
          </button>
        </form>

        <div className="form-footer">
          Already have a business?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="footer-link"
          >
            Sign in here
          </button>
        </div>
      </div>
      </AuthLayout>

      {/* Show email confirmation modal after successful registration */}
      {registeredEmail && (
        <EmailConfirmationModal 
          email={registeredEmail}
          onBack={handleBackFromConfirmation}
        />
      )}
    </>
  )
}
