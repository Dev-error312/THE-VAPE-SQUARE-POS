import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsAdmin } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'
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
import { validateRequired } from '../../utils/validation'

// ─── Types ─────────────────────────────────────────────────────────────────
interface WholesaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price: number
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
  sale_date: string
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
  : s === 'pending'  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
  : 'bg-red-500/15 text-red-400 border border-red-500/30'

const calcSaleProfit = (items: WholesaleItem[]) =>
  (items || []).reduce(
    (sum, item) => sum + (item.unit_price - (item.cost_price ?? 0)) * item.quantity,
    0,
  )

// ─── Component ─────────────────────────────────────────────────────────────
export default function WholesalePage() {
  const isAdmin = useIsAdmin()
  const today   = new Date().toISOString().slice(0, 10)

  const [sales,    setSales]    = useState<WholesaleSale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState(today)
  const [selectedPreset, setSelectedPreset] = useState<string>('Today')

  const [showForm,     setShowForm]     = useState(false)
  const [viewSale,     setViewSale]     = useState<WholesaleSale | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WholesaleSale | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving,   setSaving]   = useState(false)

  // ── Form state ────────────────────────────────────────────────────────
  const emptyForm = {
    customer_name:  '',
    customer_phone: '',
    payment_method: 'cash' as WholesaleSale['payment_method'],
    notes:          '',
  }
  const [form, setForm] = useState(emptyForm)
  const [cartItems, setCartItems] = useState<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    cost_price: number
  }[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  // ── Presets ───────────────────────────────────────────────────────────
  const getPresets = () => {
    const now           = new Date()
    const todayStr      = now.toISOString().slice(0, 10)
    const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const monthEndStr   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    const weekStart     = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
    return [
      { label: 'Today',      start: todayStr,      end: todayStr      },
      { label: 'This Week',  start: weekStart,     end: todayStr      },
      { label: 'This Month', start: monthStartStr, end: monthEndStr   },
    ]
  }

  // ── Load — queries directly, avoids wholesaleApi date mismatch bug ────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const user = useAuthStore.getState().user
      if (!user?.business_id) throw new Error('Not authenticated — no business_id')

      const [salesRes, prodsRes] = await Promise.all([
        supabase
          .from('wholesale_sales')
          .select('*')
          .eq('business_id', user.business_id)
          .gte('sale_date', startDate)   // plain YYYY-MM-DD — matches date column correctly
          .lte('sale_date', endDate)
          .order('sale_date', { ascending: false }),
        productsApi.getAll(),
      ])

      if (salesRes.error) throw new Error(salesRes.error.message)

      setSales(
        (salesRes.data || []).map((sale: any) => ({
          ...sale,
          items: Array.isArray(sale.items) ? sale.items : [],
        })),
      )
      setProducts(prodsRes)
    } catch (e: unknown) {
      console.error('[Wholesale] Load error:', e)
      toast.error(e instanceof Error ? e.message : 'Failed to load wholesale data')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  // ── Period stats ──────────────────────────────────────────────────────
  const completedSales = useMemo(() => sales.filter(s => s.status === 'completed'), [sales])
  const totalRevenue   = useMemo(() => completedSales.reduce((s, r) => s + (r.total ?? 0), 0), [completedSales])
  const totalProfit    = useMemo(() => completedSales.reduce((s, sale) => s + calcSaleProfit(sale.items), 0), [completedSales])

  // ── Search filter ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return sales.filter(s =>
      !q ||
      (s.customer_name ?? '').toLowerCase().includes(q) ||
      (s.sale_number   ?? '').toLowerCase().includes(q),
    )
  }, [sales, search])

  // ── Cart helpers ──────────────────────────────────────────────────────
  const addToCart = () => {
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return
    if (cartItems.find(i => i.product_id === product.id)) {
      toast.error('Product already added — adjust its quantity instead.')
      return
    }
    setCartItems(prev => [
      ...prev,
      {
        product_id:   product.id,
        product_name: product.name,
        quantity:     1,
        unit_price:   product.selling_price ?? 0,
        cost_price:   product.avg_cost ?? 0,
      },
    ])
    setSelectedProductId('')
  }

  const updateCartItem = (id: string, field: 'quantity' | 'unit_price', raw: number) => {
    const value = isNaN(raw) ? 0 : field === 'quantity' ? Math.max(1, raw) : Math.max(0, raw)
    setCartItems(prev => prev.map(i => i.product_id === id ? { ...i, [field]: value } : i))
  }

  const removeCartItem = (id: string) =>
    setCartItems(prev => prev.filter(i => i.product_id !== id))

  const cartSubtotal = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const cartTotal    = cartSubtotal
  const cartProfit   = cartItems.reduce((s, i) => s + (i.unit_price - i.cost_price) * i.quantity, 0)

  const resetForm = () => {
    setShowForm(false)
    setForm(emptyForm)
    setCartItems([])
    setSelectedProductId('')
  }

  // ── Save ──────────────────────────────────────────────────────────────
  // Writes directly to Supabase — bypasses wholesaleApi.create() which has
  // a broken single-item shape that rejects multi-item carts.
  const handleSave = async () => {
    // Validation — no imported validateQuantity/validatePrice to avoid
    // return-shape mismatches (they return {error:string} but code called
    // toast.error(qErr.error) after checking `if (qErr)` — safe here).
    const nameErr = validateRequired(form.customer_name, 'Customer name')
    if (!nameErr.valid) { toast.error(nameErr.error!); return }
    if (cartItems.length === 0) { toast.error('Add at least one product'); return }
    for (const item of cartItems) {
      if (!item.quantity || item.quantity <= 0) {
        toast.error(`Quantity for "${item.product_name}" must be greater than 0`)
        return
      }
      if (isNaN(item.unit_price) || item.unit_price < 0) {
        toast.error(`Unit price for "${item.product_name}" is invalid`)
        return
      }
    }

    setSaving(true)
    try {
      const user = useAuthStore.getState().user
      if (!user?.business_id) throw new Error('Not authenticated')

      const totalQty     = cartItems.reduce((s, i) => s + i.quantity, 0)
      const avgSellPrice = totalQty > 0 ? cartTotal / totalQty : 0
      const avgCostPrice = totalQty > 0
        ? cartItems.reduce((s, i) => s + i.cost_price * i.quantity, 0) / totalQty
        : 0

      const payload = {
        // ── Multi-item fields ──────────────────────────────────
        sale_number:    `WS-${Date.now()}`,
        sale_date:      today,
        customer_name:  form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        items:          cartItems.map(i => ({
          product_id:   i.product_id,
          product_name: i.product_name,
          quantity:     i.quantity,
          unit_price:   i.unit_price,
          cost_price:   i.cost_price,
          line_total:   i.unit_price * i.quantity,
        })),
        subtotal:        cartSubtotal,
        discount_amount: 0,
        total:           cartTotal,
        payment_method:  form.payment_method,
        status:          'completed',
        notes:           form.notes.trim() || null,

        // ── Legacy flat fields (NOT NULL columns that must be satisfied) ──
        product_name:  cartItems.map(i => i.product_name).join(', '),
        quantity:      Math.max(totalQty, 1),   // satisfies check (quantity > 0)
        selling_price: avgSellPrice,
        cost_price:    isNaN(avgCostPrice) ? 0 : avgCostPrice,  // guard NaN

        // ── DO NOT include: total_amount, profit — they are GENERATED columns ──

        // ── Auth ──────────────────────────────────────────────
        business_id: user.business_id,
        created_by:  null,
      }

      console.log('[Wholesale] Inserting:', payload)

      const { error } = await supabase.from('wholesale_sales').insert(payload)

      if (error) {
        console.error('[Wholesale] Insert error:', error)
        throw new Error(error.message)
      }

      // ── Deduct stock from inventory ──────────────────────────────────
      const stockErrors: string[] = []

      await Promise.all(
        cartItems.map(async (item) => {
          // 1. Debug — fetch without business_id filter first to isolate the issue
          const { data: productData, error: fetchErr } = await supabase
            .from('products')
            .select('*')           // fetch all columns so we can log the real shape
            .eq('id', item.product_id)
            .single()

          if (fetchErr || !productData) {
            console.error('[Stock] Fetch failed for product_id:', item.product_id, fetchErr)
            stockErrors.push(`Could not fetch stock for "${item.product_name}"`)
            return
          }

          // Log the full product row so you can see the exact column name
          console.log('[Stock] Product row:', productData)

          // 2. Replace 'total_stock' below with whatever column name appears in the log
          const currentStock = productData.total_stock ?? productData.stock ?? productData.quantity ?? 0
          const newStock = currentStock - item.quantity

          const { error: updateErr } = await supabase
            .from('products')
            .update({ total_stock: Math.max(0, newStock) })  // ← update this key too if column name differs
            .eq('id', item.product_id)

          if (updateErr) {
            console.error('[Stock] Update failed:', updateErr)
            stockErrors.push(`Failed to update stock for "${item.product_name}": ${updateErr.message}`)
          } else if (newStock < 0) {
            stockErrors.push(`"${item.product_name}" oversold by ${Math.abs(newStock)}`)
          }
        })
      )

      if (stockErrors.length > 0) {
        console.warn('[Wholesale] Stock update warnings:', stockErrors)
        toast.success('Sale recorded, but some stock updates had issues:')
        stockErrors.forEach(msg => toast.error(msg, { duration: 6000 }))
      } else {
        toast.success('Wholesale sale recorded & inventory updated!')
      }

      resetForm()
      load()
    } catch (e: unknown) {
      console.error('[Wholesale] Save error:', e)
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
      const user = useAuthStore.getState().user
      const { error } = await supabase
        .from('wholesale_sales')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('business_id', user?.business_id)
      if (error) throw new Error(error.message)
      toast.success('Sale deleted')
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Heading ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wholesale</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Bulk sales management</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Sale</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className={`grid gap-3 ${isAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div className="card p-4 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-primary-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white font-mono truncate">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Period Revenue</p>
          </div>
        </div>

        {isAdmin && (
          <div className="card p-4 flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-emerald-400 font-mono truncate">
                {formatCurrency(totalProfit)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Period Profit</p>
            </div>
          </div>
        )}

        <div className="card p-4 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 dark:text-white font-mono truncate">
              {completedSales.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Period Transactions</p>
          </div>
        </div>
      </div>

      {/* ── Date range + presets ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
          <input type="date" className="input" value={startDate}
            onChange={e => { setStartDate(e.target.value); setSelectedPreset('') }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={endDate}
            onChange={e => { setEndDate(e.target.value); setSelectedPreset('') }} />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {getPresets().map(p => (
            <button key={p.label}
              onClick={() => { setStartDate(p.start); setEndDate(p.end); setSelectedPreset(p.label) }}
              className={`text-xs px-3 py-2 rounded-lg font-medium transition-all ${
                selectedPreset === p.label
                  ? 'bg-primary-600 text-white border border-primary-600 shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >{p.label}</button>
          ))}
          <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search customer or invoice…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Sales Table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Loading wholesale sales…" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/40">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Invoice</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Customer</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Items</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Payment</th>
                  {isAdmin && <th className="text-right px-4 py-3 whitespace-nowrap">Profit</th>}
                  <th className="text-right px-4 py-3 whitespace-nowrap">Total</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-center px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} className="text-center py-14 text-slate-500 text-sm">
                      <Store className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      {search ? 'No sales match your search' : 'No wholesale sales yet'}
                    </td>
                  </tr>
                ) : filtered.map(sale => {
                  const items    = sale.items || []
                  const profit   = calcSaleProfit(items)
                  const totalQty = items.length > 0
                    ? items.reduce((s, i) => s + i.quantity, 0)
                    : (sale as any).quantity ?? 0
                  return (
                    <tr key={sale.id}
                      className="border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary-400 whitespace-nowrap">
                        {sale.sale_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {sale.sale_date ? formatDate(sale.sale_date) : formatDate(sale.created_at)}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {sale.customer_name || 'Walk-in Customer'}
                        </p>
                        {sale.customer_phone && (
                          <p className="text-xs text-slate-500 truncate">{sale.customer_phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {totalQty}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`badge text-xs capitalize ${paymentBadge(sale.payment_method)}`}>
                          {sale.payment_method}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className={`px-4 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap ${
                          profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(profit)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap text-sm">
                        {formatCurrency(sale.total ?? 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`badge text-xs capitalize ${statusBadge(sale.status)}`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewSale(sale)} title="View details"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all">
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => setDeleteTarget(sale)} title="Delete sale"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
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

      {/* ══════════════════════════════════════════════════════════════════
          New Sale Modal
      ══════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showForm} onClose={resetForm} title="New Wholesale Sale" size="xl">
        <div className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Customer Name *</label>
              <input className="input" placeholder="Business / person name"
                value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone <span className="text-slate-400">(optional)</span></label>
              <input className="input" placeholder="98XXXXXXXX"
                value={form.customer_phone}
                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Add Products</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={selectedProductId}
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

          {cartItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-3 py-2">Product</th>
                      <th className="text-center px-2 py-2 w-20">Qty</th>
                      <th className="text-center px-2 py-2 w-28">Unit Price</th>
                      <th className="text-right px-3 py-2 w-32 whitespace-nowrap">Subtotal</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map(item => (
                      <tr key={item.product_id}
                        className="border-b border-slate-200 dark:border-slate-700/40 last:border-0">
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200 truncate">
                          {item.product_name}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="number" min="1" className="input py-1 w-16 text-center text-sm"
                            value={item.quantity}
                            onChange={e => updateCartItem(item.product_id, 'quantity', Number(e.target.value))} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="number" min="0" step="1" className="input py-1 w-24 text-right text-sm font-mono"
                            value={item.unit_price}
                            onChange={e => updateCartItem(item.product_id, 'unit_price', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeCartItem(item.product_id)}
                            className="text-slate-400 hover:text-red-400 transition-colors">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as WholesaleSale['payment_method'] }))}>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="credit">Credit (Pay Later)</option>
                <option value="split">Split</option>
              </select>
            </div>
            <div>
              <label className="label">Notes <span className="text-slate-400">(optional)</span></label>
              <textarea className="input resize-none" rows={2} placeholder="Any remarks…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-2 text-sm border border-slate-200 dark:border-slate-700/40">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 dark:text-white text-base pt-2 border-t border-slate-200 dark:border-slate-700">
              <span>Total</span>
              <span className="font-mono text-primary-400">{formatCurrency(cartTotal)}</span>
            </div>
            {isAdmin && cartItems.length > 0 && (
              <div className={`flex justify-between font-semibold text-xs pt-1 ${
                cartProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                <span>Profit (preview)</span>
                <span className="font-mono">{formatCurrency(cartProfit)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-60">
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Package className="w-4 h-4" /> Record Sale</>
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          View Sale Modal
      ══════════════════════════════════════════════════════════════════ */}
      {viewSale && (
        <Modal isOpen={!!viewSale} onClose={() => setViewSale(null)}
          title={viewSale.sale_number ?? 'Sale Details'} size="lg">
          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Customer</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {viewSale.customer_name}
                </p>
                {viewSale.customer_phone && (
                  <p className="text-xs text-slate-500 mt-0.5">{viewSale.customer_phone}</p>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Date</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewSale.sale_date ? formatDate(viewSale.sale_date) : formatDate(viewSale.created_at)}
                </p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">
                  Payment: <span className="font-medium">{viewSale.payment_method}</span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm min-w-[380px]">
                <thead>
                  <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    {isAdmin && <th className="text-right px-3 py-2 whitespace-nowrap">Cost</th>}
                    <th className="text-right px-3 py-2 whitespace-nowrap">Unit Price</th>
                    {isAdmin && <th className="text-right px-3 py-2">Profit</th>}
                    <th className="text-right px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewSale.items || []).length > 0
                    ? (viewSale.items || []).map((item, idx) => {
                        const itemProfit = (item.unit_price - (item.cost_price ?? 0)) * item.quantity
                        return (
                          <tr key={idx} className="border-b border-slate-200 dark:border-slate-700/40 last:border-0">
                            <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200 max-w-[140px] truncate">
                              {item.product_name}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {item.quantity}
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {formatCurrency(item.cost_price ?? 0)}
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                              {formatCurrency(item.unit_price)}
                            </td>
                            {isAdmin && (
                              <td className={`px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${
                                itemProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {formatCurrency(itemProfit)}
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                              {formatCurrency(item.unit_price * item.quantity)}
                            </td>
                          </tr>
                        )
                      })
                    // Fallback for legacy single-item rows
                    : (
                      <tr className="border-b border-slate-200 dark:border-slate-700/40">
                        <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200">
                          {(viewSale as any).product_name ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {(viewSale as any).quantity ?? '—'}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                            {formatCurrency((viewSale as any).cost_price ?? 0)}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-right font-mono text-slate-900 dark:text-white">
                          {formatCurrency((viewSale as any).selling_price ?? 0)}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-2.5 text-right font-mono text-emerald-400">
                            {formatCurrency(
                              ((viewSale as any).selling_price - (viewSale as any).cost_price) *
                              ((viewSale as any).quantity ?? 1)
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-900 dark:text-white">
                          {formatCurrency(viewSale.total ?? 0)}
                        </td>
                      </tr>
                    )
                  }
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm border border-slate-200 dark:border-slate-700/40">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(viewSale.subtotal ?? viewSale.total ?? 0)}</span>
              </div>
              {(viewSale.discount_amount ?? 0) > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Discount</span>
                  <span className="font-mono">−{formatCurrency(viewSale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 dark:text-white text-base pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Total</span>
                <span className="font-mono text-primary-400">{formatCurrency(viewSale.total ?? 0)}</span>
              </div>
              {isAdmin && (() => {
                const saleProfit = calcSaleProfit(viewSale.items || [])
                return (
                  <div className={`flex justify-between font-semibold ${
                    saleProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <span>Profit</span>
                    <span className="font-mono">{formatCurrency(saleProfit)}</span>
                  </div>
                )
              })()}
            </div>

            {viewSale.notes && (
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl px-4 py-3 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/30">
                <span className="text-slate-400 text-xs uppercase tracking-wide mr-1">Notes:</span>
                {viewSale.notes}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete confirm — admin only ── */}
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
