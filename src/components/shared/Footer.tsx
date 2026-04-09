import { useEffect, useState } from 'react'
import { updatesApi } from '../../lib/updatesApi'

const COMPANY = 'Vyapaar'
const BRAND = 'Suyog Adhikari'
const YEAR = new Date().getFullYear()

export default function Footer() {
  const [version, setVersion] = useState('v1.0.0')

  const fetchLatestVersion = async () => {
    try {
      // Get all published updates and get the first one (latest)
      const updates = await updatesApi.getAll()
      if (updates.length > 0) {
        setVersion(`v${updates[0].version}`)
      }
    } catch (err) {
      console.warn('Failed to fetch app version:', err)
      // Keep default version if fetch fails
    }
  }

  useEffect(() => {
    // Fetch version on mount
    fetchLatestVersion()

    // Refetch when app comes back into focus
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLatestVersion()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <footer className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-4 py-2.5">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-600 select-none">
        <span>© {YEAR} {COMPANY}. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <span className="text-slate-700">{version}</span>
          <span className="hidden sm:inline text-slate-800">·</span>
          <span className="hidden sm:inline">Powered by <span className="text-slate-500 font-medium">{BRAND}</span></span>
        </div>
      </div>
    </footer>
  )
}
