import { NavLink, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  LogOut, ShoppingBag, Menu, X, ChevronRight,
  TrendingUp, DollarSign, CreditCard, Store, Users,
  HelpCircle, BookOpen, Sparkles, Settings,
  Calculator
} from 'lucide-react'
import { useState } from 'react'
import Footer from './Footer'
import ThemeToggle from './ThemeToggle'
import { useAuthStore } from '../../store/authStore'
import { useIsAdmin } from '../../hooks/useRole'
import toast from 'react-hot-toast'

const MAIN_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',     adminOnly: false },
  { to: '/pos',       icon: ShoppingCart,    label: 'Point of Sale', adminOnly: false },
  { to: '/inventory', icon: Package,          label: 'Inventory',    adminOnly: false },
  { to: '/wholesale', icon: Store,            label: 'Wholesale',    adminOnly: false },
  { to: '/reports',   icon: BarChart3,        label: 'Reports',      adminOnly: true  },
  { to: '/accounting', icon: Calculator,      label: 'Accounting',   adminOnly: true  },
  { to: '/analytics', icon: TrendingUp,       label: 'Analytics',    adminOnly: true  },
  { to: '/employees', icon: Users,            label: 'Employees',    adminOnly: true  },
  { to: '/expenses',  icon: DollarSign,       label: 'Expenses',     adminOnly: true  },
  { to: '/credits',   icon: CreditCard,       label: 'Credits',      adminOnly: true  },
]

const OTHERS_NAV = [
  { to: '/help',      icon: HelpCircle,  label: 'Help & Support', adminOnly: false },
  { to: '/tutorials', icon: BookOpen,    label: 'Tutorials',      adminOnly: false },
  { to: '/whats-new', icon: Sparkles,    label: "What's New",     adminOnly: false },
  { to: '/settings',  icon: Settings,    label: 'Settings',       adminOnly: false },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()

  const mainNavItems = MAIN_NAV.filter(item => !item.adminOnly || isAdmin)
  const othersNavItems = OTHERS_NAV.filter(item => !item.adminOnly || isAdmin)

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 dark:from-slate-900 dark:via-slate-950 dark:to-black border-r border-slate-800/30 flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-6 flex-shrink-0">
          <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/30">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-white text-base">{user?.business_name || 'Square Hotel'}</div>
            <div className="text-xs text-slate-400 font-medium">Nepal</div>
          </div>
          <button className="ml-auto lg:hidden text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/50" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation & Others — Scrollable together */}
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {/* Main Section */}
          <div className="space-y-1">
            {mainNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold
                  transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/40 translate-x-1'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                  }
                `}>
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Others Section — Scrollable with main nav */}
          {othersNavItems.length > 0 && (
            <div className="border-t border-slate-800/50 mt-3 pt-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4 mb-2">Utilities</p>
              <div className="space-y-1">
                {othersNavItems.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/40 translate-x-1'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                      }
                    `}>
                    {({ isActive }) => (
                      <>
                        <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="flex-1">{label}</span>
                        {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User Section — Stuck at bottom */}
        <div className="border-t border-slate-800/50 px-3 py-4 flex-shrink-0 space-y-3">
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800/50 transition-all duration-200 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:shadow-lg group-hover:shadow-primary-600/40 transition-all">
              <span className="text-xs font-bold text-white">
                {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-200 truncate">{user?.full_name || 'User'}</div>
              <div className="text-xs text-slate-500 capitalize font-medium">
                {user?.role === 'admin' ? 'Administrator' : 'Cashier'}
              </div>
            </div>
          </Link>
          {/* Theme toggle */}
          <ThemeToggle />
          {/* Sign out button */}
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-rose-300 hover:bg-rose-900/20 transition-all duration-200">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-4 px-4 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{user?.business_name || 'Square Hotel'}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
