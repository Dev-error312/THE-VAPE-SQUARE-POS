import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type ThemeMode } from '../../hooks/useTheme'

const OPTIONS: { mode: ThemeMode; icon: React.ElementType; label: string }[] = [
  { mode: 'light',  icon: Sun,     label: 'Light'  },
  { mode: 'system', icon: Monitor, label: 'System' },
  { mode: 'dark',   icon: Moon,    label: 'Dark'   },
]

/**
 * Compact 3-way theme toggle.
 * Placed in the sidebar footer so it's always reachable on desktop and mobile.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 bg-slate-950/60 dark:bg-slate-950/60 rounded-lg p-0.5 w-full">
      {OPTIONS.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          title={label}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md
            text-xs font-medium transition-all duration-150
            ${theme === mode
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }
          `}
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
