import { useState, useCallback, useMemo, useEffect } from 'react'
import { salesApi } from '../../lib/salesApi'
import { expensesApi, damagedApi } from '../../lib/expensesApi'
import { wholesaleApi } from '../../lib/wholesaleApi'
import { useSettings } from '../../hooks/useSettings'
import { formatCurrency, formatDate } from '../../utils'
import { adToBS, bsToAD, getDaysInBS, getMonthRangeDatesAuto } from '../../utils/dateConverter'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, DollarSign, ShoppingBag, AlertTriangle,
  Download, RefreshCw, Calendar, Info, Banknote, Wifi, Store
} from 'lucide-react'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'
import { useRefreshStore } from '../../store/refreshStore'

interface DayRow {
  date: string
  dateLabel: string
  sales: number
  revenue: number
  gross_profit: number
  expenses: number
  damages: number
  net_profit: number
}

interface WholesaleSummary {
  total_revenue: number
  total_profit: number
  total_sales: number
}

interface PaymentTotals {
  cash: number
  online: number
}

export default function AnalyticsPage() {
  const { settings } = useSettings()
  const dateFormat = settings?.date_format ?? 'AD'

  // Calculate this month's start and end based on calendar type (using UTC to avoid timezone issues)
  const getThisMonthRange = () => {
    if (dateFormat === 'BS') {
      const todayBS = adToBS(new Date())
      const monthStartBS = { year: todayBS.year, month: todayBS.month, day: 1 }
      const monthEndBS = {
        year: todayBS.year,
        month: todayBS.month,
        day: getDaysInBS(todayBS.year, todayBS.month),
      }
      return {
        start: bsToAD(monthStartBS).toISOString().slice(0, 10),
        end: bsToAD(monthEndBS).toISOString().slice(0, 10),
      }
    } else {
      // Use UTC to avoid timezone issues (e.g., April 1 local becoming March 31 UTC)
      const now = new Date()
      const year = now.getUTCFullYear()
      const month = now.getUTCMonth()
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
      // Last day of month: get first day of next month, subtract 1 day
      const nextMonthDate = new Date(Date.UTC(year, month + 1, 1))
      nextMonthDate.setUTCDate(0)
      const end = nextMonthDate.toISOString().slice(0, 10)
      return { start, end }
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const thisMonthRange = getThisMonthRange()

  const [startDate, setStartDate] = useState(thisMonthRange.start)
  const [endDate, setEndDate] = useState(todayStr)
  const [selectedPreset, setSelectedPreset] = useState<string>('This Month')
  const [rows, setRows] = useState<DayRow[]>([])
  const [paymentTotals, setPaymentTotals] = useState<PaymentTotals>({ cash: 0, online: 0 })
  const [wholesale, setWholesale] = useState<WholesaleSummary>({ total_revenue: 0, total_profit: 0, total_sales: 0 })
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  // Subscribe to global refresh — when a sale is deleted elsewhere, reset the report
  const salesVersion = useRefreshStore(s => s.salesVersion)
  // When data changes globally, reset so user regenerates fresh data
  useEffect(() => {
    if (hasLoaded) {
      setHasLoaded(false)
      setRows([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesVersion])

  // Auto-load data when dates change (includes initial mount)
  useEffect(() => {
    if (startDate && endDate) {
      load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  // When calendar preference changes, recalculate dates automatically
  useEffect(() => {
    const newRange = getThisMonthRange()
    setStartDate(newRange.start)
    setEndDate(newRange.end)
    setSelectedPreset('This Month')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFormat])

  // ─────────────────────────────────────────────────────────────────────────
  // PRESETS — Calendar-aware date preset calculations
  // ─────────────────────────────────────────────────────────────────────────
  const getPresets = useCallback(() => {
    if (dateFormat === 'BS') {
      // Calculate dates in BS calendar, then convert to AD for storage
      const todayAD = new Date()
      const todayBS = adToBS(todayAD)

      // Today in BS → convert back to AD for storage
      const todayADStr = bsToAD({ year: todayBS.year, month: todayBS.month, day: todayBS.day })
        .toISOString().slice(0, 10)

      // This week in BS: 6 days before today in BS
      const weekStartBS = { ...todayBS }
      weekStartBS.day -= 6
      if (weekStartBS.day <= 0) {
        weekStartBS.day += getDaysInBS(weekStartBS.year, weekStartBS.month)
        weekStartBS.month -= 1
        if (weekStartBS.month <= 0) {
          weekStartBS.month = 12
          weekStartBS.year -= 1
        }
      }
      const weekStartADStr = bsToAD(weekStartBS).toISOString().slice(0, 10)

      // This month in BS: from 1st to last day of current BS month
      const monthStartBS = { year: todayBS.year, month: todayBS.month, day: 1 }
      const monthEndBS = {
        year: todayBS.year,
        month: todayBS.month,
        day: getDaysInBS(todayBS.year, todayBS.month),
      }
      const monthStartADStr = bsToAD(monthStartBS).toISOString().slice(0, 10)
      const monthEndADStr = bsToAD(monthEndBS).toISOString().slice(0, 10)

      return [
        { label: 'Today',      start: todayADStr, end: todayADStr },
        { label: 'This Week',  start: weekStartADStr, end: todayADStr },
        { label: 'This Month', start: monthStartADStr, end: monthEndADStr },
      ]
    } else {
      // AD calendar (default) — original logic
      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const monthEndStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
      const weekStart = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
      return [
        { label: 'Today',      start: todayStr, end: todayStr },
        { label: 'This Week',  start: weekStart, end: todayStr },
        { label: 'This Month', start: monthStartStr, end: monthEndStr },
      ]
    }
  }, [dateFormat])

  const PRESETS = useMemo(() => getPresets(), [getPresets])

  const load = useCallback(async () => {
    if (!startDate || !endDate) { toast.error('Select a date range'); return }
    if (startDate > endDate) { toast.error('Start date must be before end date'); return }

    setLoading(true)
    try {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0)
      const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)

      const [salesReport, expenses, damages, payTotals, wsData] = await Promise.all([
        salesApi.getSalesReport(start.toISOString(), end.toISOString()),
        expensesApi.getAll(startDate, endDate),
        damagedApi.getAll(startDate, endDate),
        salesApi.getPaymentTotals(start.toISOString(), end.toISOString()),
        wholesaleApi.getSummary(startDate, endDate),
      ])

      // Build day-by-day map
      const dateMap: Record<string, DayRow> = {}
      const cur = new Date(startDate)
      while (cur <= new Date(endDate)) {
        const ds = cur.toISOString().slice(0, 10)
        dateMap[ds] = {
          date: ds,
          dateLabel: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sales: 0, revenue: 0, gross_profit: 0, expenses: 0, damages: 0, net_profit: 0,
        }
        cur.setDate(cur.getDate() + 1)
      }

      for (const r of salesReport) {
        if (dateMap[r.date]) {
          dateMap[r.date].sales = r.sales
          dateMap[r.date].revenue = r.revenue
          dateMap[r.date].gross_profit = r.profit
        }
      }
      for (const e of expenses) {
        const d = e.expense_date.slice(0, 10)
        if (dateMap[d]) dateMap[d].expenses += e.amount
      }
      for (const d of damages) {
        const dt = d.damage_date.slice(0, 10)
        if (dateMap[dt]) dateMap[dt].damages += d.loss_amount
      }
      for (const row of Object.values(dateMap)) {
        row.net_profit = row.gross_profit - row.expenses - row.damages
      }

      setRows(Object.values(dateMap))
      setPaymentTotals(payTotals)
      setWholesale(wsData)
      setHasLoaded(true)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      sales:        acc.sales + r.sales,
      revenue:      acc.revenue + r.revenue,
      gross_profit: acc.gross_profit + r.gross_profit,
      expenses:     acc.expenses + r.expenses,
      damages:      acc.damages + r.damages,
      net_profit:   acc.net_profit + r.net_profit,
    }),
    { sales: 0, revenue: 0, gross_profit: 0, expenses: 0, damages: 0, net_profit: 0 }
  ), [rows])

  const chartData = useMemo(() =>
    rows.filter(r => r.revenue > 0 || r.expenses > 0 || r.damages > 0),
    [rows]
  )

  const handleExport = () => {
    if (!hasLoaded || rows.length === 0) { toast.error('No data to export'); return }
    const lines = [
      `SwiftPOS Analytics Report`,
      `Period: ${startDate} to ${endDate}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `--- RETAIL SALES ---`,
      `Date,Sales,Revenue,Gross Profit,Expenses,Damages,Net Profit`,
      ...rows.map(r => `${r.date},${r.sales},${r.revenue},${r.gross_profit},${r.expenses},${r.damages},${r.net_profit}`),
      `TOTAL,${totals.sales},${totals.revenue},${totals.gross_profit},${totals.expenses},${totals.damages},${totals.net_profit}`,
      ``,
      `--- PAYMENT BREAKDOWN ---`,
      `Cash,${paymentTotals.cash}`,
      `Online,${paymentTotals.online}`,
      ``,
      `--- WHOLESALE ---`,
      `Revenue,${wholesale.total_revenue}`,
      `Profit,${wholesale.total_profit}`,
      `Transactions,${wholesale.total_sales}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `analytics-${startDate}-${endDate}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded')
  }

  const totalCombinedRevenue = totals.revenue + wholesale.total_revenue
  const totalCombinedProfit  = totals.net_profit + wholesale.total_profit

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Daily breakdown with net profit calculation</p>
        </div>
        {hasLoaded && (
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Date range */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
            <input type="date" className="input" value={startDate} onChange={e => { setStartDate(e.target.value); setSelectedPreset('') }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={endDate} onChange={e => { setEndDate(e.target.value); setSelectedPreset('') }} />
          </div>
          <button onClick={load} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <RefreshCw className="w-4 h-4" />
            }
            Generate Report
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => {
            const displayLabel = dateFormat === 'BS' ? `${p.label} (BS)` : p.label
            return (
            <button key={p.label}
              onClick={() => { setStartDate(p.start); setEndDate(p.end); setSelectedPreset(p.label) }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                selectedPreset === p.label
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {displayLabel}
            </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" text="Calculating analytics..." />
        </div>
      ) : !hasLoaded ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-600">
          <TrendingUp className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Select a date range and generate your report</p>
        </div>
      ) : (
        <>
          {/* Retail summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: 'Total Sales',   value: totals.sales,        fmt: false, icon: ShoppingBag,  color: 'text-primary-400', bg: 'bg-primary-500/10' },
              { label: 'Revenue',       value: totals.revenue,      fmt: true,  icon: DollarSign,   color: 'text-primary-400', bg: 'bg-primary-500/10' },
              { label: 'Gross Profit',  value: totals.gross_profit, fmt: true,  icon: TrendingUp,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Expenses',      value: totals.expenses,     fmt: true,  icon: DollarSign,   color: 'text-red-400',     bg: 'bg-red-500/10',    neg: true },
              { label: 'Damage Loss',   value: totals.damages,      fmt: true,  icon: AlertTriangle,color: 'text-amber-400',   bg: 'bg-amber-500/10',  neg: true },
              { label: 'Net Profit',    value: totals.net_profit,   fmt: true,  icon: TrendingUp,   color: totals.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400', bg: totals.net_profit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className={`text-lg font-bold font-mono leading-none ${s.color}`}>
                  {s.fmt ? formatCurrency(Math.abs(s.value as number)) : s.value}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Payment breakdown — Cash vs Online */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Banknote className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">Total Cash Collected</p>
                <p className="text-2xl font-bold text-emerald-400 font-mono">{formatCurrency(paymentTotals.cash)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Wifi className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">Total Online Collected</p>
                <p className="text-2xl font-bold text-blue-400 font-mono">{formatCurrency(paymentTotals.online)}</p>
              </div>
            </div>
          </div>

          {/* Net Profit Formula */}
          <div className="card p-4 bg-slate-100 dark:bg-slate-800/60">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Net Profit Calculation (Retail)</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm font-mono">
              <span className="text-emerald-400">{formatCurrency(totals.gross_profit)}</span>
              <span className="text-slate-500">Gross Profit</span>
              <span className="text-slate-500">−</span>
              <span className="text-red-400">{formatCurrency(totals.expenses)}</span>
              <span className="text-slate-500">Expenses</span>
              <span className="text-slate-500">−</span>
              <span className="text-amber-400">{formatCurrency(totals.damages)}</span>
              <span className="text-slate-500">Damages</span>
              <span className="text-slate-500">=</span>
              <span className={`text-lg font-bold ${totals.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(totals.net_profit)}
              </span>
            </div>
          </div>

          {/* Wholesale section */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-violet-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Wholesale Summary</h2>
              <span className="text-xs text-slate-500 ml-1">for selected period</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'WS Revenue',      value: wholesale.total_revenue, color: 'text-violet-400' },
                { label: 'WS Profit',       value: wholesale.total_profit,  color: 'text-emerald-400' },
                { label: 'WS Transactions', value: wholesale.total_sales,   color: 'text-slate-700 dark:text-slate-300', isCnt: true },
              ].map(s => (
                <div key={s.label} className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold font-mono ${s.color}`}>
                    {s.isCnt ? s.value : formatCurrency(s.value as number)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Retail vs Wholesale comparison */}
            <div className="border-t border-slate-200 dark:border-slate-700/40 pt-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">Retail vs Wholesale</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Retail Revenue</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(totals.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Wholesale Revenue</span>
                    <span className="font-mono text-violet-400">{formatCurrency(wholesale.total_revenue)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700/40 pt-2 font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Combined Revenue</span>
                    <span className="font-mono text-white">{formatCurrency(totalCombinedRevenue)}</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Retail Net Profit</span>
                    <span className={`font-mono ${totals.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(totals.net_profit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Wholesale Profit</span>
                    <span className="font-mono text-violet-400">{formatCurrency(wholesale.total_profit)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700/40 pt-2 font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Combined Profit</span>
                    <span className={`font-mono ${totalCombinedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(totalCombinedProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Daily Revenue & Profit</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <XAxis dataKey="dateLabel" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12 }}
                    formatter={(v: number, name: string) => [formatCurrency(v), name]}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Bar dataKey="revenue"      name="Revenue"      fill="#0ea5e9" radius={[3,3,0,0]} />
                  <Bar dataKey="gross_profit" name="Gross Profit" fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="expenses"     name="Expenses"     fill="#ef4444" radius={[3,3,0,0]} />
                  <Bar dataKey="damages"      name="Damages"      fill="#f59e0b" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Day-by-day table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/40">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Daily Breakdown
                <span className="text-slate-500 text-sm font-normal ml-2">{startDate} to {endDate}</span>
              </h2>
              <button onClick={handleExport} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3">
                <Download className="w-3 h-3" /> Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-800/40">
                    <th className="text-left px-5 py-3">Date</th>
                    <th className="text-right px-5 py-3">Sales</th>
                    <th className="text-right px-5 py-3">Revenue</th>
                    <th className="text-right px-5 py-3">Gross Profit</th>
                    <th className="text-right px-5 py-3">Expenses</th>
                    <th className="text-right px-5 py-3">Damages</th>
                    <th className="text-right px-5 py-3">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.date} className={`border-b border-slate-200 dark:border-slate-700/30 transition-colors ${r.revenue > 0 || r.expenses > 0 || r.damages > 0 ? 'hover:bg-slate-200 dark:hover:bg-slate-700/20' : 'opacity-40'}`}>
                      <td className="px-5 py-2.5 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="px-5 py-2.5 text-right text-sm text-slate-600 dark:text-slate-400 font-mono">{r.sales || '—'}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-sm text-slate-800 dark:text-slate-200">{r.revenue > 0 ? formatCurrency(r.revenue) : '—'}</td>
                      <td className={`px-5 py-2.5 text-right font-mono text-sm ${r.gross_profit > 0 ? 'text-emerald-400' : r.gross_profit < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                        {r.gross_profit !== 0 ? formatCurrency(r.gross_profit) : '—'}
                      </td>
                      <td className={`px-5 py-2.5 text-right font-mono text-sm ${r.expenses > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                        {r.expenses > 0 ? formatCurrency(r.expenses) : '—'}
                      </td>
                      <td className={`px-5 py-2.5 text-right font-mono text-sm ${r.damages > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                        {r.damages > 0 ? formatCurrency(r.damages) : '—'}
                      </td>
                      <td className={`px-5 py-2.5 text-right font-bold font-mono text-sm ${r.net_profit > 0 ? 'text-emerald-400' : r.net_profit < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                        {r.revenue > 0 || r.expenses > 0 || r.damages > 0 ? formatCurrency(r.net_profit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/80 font-bold">
                    <td className="px-5 py-3 text-slate-800 dark:text-slate-200">TOTAL</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-800 dark:text-slate-200">{totals.sales}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-800 dark:text-white">{formatCurrency(totals.revenue)}</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-400">{formatCurrency(totals.gross_profit)}</td>
                    <td className="px-5 py-3 text-right font-mono text-red-400">{totals.expenses > 0 ? `−${formatCurrency(totals.expenses)}` : '—'}</td>
                    <td className="px-5 py-3 text-right font-mono text-amber-400">{totals.damages > 0 ? `−${formatCurrency(totals.damages)}` : '—'}</td>
                    <td className={`px-5 py-3 text-right font-mono text-lg ${totals.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(totals.net_profit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
