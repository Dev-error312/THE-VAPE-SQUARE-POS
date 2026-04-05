import { NavLink, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3,
  LogOut, ShoppingBag, Menu, X, ChevronRight,
  TrendingUp, DollarSign, CreditCard, Store, Users, Calculator,
  HelpCircle, BookOpen, Sparkles, Settings
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
  // { to: '/accounting', icon: Calculator,      label: 'Accounting',   adminOnly: true  },
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">{user?.business_name || 'The Vape Square'}</div>
            <div className="text-xs text-slate-500">Nepal</div>
          </div>
          <button className="ml-auto lg:hidden text-slate-600 dark:text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation & Others — Scrollable together */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {mainNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800'
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

          {/* Others Section — Scrollable with main nav */}
          {othersNavItems.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 mt-2 pt-3">
              <div className="px-1 py-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Others</p>
              </div>
              <div className="space-y-0.5">
                {othersNavItems.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                      ${isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800'
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
              </div>
            </div>
          )}
        </nav>

        {/* User Section — Stuck at bottom */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-4 flex-shrink-0 space-y-3">
          <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
            <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-200">
                {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{user?.full_name || 'User'}</div>
              <div className="text-xs text-slate-500 capitalize">
                {user?.role === 'admin' ? 'Admin' : 'Cashier'}
              </div>
            </div>
          </Link>
          {/* Theme toggle */}
          <ThemeToggle />
          {/* Sign out button */}
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 dark:text-slate-400 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{user?.business_name || 'The Vape Square'}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
