import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Eye, EyeOff, Zap, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { businessApi } from '../../lib/businessApi'
import { useAuthStore } from '../../store/authStore'

export default function RegisterBusinessPage() {
  const navigate = useNavigate()
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  
  const [businessName, setBusinessName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

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
      const result = await businessApi.registerBusiness(
        businessName,
        fullName,
        email,
        password
      )

      if (result.user?.id) {
        await fetchProfile(result.user.id)
        toast.success('Business registered successfully!')
        navigate('/dashboard')
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration failed. Please try again.')
      console.error('Registration error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
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
            <span className="text-xl font-bold text-slate-900 dark:text-white">The Vape Square</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-6">
            Register Your Business
            <span className="text-primary-400"> Today</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
            Start managing your inventory, process sales, and grow your business with our complete POS solution.
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
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">The Vape Square</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Register Your Business
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Create your business account and get started
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="label">Business Name</label>
              <input
                type="text"
                className="input"
                placeholder="Your Business Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="Your Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input pr-10"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Zap className="w-4 h-4" />Register Business</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-slate-600 dark:text-slate-400 text-sm">
            Already have a business?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
