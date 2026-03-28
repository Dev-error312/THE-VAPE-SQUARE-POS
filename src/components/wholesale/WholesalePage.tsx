import { useState, useEffect, useCallback, useMemo } from 'react'
import { wholesaleApi } from '../../lib/wholesaleApi'
import { productsApi } from '../../lib/productsApi'
import { useAuthStore } from '../../store/authStore'
import type { WholesaleSale, Product } from '../../types'
import { formatCurrency, formatDate } from '../../utils'
import { Plus, Trash2, TrendingUp, DollarSign, ShoppingBag, RefreshCw, Calendar } from 'lucide-react'
import Modal from '../shared/Modal'
import ConfirmDialog from '../shared/ConfirmDialog'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const PRESETS = [
  { label: 'Today', getRange: () => ({ s: today(), e: today() }) },
  { label: 'This Week', getRange: () => ({ s: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), e: today() }) },
  { label: 'This Month', getRange: () => ({ s: monthStart(), e: today() }) },
]

export default function WholesalePage() {
  const { user } = useAuthStore()
  const [sales, setSales] = useState<WholesaleSale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    product_id: '', product_name: '', quantity: '', cost_price: '',
    selling_price: '', buyer_name: '', notes: '', sale_date: today(),
  })

  const setF = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ws, prods] = await Promise.all([
        wholesaleApi.getAll(startDate, endDate),
        productsApi.getAll(),
      ])
      setSales(ws); setProducts(prods)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  // Auto-fill cost/selling price from selected product
  const handleProductSelect = (productId: string) => {
    const p = products.find(x => x.id === productId)
    setForm(f => ({
      ...f,
      product_id: productId,
      product_name: p?.name || '',
      cost_price: p?.avg_cost ? String(p.avg_cost) : f.cost_price,
      selling_price: p?.selling_price ? String(p.selling_price) : f.selling_price,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseFloat(form.quantity)
    const cost = parseFloat(form.cost_price) || 0
    const sell = parseFloat(form.selling_price)
    if (!form.product_name.trim()) { toast.error('Product name is required'); return }
    if (isNaN(qty) || qty <= 0) { toast.error('Quantity must be greater than 0'); return }
    if (isNaN(sell) || sell < 0) { toast.error('Selling price is required'); return }

    setSaving(true)
    try {
      const newSale = await wholesaleApi.create({
        product_id: form.product_id || null,
        product_name: form.product_name.trim(),
        quantity: qty, cost_price: cost, selling_price: sell,
        buyer_name: form.buyer_name.trim() || undefined,
        notes: form.notes.trim() || undefined,
        sale_date: form.sale_date,
        created_by: user?.id,
      })
      setSales(prev => [newSale, ...prev])
      toast.success('Wholesale sale recorded')
      setShowForm(false)
      setForm({ product_id: '', product_name: '', quantity: '', cost_price: '', selling_price: '', buyer_name: '', notes: '', sale_date: today() })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await wholesaleApi.delete(deleteTarget)
      setSales(prev => prev.filter(s => s.id !== deleteTarget))
      toast.success('Sale deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  const totals = useMemo(() => ({
    revenue: sales.reduce((s, r) => s + (r.total_amount || 0), 0),
    profit:  sales.reduce((s, r) => s + (r.profit || 0), 0),
    count:   sales.length,
  }), [sales])

  const previewQty   = parseFloat(form.quantity) || 0
  const previewCost  = parseFloat(form.cost_price) || 0
  const previewSell  = parseFloat(form.selling_price) || 0
  const previewTotal  = previewQty * previewSell
  const previewProfit = previewQty * (previewSell - previewCost)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Wholesale Sales</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track bulk / wholesale transactions</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Sale
        </button>
      </div>

      {/* Date filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => {
            const { s, e } = p.getRange()
            return (
              <button key={p.label} onClick={() => { setStartDate(s); setEndDate(e) }}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${startDate === s && endDate === e ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Revenue', value: formatCurrency(totals.revenue), icon: DollarSign, color: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: 'Profit', value: formatCurrency(totals.profit), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Transactions', value: totals.count, icon: ShoppingBag, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold font-mono leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner text="Loading..." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700/40 bg-slate-800/40">
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-right px-5 py-3">Qty</th>
                  <th className="text-right px-5 py-3">Cost/Unit</th>
                  <th className="text-right px-5 py-3">Sell/Unit</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Profit</th>
                  <th className="text-left px-5 py-3">Buyer</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-center px-5 py-3">Del</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-500 text-sm">No wholesale sales in this period</td></tr>
                ) : sales.map(s => (
                  <tr key={s.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-200 text-sm">{s.product_name}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">{s.quantity}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-400">{formatCurrency(s.cost_price)}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-400">{formatCurrency(s.selling_price)}</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-white">{formatCurrency(s.total_amount)}</td>
                    <td className={`px-5 py-3 text-right font-bold font-mono ${s.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(s.profit)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-400">{s.buyer_name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 whitespace-nowrap">{formatDate(s.sale_date)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => setDeleteTarget(s.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {sales.length > 0 && (
                <tfoot className="bg-slate-800/60 border-t-2 border-slate-600 font-bold">
                  <tr>
                    <td className="px-5 py-3 text-slate-200" colSpan={4}>TOTAL</td>
                    <td className="px-5 py-3 text-right font-mono text-white">{formatCurrency(totals.revenue)}</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-400">{formatCurrency(totals.profit)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* New Sale Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Record Wholesale Sale" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Product</label>
            <select className="input" value={form.product_id} onChange={e => handleProductSelect(e.target.value)}>
              <option value="">— Select from inventory (optional) —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Product Name *</label>
            <input className="input" value={form.product_name} onChange={e => setF('product_name', e.target.value)}
              placeholder="Product name" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Quantity *</label>
              <input className="input font-mono" type="number" step="0.01" min="0.01"
                value={form.quantity} onChange={e => setF('quantity', e.target.value)} placeholder="0" required />
            </div>
            <div>
              <label className="label">Cost Price (रु)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
                <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
                  value={form.cost_price} onChange={e => setF('cost_price', e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label">Selling Price (रु) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
                <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
                  value={form.selling_price} onChange={e => setF('selling_price', e.target.value)} placeholder="0" required />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Buyer Name</label>
              <input className="input" value={form.buyer_name} onChange={e => setF('buyer_name', e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Sale Date</label>
              <input className="input" type="date" value={form.sale_date} onChange={e => setF('sale_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Optional" />
          </div>

          {/* Live preview */}
          {previewQty > 0 && previewSell > 0 && (
            <div className="bg-slate-700/40 rounded-xl p-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Total Amount</p>
                <p className="text-sm font-bold text-white font-mono">{formatCurrency(previewTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Profit</p>
                <p className={`text-sm font-bold font-mono ${previewProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(previewProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Margin</p>
                <p className={`text-sm font-bold ${previewSell > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {previewSell > 0 ? `${(((previewSell - previewCost) / previewSell) * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Record Sale'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Sale" message="Delete this wholesale sale? This cannot be undone."
        confirmLabel="Delete" danger loading={deleting} />
    </div>
  )
}
