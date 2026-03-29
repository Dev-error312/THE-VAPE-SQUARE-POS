import { useEffect, useState, useCallback } from 'react'
import { salesApi } from '../../lib/salesApi'
import { useRefreshStore } from '../../store/refreshStore'
import { useIsAdmin } from '../../hooks/useRole'
import { formatCurrency, formatDate } from '../../utils'
import type { Sale } from '../../types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Calendar, Search, TrendingUp, ShoppingBag, DollarSign, BarChart2, Eye, RefreshCw, Trash2, Download } from 'lucide-react'
import SaleDetailModal from './SaleDetailModal'
import ConfirmDialog from '../shared/ConfirmDialog'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

export default function ReportsPage() {
  const today      = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [startDate, setStartDate]     = useState(monthStart)
  const [endDate, setEndDate]         = useState(today)
  const [sales, setSales]             = useState<Sale[]>([])
  const [chartData, setChartData]     = useState<{ date: string; revenue: number; profit: number }[]>([])
  const [loading, setLoading]         = useState(true)
  const [searchInvoice, setSearchInvoice] = useState('')
  const [selectedSale, setSelectedSale]   = useState<Sale | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<Sale | null>(null)
  const [deleting, setDeleting]           = useState(false)

  const triggerSales = useRefreshStore(s => s.triggerSales)
  const salesVersion = useRefreshStore(s => s.salesVersion)
  const isAdmin      = useIsAdmin()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0)
      const end   = new Date(endDate);   end.setHours(23, 59, 59, 999)
      const [salesData, reportData] = await Promise.all([
        salesApi.getAll({ startDate: start.toISOString(), endDate: end.toISOString() }),
        salesApi.getSalesReport(start.toISOString(), end.toISOString()),
      ])
      setSales(salesData)
      setChartData(reportData.map(r => ({ date: formatDate(r.date), revenue: r.revenue, profit: r.profit })))
    } catch (e) {
      console.error('Reports load error:', e)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load, salesVersion])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await salesApi.deleteSale(deleteTarget.id)
      toast.success('Transaction deleted and stock restored')
      setDeleteTarget(null)
      setSales(prev => prev.filter(s => s.id !== deleteTarget.id))
      triggerSales()
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete transaction')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = sales.filter(s =>
    !searchInvoice || s.sale_number.toLowerCase().includes(searchInvoice.toLowerCase())
  )

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0)
  const totalProfit  = sales.reduce((sum, sale) =>
    sum + (sale.sale_items || []).reduce((p, item) =>
      p + (item.line_total - item.cost_price * item.quantity), 0), 0)
  const totalCost = totalRevenue - totalProfit
  const margin    = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const paymentLabel = (m: string) =>
    m === 'cash' ? 'Cash' : m === 'online' ? 'Online' : m === 'split' ? 'Split' : m

  const handleExport = () => {
    if (sales.length === 0) { toast.error('No data to export'); return }
    const BOM = '\uFEFF'
    const detailHeaders = isAdmin
      ? ['Date', 'Time', 'Invoice', 'Products', 'Qty', 'Payment Method', 'Revenue (रु)', 'Profit (रु)']
      : ['Date', 'Time', 'Invoice', 'Products', 'Qty', 'Payment Method', 'Revenue (रु)']
    const detailRows = sales.flatMap(sale => {
      const items      = sale.sale_items || []
      const saleProfit = items.reduce((p, item) => p + (item.line_total - item.cost_price * item.quantity), 0)
      const productNames = items.map(i => i.product_name).join(' | ')
      const totalQty     = items.reduce((s, i) => s + i.quantity, 0)
      const dt = new Date(sale.created_at)
      const row = [
        dt.toLocaleDateString('en-CA'),
        dt.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' }),
        sale.sale_number,
        `"${productNames.replace(/"/g, '""')}"`,
        totalQty,
        paymentLabel(sale.payment_method),
        sale.total.toFixed(2),
        ...(isAdmin ? [saleProfit.toFixed(2)] : []),
      ]
      return [row.join(',')]
    })
    const lines = [
      `The Vape Square — Sales Report`,
      `Period: ${startDate} to ${endDate}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '--- TRANSACTION DETAILS ---',
      detailHeaders.join(','),
      ...detailRows,
    ]
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `sales-report-${startDate}-to-${endDate}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Report exported — ${sales.length} transactions`)
  }

  const PRESETS = [
    { label: 'Today',      start: today,      end: today },
    { label: 'This Week',  start: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), end: today },
    { label: 'This Month', start: monthStart, end: today },
  ]

  // Summary cards — admin sees revenue + profit + COGS; cashier sees revenue + count only
  const summaryCards = [
    { label: 'Total Revenue',   value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-primary-400', bg: 'bg-primary-500/10', adminOnly: false },
    { label: 'Total Profit',    value: formatCurrency(totalProfit),  icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', adminOnly: true },
    { label: 'Total Cost',      value: formatCurrency(totalCost),    icon: BarChart2,  color: 'text-amber-400',   bg: 'bg-amber-500/10',   adminOnly: true },
    { label: 'Transactions',    value: sales.length, icon: ShoppingBag, color: 'text-violet-400', bg: 'bg-violet-500/10',
      sub: isAdmin ? `${margin.toFixed(1)}% margin` : undefined, adminOnly: false },
  ].filter(c => !c.adminOnly || isAdmin)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-slate-400 text-sm mt-0.5">Sales history and analysis</p>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
          <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label}
              onClick={() => { setStartDate(p.start); setEndDate(p.end) }}
              className={`btn-secondary text-xs px-3 py-2 ${startDate === p.start && endDate === p.end ? 'bg-primary-700 text-white border-primary-600' : ''}`}>
              {p.label}
            </button>
          ))}
          <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={sales.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-400 border-emerald-700/50 hover:bg-emerald-500/10">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><LoadingSpinner text="Loading report..." /></div>
      ) : (
        <>
          {/* Summary */}
          <div className={`grid grid-cols-2 ${summaryCards.length === 4 ? 'xl:grid-cols-4' : 'sm:grid-cols-2'} gap-4`}>
            {summaryCards.map(s => (
              <div key={s.label} className="card p-4 flex items-center gap-3">
                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white font-mono leading-none">{s.value}</p>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">{s.label}</p>
                  {s.sub && <p className="text-xs text-slate-500">{s.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Bar Chart */}
          {chartData.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-white mb-4">Daily Revenue{isAdmin ? ' & Profit' : ''}</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12 }}
                    formatter={(v: number, name: string) => [formatCurrency(v), name]}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[4,4,0,0]} />
                  {isAdmin && <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4,4,0,0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Transactions Table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-700/40 gap-3">
              <h2 className="text-base font-semibold text-white flex-shrink-0">
                Transactions <span className="text-slate-500 text-sm font-normal">({filtered.length})</span>
              </h2>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="input pl-9 py-2 text-sm" placeholder="Search invoice..."
                  value={searchInvoice} onChange={e => setSearchInvoice(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700/40 bg-slate-800/40">
                    <th className="text-left px-4 py-3">Invoice</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Date</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Products</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Qty</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Payment</th>
                    <th className="text-right px-4 py-3">Revenue</th>
                    {isAdmin && <th className="text-right px-4 py-3">Profit</th>}
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Status</th>
                    <th className="text-center px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-14 text-slate-500 text-sm">No transactions found</td></tr>
                  ) : filtered.map(sale => {
                    const items      = sale.sale_items || []
                    const saleProfit = items.reduce((p, item) =>
                      p + (item.line_total - item.cost_price * item.quantity), 0)
                    const totalQty   = items.reduce((s, i) => s + i.quantity, 0)
                    const MAX        = 2
                    const names      = items.map(i => i.product_name)
                    const productLabel = names.length <= MAX
                      ? names.join(', ')
                      : `${names.slice(0, MAX).join(', ')} (+${names.length - MAX} more)`
                    const dt       = new Date(sale.created_at)
                    const dateStr  = formatDate(sale.created_at)
                    const timeStr  = dt.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <tr key={sale.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-primary-400 whitespace-nowrap">{sale.sale_number}</td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap hidden sm:table-cell">{dateStr} {timeStr}</td>
                        <td className="px-4 py-3 text-xs text-slate-300 max-w-[140px] truncate hidden md:table-cell">{productLabel || '—'}</td>
                        <td className="px-4 py-3 text-right text-sm font-mono text-slate-300 hidden sm:table-cell">{totalQty}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="badge bg-slate-700 text-slate-300 text-xs">{paymentLabel(sale.payment_method)}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-white whitespace-nowrap text-sm">{formatCurrency(sale.total)}</td>
                        {isAdmin && (
                          <td className={`px-4 py-3 text-right font-bold font-mono whitespace-nowrap text-sm ${saleProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(saleProfit)}
                          </td>
                        )}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`badge text-xs capitalize ${sale.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setSelectedSale(sale)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all">
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => setDeleteTarget(sale)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {filtered.length > 0 && (() => {
                  const totalQty        = filtered.reduce((s, sale) => s + (sale.sale_items || []).reduce((q, i) => q + i.quantity, 0), 0)
                  const filteredRevenue = filtered.reduce((s, sale) => s + sale.total, 0)
                  const filteredProfit  = filtered.reduce((sum, sale) =>
                    sum + (sale.sale_items || []).reduce((p, item) =>
                      p + (item.line_total - item.cost_price * item.quantity), 0), 0)
                  return (
                    <tfoot>
                      <tr className="border-t-2 border-slate-600 bg-slate-800/70 font-semibold">
                        <td colSpan={isAdmin ? 4 : 4} className="px-4 py-3 text-sm text-slate-300">
                          Totals
                          <span className="text-slate-500 font-normal ml-1">({filtered.length} transactions)</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-white hidden sm:table-cell">{totalQty}</td>
                        <td className="px-4 py-3 hidden sm:table-cell" />
                        <td className="px-4 py-3 text-right font-bold font-mono text-white">{formatCurrency(filteredRevenue)}</td>
                        {isAdmin && (
                          <td className={`px-4 py-3 text-right font-bold font-mono ${filteredProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(filteredProfit)}
                          </td>
                        )}
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )
                })()}
              </table>
            </div>
          </div>
        </>
      )}

      <SaleDetailModal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} sale={selectedSale} />

      {isAdmin && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Transaction"
          message={`Delete "${deleteTarget?.sale_number}"? This will restore stock for all items. This cannot be undone.`}
          confirmLabel="Delete & Restore Stock"
          danger
          loading={deleting}
        />
      )}
    </div>
  )
}
