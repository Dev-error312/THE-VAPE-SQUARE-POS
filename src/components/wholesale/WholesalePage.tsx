import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsAdmin } from '../../hooks/useRole'
import { formatCurrency, formatDate } from '../../utils'
import { productsApi } from '../../lib/productsApi'
import type { Product } from '../../types'
import {
  Plus, Search, RefreshCw, Eye, Trash2, Store,
  DollarSign, ShoppingBag, TrendingUp, Package, X, Calendar,
} from 'lucide-react'
import LoadingSpinner from '../shared/LoadingSpinner'
import ConfirmDialog from '../shared/ConfirmDialog'
import Modal from '../shared/Modal'
import toast from 'react-hot-toast'
import { validateRequired, validatePrice, validateQuantity, runValidations } from '../../utils/validation'

// ─── Types ─────────────────────────────────────────────────────────────────
interface WholesaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number   // the wholesale selling price per unit
  cost_price: number   // only loaded for admin
  line_total: number
}

interface WholesaleSale {
  id: string
  sale_number: string
  customer_name: string
  customer_phone: string | null
  items: WholesaleItem[]
  subtotal: number
  discount_amount: number
  total: number
  payment_method: 'cash' | 'online' | 'credit' | 'split'
  status: 'completed' | 'pending' | 'cancelled'
  notes: string | null
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const paymentBadge = (method: string) => {
  const map: Record<string, string> = {
    cash:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    online: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    credit: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    split:  'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  }
  return map[method] ?? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
}

const statusBadge = (s: string) =>
  s === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
  : s === 'pending' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
  : 'bg-red-500/15 text-red-400 border border-red-500/30'

// ─── Component ─────────────────────────────────────────────────────────────
export default function WholesalePage() {
  const isAdmin = useIsAdmin()

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [sales,    setSales]    = useState<WholesaleSale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [selectedPreset, setSelectedPreset] = useState<string>('Today')

  const [showForm,    setShowForm]    = useState(false)
  const [viewSale,    setViewSale]    = useState<WholesaleSale | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WholesaleSale | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving,   setSaving]   = useState(false)

  // ── Form state ────────────────────────────────────────────────────────
  const emptyForm = {
    customer_name:   '',
    customer_phone:  '',
    payment_method:  'cash' as WholesaleSale['payment_method'],
    notes:           '',
    discount_amount: 0,
  }
  const [form, setForm] = useState(emptyForm)
  const [cartItems, setCartItems] = useState<{
    product_id: string; product_name: string; quantity: number; unit_price: number
  }[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  // ── Load ──────────────────────────────────────────────────────────────
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const startDateTime = new Date(startDate)
      startDateTime.setHours(0, 0, 0, 0)
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)

      const [salesRes, prodsRes] = await Promise.all([
        supabase
          .from('wholesale_sales')
          .select('*')
          .gte('created_at', startDateTime.toISOString())
          .lte('created_at', endDateTime.toISOString())
          .order('created_at', { ascending: false }),
        productsApi.getAll(),
      ])
      if (salesRes.error) throw salesRes.error
      setSales(
        (salesRes.data || []).map((sale: any) => ({
          ...sale,
          items: Array.isArray(sale.items) ? sale.items : [],
        }))
      )
      setProducts(prodsRes)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load wholesale data')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  // ── Date-filtered sales ─────────────────────────────────────────────────
  const filteredByDate = useMemo(() => {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0)
    const end = new Date(endDate); end.setHours(23, 59, 59, 999)
    return sales.filter(s => {
      const saleDate = new Date(s.created_at)
      return saleDate >= start && saleDate <= end && s.status === 'completed'
    })
  }, [sales, startDate, endDate])

  const totalRevenue = useMemo(() => filteredByDate.reduce((s, r) => s + r.total, 0), [filteredByDate])
  const totalProfit  = useMemo(() =>
    filteredByDate.reduce((sum, sale) =>
      sum + (sale.items || []).reduce(
        (p, item) => p + (item.unit_price - (item.cost_price ?? 0)) * item.quantity, 0,
      ), 0,
    ), [filteredByDate])

  // ── Search ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return sales.filter(s =>
      !q ||
      s.customer_name.toLowerCase().includes(q) ||
      s.sale_number.toLowerCase().includes(q),
    )
  }, [sales, search])

  // ── Cart helpers ──────────────────────────────────────────────────────
  const addToCart = () => {
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return
    if (cartItems.find(i => i.product_id === product.id)) {
      toast.error('Product already in list. Adjust the quantity instead.')
      return
    }
    setCartItems(prev => [...prev, {
      product_id:   product.id,
      product_name: product.name,
      quantity:     1,
      unit_price:   product.selling_price,
    }])
    setSelectedProductId('')
  }

  const updateCartItem = (id: string, field: 'quantity' | 'unit_price', value: number) => {
    setCartItems(prev =>
      prev.map(i => i.product_id === id ? { ...i, [field]: value } : i),
    )
  }

  const removeCartItem = (id: string) => {
    setCartItems(prev => prev.filter(i => i.product_id !== id))
  }

  const cartSubtotal = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const cartTotal    = Math.max(0, cartSubtotal - form.discount_amount)

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = runValidations(validateRequired(form.customer_name, 'Customer name'))
    if (err) { toast.error(err); return }
    if (cartItems.length === 0) { toast.error('Add at least one product'); return }
    for (const item of cartItems) {
      const qErr = validateQuantity(item.quantity, item.product_name)
      if (qErr) { toast.error(qErr.error); return }
      const pErr = validatePrice(item.unit_price, 'Unit price')
      if (pErr) { toast.error(pErr.error); return }
    }

    setSaving(true)
    try {
      const saleNumber = `WS-${Date.now()}`
      const payload = {
        sale_number:    saleNumber,
        customer_name:  form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        items: cartItems.map(i => {
          const product = products.find(p => p.id === i.product_id)
          return {
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            cost_price: product?.avg_cost ?? 0,
            line_total: i.unit_price * i.quantity,
          }
        }),
        subtotal:        cartSubtotal,
        discount_amount: form.discount_amount,
        total:           cartTotal,
        payment_method:  form.payment_method,
        status:          'completed',
        notes:           form.notes.trim() || null,
      }
      const { error } = await supabase.from('wholesale_sales').insert(payload)
      if (error) throw error
      toast.success('Wholesale sale recorded')
      setShowForm(false)
      setForm(emptyForm)
      setCartItems([])
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save sale')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('wholesale_sales').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Sale deleted')
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    } finally { setDeleting(false) }
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Heading */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wholesale</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Bulk sales management</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Sale</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Summary cards
          Admin: Revenue, Profit, Transaction count
          Cashier: Revenue only (no profit — sensitive data)           */}
      <div className={`grid gap-3 ${isAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-primary-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white font-mono truncate">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Period Revenue</p>
          </div>
        </div>

        {/* Profit — admin only */}
        {isAdmin && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-emerald-400 font-mono truncate">
                {formatCurrency(totalProfit)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Period Profit</p>
            </div>
          </div>
        )}

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white font-mono truncate">
              {filteredByDate.length}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Period Transactions</p>
          </div>
        </div>
      </div>

      {/* Date range + action bar */}
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
          {getPresets().map(p => {
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
            onClick={load}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-400" />
          <input className="input pl-9" placeholder="Search customer or invoice…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Loading wholesale sales…" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-800/40">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Invoice</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Customer</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap hidden sm:table-cell">Items</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap hidden sm:table-cell">Payment</th>
                  {/* Profit column — admin only */}
                  {isAdmin && (
                    <th className="text-right px-4 py-3 whitespace-nowrap hidden md:table-cell">Profit</th>
                  )}
                  <th className="text-right px-4 py-3 whitespace-nowrap">Total</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap hidden sm:table-cell">Status</th>
                  <th className="text-center px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8}
                      className="text-center py-14 text-slate-500 text-sm">
                      <Store className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      {search ? 'No sales match your search' : 'No wholesale sales yet'}
                    </td>
                  </tr>
                ) : filtered.map(sale => {
                  const items = sale.items || []
                  const profit = items.reduce(
                    (p, item) => p + (item.unit_price - (item.cost_price ?? 0)) * item.quantity, 0,
                  )
                  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
                  return (
                    <tr key={sale.id}
                      className="border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-200 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary-400 whitespace-nowrap">
                        {sale.sale_number}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[180px]">
                          {sale.customer_name || 'Walk-in Customer'}
                        </p>
                        {sale.customer_phone && (
                          <p className="text-xs text-slate-500 truncate">{sale.customer_phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                        {totalQty}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`badge text-xs capitalize ${paymentBadge(sale.payment_method)}`}>
                          {sale.payment_method}
                        </span>
                      </td>
                      {/* Profit — admin only */}
                      {isAdmin && (
                        <td className={`px-4 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap hidden md:table-cell ${
                          profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(profit)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap text-sm break-all">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`badge text-xs capitalize ${statusBadge(sale.status)}`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewSale(sale)}
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
            </table>
          </div>
        )}
      </div>

      {/* ── New Sale Form Modal ─────────────────────────────────────────── */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setForm(emptyForm); setCartItems([]) }}
        title="New Wholesale Sale" size="xl">
        <div className="space-y-5">
          {/* Customer info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Customer Name *</label>
              <input className="input" placeholder="Business / person name"
                value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" placeholder="98XXXXXXXX"
                value={form.customer_phone}
                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
            </div>
          </div>

          {/* Product picker */}
          <div>
            <label className="label">Add Products</label>
            <div className="flex gap-2">
              <select className="input flex-1"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}>
                <option value="">Select product…</option>
                {products.filter(p => (p.total_stock || 0) > 0).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.total_stock} {p.unit})
                  </option>
                ))}
              </select>
              <button onClick={addToCart} disabled={!selectedProductId}
                className="btn-secondary flex items-center gap-2 flex-shrink-0 disabled:opacity-40">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {/* Cart items */}
          {cartItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-3 py-2">Product</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Unit Price</th>
                      <th className="text-right px-3 py-2">Subtotal</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map(item => (
                      <tr key={item.product_id} className="border-b border-slate-200 dark:border-slate-700/40">
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                          {item.product_name}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="1" className="input py-1 w-16 text-right text-sm"
                            value={item.quantity}
                            onChange={e => updateCartItem(item.product_id, 'quantity', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="1" className="input py-1 w-24 text-right text-sm font-mono"
                            value={item.unit_price}
                            onChange={e => updateCartItem(item.product_id, 'unit_price', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeCartItem(item.product_id)}
                            className="text-slate-500 hover:text-red-400 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment + totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Payment Method</label>
              <select className="input"
                value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as WholesaleSale['payment_method'] }))}>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="credit">Credit (Pay Later)</option>
                <option value="split">Split</option>
              </select>
            </div>
            <div>
              <label className="label">Discount (रु)</label>
              <input type="number" min="0" step="1" className="input text-right font-mono"
                value={form.discount_amount}
                onChange={e => setForm(f => ({ ...f, discount_amount: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} placeholder="Any remarks…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Total summary */}
          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(cartSubtotal)}</span>
            </div>
            {form.discount_amount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Discount</span>
                <span className="font-mono">−{formatCurrency(form.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base pt-2 border-t border-slate-200 dark:border-slate-700">
              <span>Total</span>
              <span className="font-mono text-primary-400">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowForm(false); setForm(emptyForm); setCartItems([]) }}
              className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Record Sale'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── View Sale Modal ─────────────────────────────────────────────── */}
      {viewSale && (
        <Modal isOpen={!!viewSale} onClose={() => setViewSale(null)}
          title={`${viewSale.sale_number} — ${viewSale.customer_name}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">Customer</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{viewSale.customer_name}</p>
                {viewSale.customer_phone && (
                  <p className="text-xs text-slate-500 mt-0.5">{viewSale.customer_phone}</p>
                )}
              </div>
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">Date</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{formatDate(viewSale.created_at)}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">
                  Payment: {viewSale.payment_method}
                </p>
              </div>
            </div>

            {/* Items table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    {/* Cost price — admin only */}
                    {isAdmin && <th className="text-right px-3 py-2">Cost</th>}
                    <th className="text-right px-3 py-2">Unit Price</th>
                    {/* Profit — admin only */}
                    {isAdmin && <th className="text-right px-3 py-2">Profit</th>}
                    <th className="text-right px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewSale.items || []).map((item, i) => {
                    const itemProfit = (item.unit_price - (item.cost_price ?? 0)) * item.quantity
                    return (
                      <tr key={i} className="border-b border-slate-200 dark:border-slate-700/40">
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200 max-w-[140px] truncate">
                          {item.product_name}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {item.quantity}
                        </td>
                        {/* Cost — admin only */}
                        {isAdmin && (
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatCurrency(item.cost_price)}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(item.unit_price)}
                        </td>
                        {/* Profit — admin only */}
                        {isAdmin && (
                          <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${
                            itemProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {formatCurrency(itemProfit)}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Sale totals */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(viewSale.subtotal)}</span>
              </div>
              {viewSale.discount_amount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Discount</span>
                  <span className="font-mono">−{formatCurrency(viewSale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 dark:text-white text-base pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Total</span>
                <span className="font-mono text-primary-400">{formatCurrency(viewSale.total)}</span>
              </div>
              {/* Profit summary — admin only */}
              {isAdmin && (() => {
                const totalP = (viewSale.items || []).reduce(
                  (p, item) => p + (item.unit_price - (item.cost_price ?? 0)) * item.quantity, 0,
                )
                return (
                  <div className={`flex justify-between font-semibold ${
                    totalP >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <span>Profit</span>
                    <span className="font-mono">{formatCurrency(totalP)}</span>
                  </div>
                )
              })()}
            </div>

            {viewSale.notes && (
              <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Notes: </span>
                {viewSale.notes}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete confirm — admin only */}
      {isAdmin && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Wholesale Sale"
          message={`Delete sale "${deleteTarget?.sale_number}" for ${deleteTarget?.customer_name}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
        />
      )}
    </div>
  )
}
