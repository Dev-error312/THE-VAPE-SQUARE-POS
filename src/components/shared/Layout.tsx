import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  LogOut, ShoppingBag, Menu, X, ChevronRight,
  TrendingUp, DollarSign, CreditCard, Store
} from 'lucide-react'
import { useState } from 'react'
import Footer from './Footer'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos',       icon: ShoppingCart,    label: 'Point of Sale' },
  { to: '/inventory', icon: Package,          label: 'Inventory' },
  { to: '/reports',   icon: BarChart3,        label: 'Reports' },
  { to: '/analytics', icon: TrendingUp,       label: 'Analytics' },
  { to: '/wholesale', icon: Store,            label: 'Wholesale' },
  { to: '/expenses',  icon: DollarSign,       label: 'Expenses' },
  { to: '/credits',   icon: CreditCard,       label: 'Credits' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-slate-900 border-r border-slate-800 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">The Vape Square</div>
            <div className="text-xs text-slate-500">Nepal</div>
          </div>
          <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }
              `}>
              {({ isActive }) => (
                <>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-200">
                {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200 truncate">{user?.full_name || 'User'}</div>
              <div className="text-xs text-slate-500 truncate capitalize">{user?.role || 'cashier'}</div>
            </div>
          </div>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm">The Vape Square</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
