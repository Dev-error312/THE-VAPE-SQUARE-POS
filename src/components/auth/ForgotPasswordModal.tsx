import { useState } from 'react'
import { Mail, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

type ModalStep = 'email' | 'success'

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<ModalStep>('email')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Check if user exists by attempting to send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        // Log the actual error for debugging
        console.error('❌ Password Reset Error:', resetError)
        console.error('Error Code:', resetError.status)
        console.error('Error Message:', resetError.message)
        
        // Show error to user if it's a real error
        if (resetError.message) {
          // Handle rate limiting specifically
          if (resetError.message.includes('rate limit')) {
            setError('Too many reset attempts. Please wait a few minutes before trying again.')
            toast.error('Rate limited: Please wait before requesting another reset link')
          } else if (resetError.message.includes('unexpected')) {
            // For generic/unexpected errors, show success message for security
            setStep('success')
            toast.success('If an account exists with this email, a reset link has been sent')
          } else {
            setError(`Unable to send reset email: ${resetError.message}`)
            toast.error(`Unable to send reset email: ${resetError.message}`)
          }
        } else {
          // For security, show success message for unknown errors
          setStep('success')
          toast.success('If an account exists with this email, a reset link has been sent')
        }
      } else {
        // Success
        setStep('success')
        toast.success('If an account exists with this email, a reset link has been sent')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      console.error('❌ Exception during password reset:', message, err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setEmail('')
    setError('')
    setStep('email')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Forgot Password</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'email' ? (
            <>
              <p className="text-slate-300 text-sm mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mb-4 flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-2 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Check Your Email</h3>
                <p className="text-slate-300 text-sm mb-6">
                  If an account exists with <strong>{email}</strong>, you'll receive a password reset link shortly.
                </p>
                <p className="text-slate-400 text-xs mb-6">
                  Didn't receive it? Check your spam folder or try again.
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
