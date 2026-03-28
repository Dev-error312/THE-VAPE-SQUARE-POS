import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { ShoppingCart, Eye, EyeOff, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { signIn, signUp, user } = useAuthStore()
  const navigate = useNavigate()

  // Redirect as soon as user is set in the store
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) {
          toast.error(error)
        }
        // Navigation handled by useEffect above when user is set in store
      } else {
        if (!fullName.trim()) {
          toast.error('Please enter your full name')
          return
        }
        const { error } = await signUp(email, password, fullName)
        if (error) toast.error(error)
        else toast.success('Account created! Check your email to verify, then sign in.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-slate-900 to-slate-950 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary-700 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">The Vape Square</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            Complete Point of Sale
            <span className="text-primary-400"> Solution</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Manage inventory, process sales, track profits, and grow your business — all in one place.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { icon: '📦', label: 'Inventory Tracking' },
            { icon: '🧾', label: 'Invoice Generation' },
            { icon: '📊', label: 'Analytics Dashboard' },
            { icon: '💰', label: 'Profit Reports' },
          ].map((f) => (
            <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-sm font-medium text-slate-300">{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">The Vape Square</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h2>
            <p className="text-slate-400">
              {mode === 'login'
                ? 'Enter your credentials to continue.'
                : 'Set up your POS system account.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input" placeholder="John Doe"
                  value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Zap className="w-4 h-4" />{mode === 'login' ? 'Sign In' : 'Create Account'}</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-slate-400 text-sm">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
