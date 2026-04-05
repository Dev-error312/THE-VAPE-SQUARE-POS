import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useBusinessId } from '../../hooks/useRole'
import { salesApi } from '../../lib/salesApi'
import { purchasesApi } from '../../lib/productsApi'
import type { RestockRecord } from '../../lib/productsApi'
import { useRefreshStore } from '../../store/refreshStore'
import { useIsAdmin } from '../../hooks/useRole'
import { formatCurrency, formatDate } from '../../utils'
import type { Sale } from '../../types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  Calendar, Search, TrendingUp, ShoppingBag, DollarSign,
  BarChart2, Eye, RefreshCw, Trash2, Download,
  Banknote, Wifi, Package,
} from 'lucide-react'
import SaleDetailModal from './SaleDetailModal'
import ConfirmDialog from '../shared/ConfirmDialog'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

type ReportTab = 'sales' | 'restocks'

// ─── small helpers ─────────────────────────────────────────────────────────
const fmtPayment = (m: string) =>
  m === 'cash' ? 'Cash' : m === 'online' ? 'Online' : m === 'split' ? 'Split' : m

const restockBadgeCls = (type: string) => {
  if (type === 'full')    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
  if (type === 'credit')  return 'bg-red-500/15 text-red-400 border border-red-500/30'
  if (type === 'partial') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
  return 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
}

export default function ReportsPage() {
  const today      = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(
    new Date().getFullYear(), new Date().getMonth(), 1,
  ).toISOString().slice(0, 10)

  // ── date range — defaults to Today on first load ─────────────────────
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState(today)
  const [selectedPreset, setSelectedPreset] = useState<string>('Today')

  // ── active tab ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ReportTab>('sales')

  // ── sales state ─────────────────────────────────────────────────────────
  const [sales,         setSales]         = useState<Sale[]>([])
  const [chartData,     setChartData]     = useState<{ date: string; revenue: number; profit: number }[]>([])
  const [paymentTotals, setPaymentTotals] = useState({ cash: 0, online: 0 })
  const [salesLoading,  setSalesLoading]  = useState(true)
  const [searchInvoice, setSearchInvoice] = useState('')
  const [selectedSale,  setSelectedSale]  = useState<Sale | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<Sale | null>(null)
  const [deleting,      setDeleting]      = useState(false)

  // ── restock state ───────────────────────────────────────────────────────
  const [restocks,        setRestocks]        = useState<RestockRecord[]>([])
  const [restocksLoading, setRestocksLoading] = useState(false)
  const [deleteRestockTarget, setDeleteRestockTarget] = useState<RestockRecord | null>(null)
  const [deletingRestock,    setDeletingRestock]    = useState(false)

  // ── globals ─────────────────────────────────────────────────────────────
  const businessId = useBusinessId()
  const triggerSales = useRefreshStore(s => s.triggerSales)
  const salesVersion = useRefreshStore(s => s.salesVersion)
  const isAdmin      = useIsAdmin()

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────
  const loadSales = useCallback(async () => {
    setSalesLoading(true)
    try {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0)
      const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)

      const [salesData, reportData, payTotals] = await Promise.all([
        salesApi.getAll({ startDate: start.toISOString(), endDate: end.toISOString() }),
        salesApi.getSalesReport(start.toISOString(), end.toISOString()),
        salesApi.getPaymentTotals(start.toISOString(), end.toISOString()),
      ])

      setSales(salesData)
      setPaymentTotals(payTotals)
      setChartData(
        reportData.map(r => ({ date: formatDate(r.date), revenue: r.revenue, profit: r.profit })),
      )
    } catch (e) {
      console.error('[ReportsPage] loadSales:', e)
      toast.error('Failed to load sales report')
    } finally {
      setSalesLoading(false)
    }
  }, [startDate, endDate])

  const loadRestocks = useCallback(async () => {
    setRestocksLoading(true)
    try {
      const data = await purchasesApi.getRestockHistory({ startDate, endDate })
      setRestocks(data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load restock history')
    } finally {
      setRestocksLoading(false)
    }
  }, [startDate, endDate])

  // Reload whichever tab is active whenever dates change or sales mutate globally
  useEffect(() => {
    if (activeTab === 'sales') {
      loadSales()
    } else if (activeTab === 'restocks') {
      loadRestocks()
    }
  // loadSales / loadRestocks already include date deps; salesVersion forces a refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSales, loadRestocks, salesVersion, activeTab])

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED — SALES
  // ─────────────────────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => sales
      .filter(s => (s.sale_items || []).length > 0)  // ✅ exclude orphaned sales with no items
      .filter(s =>
        !searchInvoice || s.sale_number.toLowerCase().includes(searchInvoice.toLowerCase()),
      ),
    [sales, searchInvoice],
  )

  const totalRevenue = useMemo(() => sales.reduce((s, sale) => s + sale.total, 0), [sales])
  const totalProfit  = useMemo(() =>
    sales.reduce((sum, sale) =>
      sum + (sale.sale_items || []).reduce(
        (p, item) => p + (item.line_total - item.cost_price * item.quantity), 0,
      ), 0),
    [sales],
  )
  const totalCost = totalRevenue - totalProfit
  const margin    = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED — RESTOCKS
  // ─────────────────────────────────────────────────────────────────────────
  const restockTotals = useMemo(() => ({
    qty:         restocks.reduce((s, r) => s + r.quantity,         0),
    totalCost:   restocks.reduce((s, r) => s + r.total_amount,     0),
    paid:        restocks.reduce((s, r) => s + r.paid_amount,      0),
    outstanding: restocks.reduce((s, r) => s + r.remaining_amount, 0),
  }), [restocks])

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const target = deleteTarget  // capture before clearing
    setDeleteTarget(null)        // close dialog immediately
    try {
      await salesApi.deleteSale(target.id)
      setSales(prev => prev.filter(s => s.id !== target.id))
      toast.success('Transaction deleted and stock restored')
      // ✅ Trigger refresh to sync dashboard and other pages
      useRefreshStore.getState().triggerSales()
    } catch (e: unknown) {
      // On error, the row will stay (no filter applied), which is correct
      toast.error(e instanceof Error ? e.message : 'Failed to delete transaction')
    } finally { setDeleting(false) }
  }

  const handleDeleteRestock = async () => {
    if (!deleteRestockTarget) return
    setDeletingRestock(true)
    const target = deleteRestockTarget
    setDeleteRestockTarget(null)
    try {
      await purchasesApi.deleteRestock(target.id)
      setRestocks(prev => prev.filter(r => r.id !== target.id))
      toast.success('Restock deleted and inventory restored')
      // Trigger refresh to sync
      useRefreshStore.getState().triggerSales()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete restock')
    } finally { setDeletingRestock(false) }
  }

  const handleExportSales = () => {
    if (!sales.length) { toast.error('No data to export'); return }
    const BOM = '\uFEFF'
    const headers = [
      'Date', 'Time', 'Invoice', 'Products', 'Qty', 'Payment Method', 'Revenue (रु)',
      ...(isAdmin ? ['Profit (रु)'] : []),
    ]
    const rows = sales.map(sale => {
      const items = sale.sale_items || []
      const profit = items.reduce(
        (p, item) => p + (item.line_total - item.cost_price * item.quantity), 0,
      )
      const dt = new Date(sale.created_at)
      return [
        dt.toLocaleDateString('en-CA'),
        dt.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' }),
        sale.sale_number,
        `"${items.map(i => i.product_name).join(' | ').replace(/"/g, '""')}"`,
        items.reduce((s, i) => s + i.quantity, 0),
        fmtPayment(sale.payment_method),
        sale.total.toFixed(2),
        ...(isAdmin ? [profit.toFixed(2)] : []),
      ].join(',')
    })
    _downloadCsv(
      [headers.join(','), ...rows].join('\n'),
      `sales-report-${startDate}-to-${endDate}.csv`,
      BOM,
    )
    toast.success(`Exported ${sales.length} transactions`)
  }

  const handleExportRestocks = () => {
    if (!restocks.length) { toast.error('No restock data to export'); return }
    const BOM = '\uFEFF'
    const headers = [
      'Date', 'Product', 'Quantity', 'Cost/Unit (रु)',
      'Total Cost (रु)', 'Payment Type', 'Paid (रु)', 'Remaining (रु)', 'Supplier',
    ]
    const rows = restocks.map(r => [
      new Date(r.received_at).toLocaleDateString('en-CA'),
      `"${r.product_name.replace(/"/g, '""')}"`,
      r.quantity,
      r.cost_price.toFixed(2),
      r.total_amount.toFixed(2),
      r.payment_type,
      r.paid_amount.toFixed(2),
      r.remaining_amount.toFixed(2),
      r.supplier_name ?? '',
    ].join(','))
    _downloadCsv(
      [headers.join(','), ...rows].join('\n'),
      `restock-history-${startDate}-to-${endDate}.csv`,
      BOM,
    )
    toast.success(`Exported ${restocks.length} restock records`)
  }

  function _downloadCsv(content: string, filename: string, bom = '') {
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRESETS
  // ─────────────────────────────────────────────────────────────────────────
  const getPresets = () => {
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
  const PRESETS = getPresets()

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
          Sales history, profit analysis, and restock tracking
        </p>
      </div>

      {/* ── Tab switcher ────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-fit">
        {([
          { id: 'sales',    label: 'Sales',    icon: ShoppingBag, adminOnly: false },
          { id: 'restocks', label: 'Restocks', icon: Package,     adminOnly: true  },
        ] as { id: ReportTab; label: string; icon: React.ElementType; adminOnly: boolean }[])
          .filter(t => !t.adminOnly || isAdmin)
          .map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
      </div>

      {/* ── Date range + action bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label flex items-center gap-1">
            <Calendar className="w-3 h-3" /> From
          </label>
          <input type="date" className="input" value={startDate}
            onChange={e => { setStartDate(e.target.value); setSelectedPreset('') }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={endDate}
            onChange={e => { setEndDate(e.target.value); setSelectedPreset('') }} />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map(p => {
            const isActive = selectedPreset === p.label
            return (
              <button
                key={p.label}
                onClick={() => { setStartDate(p.start); setEndDate(p.end); setSelectedPreset(p.label) }}
                className={`text-xs px-3 py-2 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white border border-primary-600 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            )
          })}
          <button
            onClick={() => {
              if (activeTab === 'sales') {
                loadSales()
              } else if (activeTab === 'restocks') {
                loadRestocks()
              }
            }}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          {activeTab === 'sales' && (
            <button
              onClick={handleExportSales}
              disabled={!sales.length}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2
                disabled:opacity-40 disabled:cursor-not-allowed
                text-emerald-400 border-emerald-700/50 hover:bg-emerald-500/10"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
          {activeTab === 'restocks' && isAdmin && (
            <button
              onClick={handleExportRestocks}
              disabled={!restocks.length}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2
                disabled:opacity-40 disabled:cursor-not-allowed
                text-emerald-400 border-emerald-700/50 hover:bg-emerald-500/10"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SALES TAB
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sales' && (
        salesLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Loading report…" />
          </div>
        ) : (
          <>
            {/* ── Summary row 1: Revenue / Profit / Cost / Transactions ─── */}
            <div className={`grid grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'sm:grid-cols-2'} gap-3`}>
              {([
                {
                  label: 'Total Revenue', value: formatCurrency(totalRevenue),
                  icon: DollarSign, color: 'text-primary-400', bg: 'bg-primary-500/10',
                  adminOnly: false,
                },
                {
                  label: 'Total Profit', value: formatCurrency(totalProfit),
                  icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
                  adminOnly: true,
                },
                {
                  label: 'Total Cost (COGS)', value: formatCurrency(totalCost),
                  icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10',
                  adminOnly: true,
                },
                {
                  label: 'Transactions', value: sales.length,
                  icon: ShoppingBag, color: 'text-violet-400', bg: 'bg-violet-500/10',
                  sub: isAdmin ? `${margin.toFixed(1)}% margin` : undefined,
                  adminOnly: false,
                },
              ] as {
                label: string; value: string | number; icon: React.ElementType
                color: string; bg: string; sub?: string; adminOnly: boolean
              }[])
                .filter(c => !c.adminOnly || isAdmin)
                .map(s => (
                  <div key={s.label} className="card p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-slate-900 dark:text-white font-mono leading-none truncate">
                        {s.value}
                      </p>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">{s.label}</p>
                      {s.sub && <p className="text-xs text-slate-500">{s.sub}</p>}
                    </div>
                  </div>
                ))}
            </div>

            {/* ── Summary row 2: Cash | Online ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cash Collected */}
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-emerald-400 font-mono leading-none truncate">
                    {formatCurrency(paymentTotals.cash)}
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">Cash Collected</p>
                  <p className="text-xs text-slate-500 hidden sm:block">Includes split cash portions</p>
                </div>
              </div>
              {/* Online Collected */}
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Wifi className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-blue-400 font-mono leading-none truncate">
                    {formatCurrency(paymentTotals.online)}
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">Online Collected</p>
                  <p className="text-xs text-slate-500 hidden sm:block">eSewa, Khalti, bank transfer</p>
                </div>
              </div>
            </div>

            {/* ── Bar chart ────────────────────────────────────────────── */}
            {chartData.length > 0 && (
              <div className="card p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                  Daily Revenue{isAdmin ? ' & Profit' : ''}
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12 }}
                      formatter={(v: number, name: string) => [formatCurrency(v), name]}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    {isAdmin && (
                      <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Transactions table ───────────────────────────────────── */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-700/40 gap-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex-shrink-0">
                  Transactions{' '}
                  <span className="text-slate-500 text-sm font-normal">({filtered.length})</span>
                </h2>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-9 py-2 text-sm" placeholder="Search invoice…"
                    value={searchInvoice} onChange={e => setSearchInvoice(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">

                  {/* ─── Header
                      Columns (left → right):
                        1  Invoice       always
                        2  Date          hidden below sm
                        3  Products      hidden below md
                        4  Qty           hidden below sm
                        5  Payment       hidden below sm
                        6  Revenue       always
                        7  Profit        admin + always
                        8  Status        hidden below sm
                        9  Actions       always
                  ─── */}
                  <thead>
                    <tr className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-800/40">
                      <th className="text-left px-4 py-3 whitespace-nowrap">Invoice</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap hidden sm:table-cell">Date</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap hidden md:table-cell">Products</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap hidden sm:table-cell">Qty</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap hidden sm:table-cell">Payment</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap">Revenue</th>
                      {isAdmin && <th className="text-right px-4 py-3 whitespace-nowrap">Profit</th>}
                      <th className="text-left px-4 py-3 whitespace-nowrap hidden sm:table-cell">Status</th>
                      <th className="text-center px-4 py-3 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 9 : 8}
                          className="text-center py-14 text-slate-500 text-sm">
                          No transactions found
                        </td>
                      </tr>
                    ) : filtered.map(sale => {
                      const items      = sale.sale_items || []
                      const saleProfit = items.reduce(
                        (p, item) => p + (item.line_total - item.cost_price * item.quantity), 0,
                      )
                      const totalQty   = items.reduce((s, i) => s + i.quantity, 0)
                      const names      = items.map(i => i.product_name)
                      const label      = names.length <= 2
                        ? names.join(', ')
                        : `${names.slice(0, 2).join(', ')} (+${names.length - 2} more)`
                      const dt        = new Date(sale.created_at)
                      const dateStr   = formatDate(sale.created_at)
                      const timeStr   = dt.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })

                      return (
                        <tr key={sale.id}
                          className="border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-200 dark:hover:bg-slate-700/20 transition-colors">
                          {/* 1 Invoice */}
                          <td className="px-4 py-3 font-mono text-xs text-primary-400 whitespace-nowrap">
                            {sale.sale_number}
                          </td>
                          {/* 2 Date */}
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">
                            {dateStr} {timeStr}
                          </td>
                          {/* 3 Products */}
                          <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 max-w-[140px] truncate hidden md:table-cell">
                            {label || '—'}
                          </td>
                          {/* 4 Qty */}
                          <td className="px-4 py-3 text-right text-sm font-mono text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                            {totalQty}
                          </td>
                          {/* 5 Payment */}
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="badge bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs">
                              {fmtPayment(sale.payment_method)}
                            </span>
                          </td>
                          {/* 6 Revenue */}
                          <td className="px-4 py-3 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap text-sm">
                            {formatCurrency(sale.total)}
                          </td>
                          {/* 7 Profit */}
                          {isAdmin && (
                            <td className={`px-4 py-3 text-right font-bold font-mono whitespace-nowrap text-sm ${
                              saleProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {formatCurrency(saleProfit)}
                            </td>
                          )}
                          {/* 8 Status */}
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`badge text-xs capitalize ${
                              sale.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}>
                              {sale.status}
                            </span>
                          </td>
                          {/* 9 Actions */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedSale(sale)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => setDeleteTarget(sale)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  {/* ─── Footer
                      Every cell mirrors its header column with identical
                      responsive classes — this is what eliminates the
                      alignment shift bug on all screen sizes.
                  ─── */}
                  {filtered.length > 0 && (() => {
                    const fQty     = filtered.reduce(
                      (s, sale) => s + (sale.sale_items || []).reduce((q, i) => q + i.quantity, 0), 0,
                    )
                    const fRevenue = filtered.reduce((s, sale) => s + sale.total, 0)
                    const fProfit  = filtered.reduce((sum, sale) =>
                      sum + (sale.sale_items || []).reduce(
                        (p, item) => p + (item.line_total - item.cost_price * item.quantity), 0,
                      ), 0)
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/70 font-semibold">
                          {/* 1 — label */}
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            Totals{' '}
                            <span className="text-slate-500 font-normal hidden sm:inline">
                              ({filtered.length} transactions)
                            </span>
                          </td>
                          {/* 2 — date (blank) */}
                          <td className="px-4 py-3 hidden sm:table-cell" />
                          {/* 3 — products (blank) */}
                          <td className="px-4 py-3 hidden md:table-cell" />
                          {/* 4 — qty */}
                          <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white hidden sm:table-cell">
                            {fQty}
                          </td>
                          {/* 5 — payment (blank) */}
                          <td className="px-4 py-3 hidden sm:table-cell" />
                          {/* 6 — revenue */}
                          <td className="px-4 py-3 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(fRevenue)}
                          </td>
                          {/* 7 — profit */}
                          {isAdmin && (
                            <td className={`px-4 py-3 text-right font-bold font-mono whitespace-nowrap ${
                              fProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {formatCurrency(fProfit)}
                            </td>
                          )}
                          {/* 8 — status (blank) */}
                          <td className="px-4 py-3 hidden sm:table-cell" />
                          {/* 9 — actions (blank) */}
                          <td className="px-4 py-3" />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ══════════════════════════════════════════════════════════════════
          RESTOCKS TAB  (admin-only — tab is hidden for cashiers above)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'restocks' && (
        restocksLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Loading restock history…" />
          </div>
        ) : (
          <>
            {/* ── Restock summary cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                {
                  label: 'Units Restocked', value: restockTotals.qty, fmt: false,
                  icon: Package, color: 'text-primary-400', bg: 'bg-primary-500/10',
                },
                {
                  label: 'Total Inventory Cost', value: restockTotals.totalCost, fmt: true,
                  icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10',
                },
                {
                  label: 'Amount Paid', value: restockTotals.paid, fmt: true,
                  icon: Banknote, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
                },
                {
                  label: 'Outstanding Balance', value: restockTotals.outstanding, fmt: true,
                  icon: TrendingUp,
                  color: restockTotals.outstanding > 0 ? 'text-red-400' : 'text-emerald-400',
                  bg:    restockTotals.outstanding > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10',
                },
              ].map(s => (
                <div key={s.label} className="card p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-lg font-bold font-mono leading-none truncate ${s.color}`}>
                      {s.fmt ? formatCurrency(s.value as number) : s.value}
                    </p>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Restock history table ─────────────────────────────────── */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-700/40">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Restock History{' '}
                  <span className="text-slate-500 text-sm font-normal">({restocks.length} records)</span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">

                  {/* ─── Header
                      Cols: Date | Product | Qty | Cost/Unit(*) | Total Cost | Payment(*) | Paid(**) | Remaining(**) | Supplier(***) | Actions
                      (*) hidden below sm  (**) hidden below md  (***) hidden below lg
                  ─── */}
                  <thead>
                    <tr className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-800/40">
                      <th className="text-left  px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="text-left  px-4 py-3 whitespace-nowrap">Product</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap">Qty</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap hidden sm:table-cell">Cost/Unit</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap">Total Cost</th>
                      <th className="text-left  px-4 py-3 whitespace-nowrap hidden sm:table-cell">Payment</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap hidden md:table-cell">Paid</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap hidden md:table-cell">Remaining</th>
                      <th className="text-left  px-4 py-3 whitespace-nowrap hidden lg:table-cell">Supplier</th>
                      <th className="text-center px-4 py-3 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {restocks.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-14 text-slate-500 text-sm">
                          <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                          No restock records found for this period
                        </td>
                      </tr>
                    ) : restocks.map(r => (
                      <tr key={r.id}
                        className="border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-200 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(r.received_at)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 text-sm max-w-[160px] truncate">
                          {r.product_name}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white font-semibold">
                          {r.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 text-sm hidden sm:table-cell">
                          {r.cost_price > 0
                            ? formatCurrency(r.cost_price)
                            : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-amber-400 whitespace-nowrap">
                          {formatCurrency(r.total_amount)}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`badge text-xs capitalize ${restockBadgeCls(r.payment_type)}`}>
                            {r.payment_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400 text-sm whitespace-nowrap hidden md:table-cell">
                          {formatCurrency(r.paid_amount)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap hidden md:table-cell ${
                          r.remaining_amount > 0 ? 'text-red-400' : 'text-slate-600'
                        }`}>
                          {r.remaining_amount > 0 ? formatCurrency(r.remaining_amount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[120px] truncate hidden lg:table-cell">
                          {r.supplier_name ?? <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDeleteRestockTarget(r)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* ─── Restock footer — mirrors header exactly ─── */}
                  {restocks.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/70 font-semibold">
                        {/* Date — label */}
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          Totals{' '}
                          <span className="text-slate-500 font-normal hidden sm:inline">
                            ({restocks.length})
                          </span>
                        </td>
                        {/* Product — blank */}
                        <td className="px-4 py-3" />
                        {/* Qty */}
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                          {restockTotals.qty}
                        </td>
                        {/* Cost/Unit — blank */}
                        <td className="px-4 py-3 hidden sm:table-cell" />
                        {/* Total Cost */}
                        <td className="px-4 py-3 text-right font-bold font-mono text-amber-400 whitespace-nowrap">
                          {formatCurrency(restockTotals.totalCost)}
                        </td>
                        {/* Payment — blank */}
                        <td className="px-4 py-3 hidden sm:table-cell" />
                        {/* Paid */}
                        <td className="px-4 py-3 text-right font-bold font-mono text-emerald-400 whitespace-nowrap hidden md:table-cell">
                          {formatCurrency(restockTotals.paid)}
                        </td>
                        {/* Remaining */}
                        <td className={`px-4 py-3 text-right font-bold font-mono whitespace-nowrap hidden md:table-cell ${
                          restockTotals.outstanding > 0 ? 'text-red-400' : 'text-slate-600'
                        }`}>
                          {restockTotals.outstanding > 0
                            ? formatCurrency(restockTotals.outstanding) : '—'}
                        </td>
                        {/* Supplier — blank */}
                        <td className="px-4 py-3 hidden lg:table-cell" />
                        {/* Actions — blank */}
                        <td className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <SaleDetailModal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        sale={selectedSale}
      />

      {isAdmin && (
        <>
          <ConfirmDialog
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Delete Transaction"
            message={`Delete "${deleteTarget?.sale_number}"? Stock will be restored for all items. This cannot be undone.`}
            confirmLabel="Delete & Restore Stock"
            danger
            loading={deleting}
          />
          <ConfirmDialog
            isOpen={!!deleteRestockTarget}
            onClose={() => setDeleteRestockTarget(null)}
            onConfirm={handleDeleteRestock}
            title="Delete Restock"
            message={`Delete ${deleteRestockTarget?.product_name} restock? Inventory batch will be removed. This cannot be undone.`}
            confirmLabel="Delete & Restore Inventory"
            danger
            loading={deletingRestock}
          />
        </>
      )}
    </div>
  )
}
