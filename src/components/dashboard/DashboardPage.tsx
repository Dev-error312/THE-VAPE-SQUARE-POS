import { useEffect, useState, useCallback } from 'react'
import { salesApi } from '../../lib/salesApi'
import { productsApi } from '../../lib/productsApi'
import { useRefreshStore } from '../../store/refreshStore'
import { useIsAdmin } from '../../hooks/useRole'
import { formatCurrency, formatDate } from '../../utils'
import { TrendingUp, ShoppingCart, Package, AlertTriangle, DollarSign, BarChart2, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { DashboardStats, Sale, Product } from '../../types'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [chartData, setChartData] = useState<{ date: string; revenue: number; profit: number }[]>([])
  const [loading, setLoading] = useState(true)

  const salesVersion = useRefreshStore(s => s.salesVersion)
  const isAdmin = useIsAdmin()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const end   = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)

      const [statsData, salesData, productsData, reportData] = await Promise.all([
        salesApi.getDashboardStats(),
        salesApi.getAll({ limit: 10 }),
        productsApi.getAll(),
        salesApi.getSalesReport(start.toISOString(), end.toISOString()),
      ])

      setStats(statsData)
      setRecentSales(salesData)
      setLowStock(productsData.filter(p => (p.total_stock || 0) < 10))

      const filled = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        const found = reportData.find(r => r.date === dateStr)
        filled.push({
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: found?.revenue || 0,
          profit:  found?.profit  || 0,
        })
      }
      setChartData(filled)
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, salesVersion])

  const paymentLabel = (method: string) => {
    if (method === 'cash')   return 'Cash'
    if (method === 'online') return 'Online'
    if (method === 'split')  return 'Split'
    return method
  }

  const summariseItems = (sale: Sale) => {
    const items = sale.sale_items || []
    if (items.length === 0) return { label: '—', qty: 0 }
    const totalQty = items.reduce((s, i) => s + i.quantity, 0)
    const names    = items.map(i => i.product_name)
    const MAX_SHOW = 2
    const label    = names.length <= MAX_SHOW
      ? names.join(', ')
      : `${names.slice(0, MAX_SHOW).join(', ')} (+${names.length - MAX_SHOW} more)`
    return { label, qty: totalQty }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner size="lg" text="Loading dashboard..." />
    </div>
  )

  // Admin sees all 4 cards; cashier sees revenue + product count only
  const statCards = [
    { label: "Today's Revenue",  value: formatCurrency(stats?.today_revenue  || 0), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', sub: `${stats?.today_sales || 0} sales today`,    adminOnly: false },
    { label: "Today's Profit",   value: formatCurrency(stats?.today_profit   || 0), icon: TrendingUp, color: 'text-primary-400', bg: 'bg-primary-500/10', sub: 'Actual selling − cost',                      adminOnly: true  },
    { label: 'Monthly Revenue',  value: formatCurrency(stats?.monthly_revenue || 0), icon: BarChart2,  color: 'text-violet-400',  bg: 'bg-violet-500/10',  sub: `${stats?.monthly_sales || 0} sales this month`, adminOnly: false },
    { label: 'Total Products',   value: stats?.total_products || 0,                  icon: Package,    color: 'text-amber-400',   bg: 'bg-amber-500/10',   sub: `${stats?.low_stock_count || 0} low stock alerts`, adminOnly: false },
  ].filter(c => !c.adminOnly || isAdmin)

  const stockCards = [
    { label: 'Stock Value (Cost)',    value: formatCurrency(stats?.total_stock_value       || 0), icon: Package,    color: 'text-slate-700 dark:text-slate-300',   bg: 'bg-slate-500/10',   sub: 'Current inventory at cost' },
    { label: 'Potential Revenue',     value: formatCurrency(stats?.potential_selling_value || 0), icon: TrendingUp, color: 'text-blue-400',    bg: 'bg-blue-500/10',    sub: 'If all stock is sold' },
    { label: 'Potential Profit',      value: formatCurrency(stats?.potential_profit        || 0), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', sub: 'Revenue − cost of stock' },
  ]

  return (
    <div className="p-4 sm:p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Dashboard</h1>
          <p className="section-subtitle mt-1">Real-time business performance</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm px-3 py-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Sales Stats Cards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-4">Key Metrics</h3>
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {statCards.map(card => (
            <div key={card.label} className="stat-card group hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-800">
              <div className={`w-11 h-11 sm:w-12 sm:h-12 ${card.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <card.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
              </div>
              <p className="stat-label text-slate-500 dark:text-slate-500">{card.label}</p>
              <p className="stat-value">{card.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Valuation — admin only */}
      {isAdmin && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-4">Inventory Health</h3>
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
            {stockCards.map(card => (
              <div key={card.label} className="stat-card group hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-800">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 ${card.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <card.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
                </div>
                <p className="stat-label">{card.label}</p>
                <p className={`stat-value ${card.color}`}>{card.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="card-premium lg:col-span-2 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Revenue & Profit Trend</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Last 7 days performance</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#f1f5f9', marginBottom: 4, fontWeight: 600 }}
                formatter={(v: number, name: string) => [formatCurrency(v), name]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={2.5} fill="url(#gRevenue)" name="Revenue" dot={{ fill: '#a855f7', r: 4 }} />
              {isAdmin && (
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#gProfit)" name="Profit" dot={{ fill: '#10b981', r: 4 }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-premium p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Low Stock</h2>
            {lowStock.length > 0 && (
              <span className="ml-auto badge-warning">{lowStock.length} items</span>
            )}
          </div>
          {lowStock.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">All products well stocked</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-56">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-100/50 dark:bg-slate-800/30 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{p.name}</p>
                    {p.brand && <p className="text-xs text-slate-500 truncate">{p.brand}</p>}
                  </div>
                  <span className={`badge ml-3 flex-shrink-0 font-medium ${(p.total_stock || 0) === 0
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                    {p.total_stock || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card-premium overflow-hidden">
        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Sales</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30">
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4">Invoice</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Date</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4">Products</th>
                <th className="text-right px-4 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Qty</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Payment</th>
                <th className="text-right px-4 sm:px-6 py-3 sm:py-4">Total</th>
                <th className="text-left px-4 sm:px-6 py-3 sm:py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(recentSales.filter(s => (s.sale_items || []).length > 0)).length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">No sales yet</td></tr>
              ) : recentSales
                  .filter(s => (s.sale_items || []).length > 0)
                  .map(sale => {
                const { label, qty } = summariseItems(sale)
                return (
                  <tr key={sale.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 font-mono text-xs font-bold text-primary-600 dark:text-primary-400 whitespace-nowrap">{sale.sale_number}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">{formatDate(sale.created_at)}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[120px] sm:max-w-[200px] truncate">{label}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-sm font-mono font-semibold text-slate-700 dark:text-slate-300 hidden sm:table-cell">{qty}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                      <span className="badge badge-primary text-xs font-medium">{paymentLabel(sale.payment_method)}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(sale.total)}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span className={`badge text-xs font-medium capitalize ${sale.status === 'completed'
                        ? 'badge-success'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
