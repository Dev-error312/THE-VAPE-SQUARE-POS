import { useState } from 'react'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft } from 'lucide-react'

interface EmailConfirmationModalProps {
  email: string
  onBack: () => void
}

export default function EmailConfirmationModal({ email, onBack }: EmailConfirmationModalProps) {
  const [loading, setLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  const handleResendEmail = async () => {
    setLoading(true)
    try {
      // Call the Supabase Edge Function to resend email
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-confirmation-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ email })
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
        const errorMessage = responseData?.error || `Failed to resend email with status ${response.status}`
        throw new Error(errorMessage)
      }

      setResendSent(true)
      toast.success('Confirmation email resent! Check your inbox.')
      
      // Reset after 3 seconds
      setTimeout(() => {
        setResendSent(false)
      }, 3000)
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <style>{`
        .confirmation-modal {
          background: linear-gradient(135deg, #080b12 0%, #0f1419 100%);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 20px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          max-width: 450px;
          width: 100%;
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 2rem 2rem 1.5rem;
          border-bottom: 1px solid rgba(99,102,241,0.1);
        }

        .mail-icon {
          width: 50px;
          height: 50px;
          background: rgba(99,102,241,0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6366f1;
          flex-shrink: 0;
        }

        .modal-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .modal-content {
          padding: 2rem;
          text-align: center;
        }

        .email-text {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.7);
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }

        .email-address {
          display: inline-block;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-family: 'Monaco', monospace;
          color: #6366f1;
          font-size: 0.9rem;
          margin: 1rem 0 1.5rem;
          word-break: break-all;
        }

        .instructions {
          background: rgba(34,197,94,0.05);
          border: 1px solid rgba(34,197,94,0.2);
          border-radius: 8px;
          padding: 1rem;
          margin: 1.5rem 0;
          text-align: left;
        }

        .instructions-title {
          font-weight: 600;
          color: #22c55e;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }

        .instructions-list {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
          margin: 0;
          padding-left: 1.5rem;
        }

        .instructions-list li {
          margin-bottom: 0.4rem;
        }

        .modal-footer {
          display: flex;
          gap: 1rem;
          padding: 1.5rem 2rem 2rem;
          border-top: 1px solid rgba(99,102,241,0.1);
        }

        .btn {
          flex: 1;
          padding: 0.875rem 1rem;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .btn-back {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
        }

        .btn-back:hover {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.8);
        }

        .btn-back:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-resend {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #fff;
        }

        .btn-resend:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(99,102,241,0.3);
        }

        .btn-resend:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .resend-success {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: #22c55e;
          margin-top: 0.5rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="confirmation-modal">
        <div className="modal-header">
          <div className="mail-icon">
            <Mail size={28} />
          </div>
          <h2 className="modal-title">Verify Your Email</h2>
        </div>

        <div className="modal-content">
          <p className="email-text">
            We've sent a confirmation link to your email address. Please click the link to verify your account and complete your registration.
          </p>

          <div className="email-address">
            {email}
          </div>

          <div className="instructions">
            <div className="instructions-title">What to do next:</div>
            <ul className="instructions-list">
              <li>Check your inbox for the confirmation email</li>
              <li>Click the confirmation link in the email</li>
              <li>You'll be able to log in once verified</li>
            </ul>
          </div>

          <p className="email-text" style={{ fontSize: '0.85rem', marginTop: '1.5rem' }}>
            Didn't receive the email? Check your spam folder or click the button below to resend.
          </p>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-back"
            onClick={onBack}
            disabled={loading}
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <button 
            className="btn btn-resend"
            onClick={handleResendEmail}
            disabled={loading || resendSent}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Sending...
              </>
            ) : resendSent ? (
              <>
                ✓ Sent
              </>
            ) : (
              <>
                <Mail size={18} />
                Resend Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
