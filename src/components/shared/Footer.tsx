const APP_VERSION = 'v1.0.0'
const COMPANY    = 'The Vape Square'
const BRAND      = 'Suyog Adhikari'
const YEAR       = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="flex-shrink-0 border-t border-slate-800 bg-slate-900/60 px-4 py-2.5">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-600 select-none">
        <span>© {YEAR} {COMPANY}. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <span className="text-slate-700">{APP_VERSION}</span>
          <span className="hidden sm:inline text-slate-800">·</span>
          <span className="hidden sm:inline">Powered by <span className="text-slate-500 font-medium">{BRAND}</span></span>
        </div>
      </div>
    </footer>
  )
}
