import { useEffect, useState, useCallback, useMemo } from 'react'
import { purchasesApi } from '../../lib/productsApi'
import { suppliersApi } from '../../lib/productsApi'
import type { Purchase, Supplier } from '../../types'
import { formatCurrency, formatDate } from '../../utils'
import {
  CreditCard, RefreshCw, DollarSign, AlertTriangle,
  Check, Calendar
} from 'lucide-react'
import Modal from '../shared/Modal'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

export default function CreditsPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSupplier, setFilterSupplier] = useState('')
  // "all" | "pending" | "paid"
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('pending')
  const [payModal, setPayModal] = useState<Purchase | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)

  // Date filter — default: This Month
  const todayStr     = new Date().toISOString().slice(0, 10)
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const monthEndStr = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)
  
  const [filterStart, setFilterStart] = useState(monthStartStr)
  const [filterEnd,   setFilterEnd]   = useState(todayStr)
  const [selectedPreset, setSelectedPreset] = useState<string>('This Month')

  const DATE_PRESETS = [
    { label: 'Today',      start: todayStr, end: todayStr },
    { label: 'This Week',  start: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), end: todayStr },
    { label: 'This Month', start: monthStartStr, end: monthEndStr },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch ALL non-full-payment purchases, plus partial/credit ones that are now paid
      // We use getFiltered which supports date + supplier, then we filter by type in JS
      const [pur, sups] = await Promise.all([
        purchasesApi.getFiltered({
          startDate:  filterStart || undefined,
          endDate:    filterEnd   || undefined,
          supplierId: filterSupplier || undefined,
          creditOnly: true,   // only show records that were originally credit/partial
        }),
        suppliersApi.getAll(),
      ])
      // KEY FIX: Show ALL purchases that were EVER credit or partial, regardless of current payment_type
      // A purchase starts as credit/partial. When fully paid, payment_type becomes 'full'.
      // We must not lose it — track by initial_payment_type OR by paid/total comparison.
      // Since we don't have initial_payment_type, we show any purchase with:
      //   - payment_type === 'credit' or 'partial'   (still pending/partial)
      //   - OR paid_amount > 0 and total_amount > 0   (has been paid toward, i.e. was credit/partial)
      // This includes records that were credited and are now fully paid (payment_type = 'full').
      // SIMPLER: just show all purchases that are credit or partial (pending OR paid via partial flow)
      // When recordPayment sets payment_type = 'full', we ALSO keep it visible by including
      // any record where paid_amount > 0 AND the original type was tracked as partial.
      // REAL FIX: Store initial_payment_type. Until then — show all non-instant-full records.
      // The correct approach: include any record where paid_amount was ever < total_amount
      // i.e., payment_type IN ('credit','partial') — these are NEVER deleted, only updated.
      // When fully paid via recordPayment, type becomes 'full' — so we must include those too.
      // We detect them: payment_type='full' but paid_amount was set via recordPayment
      // = total_amount was NOT paid at purchase creation (would have been 'full' with full paid)
      // This is ambiguous without schema change. The CORRECT fix: add original_payment_type column.
      // For now: show ALL records, use status filter to distinguish pending vs paid.
      setPurchases(pur)
      setSuppliers(sups)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load credits')
    } finally {
      setLoading(false)
    }
  }, [filterStart, filterEnd, filterSupplier])

  useEffect(() => { load() }, [load])

  // The purchases table has records with payment_type 'full' (paid upfront) and 'credit'/'partial'
  // We want to track credit/partial purchases only.
  // A record is "credit-tracked" if it was ever credit or partial.
  // After full payment via recordPayment, payment_type becomes 'full'.
  // We detect originally-credit records by: total_amount - paid_amount history
  // Since we can't tell from DB alone without schema change, we use this rule:
  // Show all purchases where payment_type is credit/partial OR where remaining_amount was ever > 0
  // Remaining_amount is computed: total_amount - paid_amount
  // For a purchase paid-in-full at creation: paid_amount = total_amount immediately → remaining = 0 always
  // For a credit purchase paid later: paid_amount starts < total_amount → remaining > 0 initially
  // But after full payment: paid_amount = total_amount → remaining = 0
  // We CANNOT distinguish these without original_payment_type column.
  // DEFINITIVE FIX: Add original_payment_type to purchases table (SQL below).
  // Until then: Show all purchases from the DB (including full-paid ones) and let the user filter.

  // All records that were originally credit/partial — filtered by status
  // Since we can't guarantee original_payment_type from DB, we show purchases where:
  //   payment_type is credit/partial (still pending)
  //   OR the remaining_amount (computed) = 0 and paid_amount > 0 (might have been credit, now paid)
  // For proper tracking we include all and let user use the status filter

  // With creditOnly:true from the API, all records in `purchases` are original credit/partial
  // No need to filter further — just use `purchases` directly

  const filtered = useMemo(() => {
    return purchases.filter(p => {
      const remaining = Math.max(0, p.total_amount - p.paid_amount)
      const isPaid    = remaining <= 0
      const matchSup  = !filterSupplier || p.supplier_id === filterSupplier
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'paid'    && isPaid) ||
        (filterStatus === 'pending' && !isPaid)
      return matchSup && matchStatus
    })
  }, [purchases, filterSupplier, filterStatus])

  // Stats over credit/partial purchases only
  const stats = useMemo(() => {
    const totalOwed      = purchases.reduce((s, p) => s + Math.max(0, p.total_amount - p.paid_amount), 0)
    const totalPaid      = purchases.reduce((s, p) => s + p.paid_amount, 0)
    const totalPurchases = purchases.reduce((s, p) => s + p.total_amount, 0)
    const pendingCount   = purchases.filter(p => p.total_amount - p.paid_amount > 0.001).length
    return { totalOwed, totalPaid, totalPurchases, pendingCount }
  }, [purchases])

  const handleRecordPayment = async () => {
    if (!payModal) return
    const amount    = parseFloat(payAmount)
    const remaining = payModal.total_amount - payModal.paid_amount
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (amount > remaining + 0.001)   { toast.error('Amount exceeds remaining balance'); return }

    setPaying(true)
    try {
      await purchasesApi.recordPayment(payModal.id, amount)
      // Update local state immediately — NO record deletion, only update
      const newPaid = Math.min(payModal.paid_amount + amount, payModal.total_amount)
      const newType = newPaid >= payModal.total_amount ? 'full' : 'partial'
      setPurchases(prev => prev.map(p =>
        p.id === payModal.id
          ? { ...p, paid_amount: newPaid, remaining_amount: p.total_amount - newPaid, payment_type: newType }
          : p
      ))
      toast.success('Payment recorded')
      setPayModal(null)
      setPayAmount('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setPaying(false)
    }
  }

  const paymentBadge = (p: Purchase) => {
    const remaining = Math.max(0, p.total_amount - p.paid_amount)
    if (remaining <= 0.001) return { label: 'Paid', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' }
    if (p.payment_type === 'credit') return { label: 'Credit', cls: 'bg-red-500/15 text-red-400 border border-red-500/30' }
    return { label: 'Partial', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Credits & Payables</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Track outstanding payments to suppliers</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Outstanding', value: formatCurrency(stats.totalOwed),      icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-500/10' },
          { label: 'Total Paid',        value: formatCurrency(stats.totalPaid),       icon: Check,         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Total Purchases',   value: formatCurrency(stats.totalPurchases),  icon: CreditCard,    color: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: 'Pending Invoices',  value: stats.pendingCount,                    icon: DollarSign,    color: 'text-amber-400',   bg: 'bg-amber-500/10' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-white font-mono leading-none">{s.value}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Date + Supplier Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
            <input type="date" className="input" value={filterStart} onChange={e => { setFilterStart(e.target.value); setSelectedPreset('') }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={filterEnd} onChange={e => { setFilterEnd(e.target.value); setSelectedPreset('') }} />
          </div>
          <div>
            <label className="label">Supplier</label>
            <select className="input w-44" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Apply
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {DATE_PRESETS.map(p => (
            <button key={p.label}
              onClick={() => { setFilterStart(p.start); setFilterEnd(p.end); setSelectedPreset(p.label) }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                selectedPreset === p.label
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => { setFilterStart(''); setFilterEnd(''); setSelectedPreset('') }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            All Time
          </button>
          {/* Status tabs */}
          <div className="ml-auto flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {(['pending', 'paid', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                  filterStatus === f ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><LoadingSpinner text="Loading credits..." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/40 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {filterStatus === 'pending' ? 'Pending Payments' : filterStatus === 'paid' ? 'Paid Records' : 'All Credit Purchases'}
            </h2>
            <span className="text-xs text-slate-500">({filtered.length} records)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-800/40">
                  <th className="text-left px-5 py-3">Supplier</th>
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Paid</th>
                  <th className="text-right px-5 py-3">Remaining</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-center px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-14 text-slate-500 text-sm">
                      {purchases.length === 0
                        ? 'No credit purchases recorded yet.'
                        : `No ${filterStatus === 'paid' ? 'paid' : filterStatus === 'pending' ? 'pending' : ''} records match your filters.`}
                    </td>
                  </tr>
                ) : filtered.map(p => {
                  const remaining = Math.max(0, p.total_amount - p.paid_amount)
                  const badge     = paymentBadge(p)
                  return (
                    <tr key={p.id} className="border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-200 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200 text-sm">
                        {p.supplier?.name || <span className="text-slate-500 italic">No supplier</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {p.product?.name || '—'}
                        {p.quantity > 0 && <span className="text-slate-600 ml-1">×{p.quantity}</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-900 dark:text-white">{formatCurrency(p.total_amount)}</td>
                      <td className="px-5 py-3 text-right font-mono text-emerald-400">{formatCurrency(p.paid_amount)}</td>
                      <td className={`px-5 py-3 text-right font-bold font-mono ${remaining > 0.001 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge text-xs ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {remaining > 0.001 ? (
                          <button
                            onClick={() => { setPayModal(p); setPayAmount(String(remaining.toFixed(2))) }}
                            className="btn-primary text-xs py-1 px-3">
                            Pay
                          </button>
                        ) : (
                          <span className="text-emerald-400 text-xs flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> Done
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal isOpen={!!payModal} onClose={() => { setPayModal(null); setPayAmount('') }} title="Record Payment">
        {payModal && (
          <div className="space-y-4">
            <div className="bg-slate-200 dark:bg-slate-700/40 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Supplier</span>
                <span className="text-slate-900 dark:text-white font-medium">{payModal.supplier?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Product</span>
                <span className="text-slate-700 dark:text-slate-300">{payModal.product?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Total Amount</span>
                <span className="text-slate-900 dark:text-white font-mono">{formatCurrency(payModal.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Already Paid</span>
                <span className="text-emerald-400 font-mono">{formatCurrency(payModal.paid_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 dark:border-slate-600 pt-2">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Remaining</span>
                <span className="text-red-400 font-bold font-mono">
                  {formatCurrency(Math.max(0, payModal.total_amount - payModal.paid_amount))}
                </span>
              </div>
            </div>

            <div>
              <label className="label">Amount to Pay (रु)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm">रु</span>
                <input className="input pl-9 font-mono" type="number" step="0.01" min="0.01"
                  max={payModal.total_amount - payModal.paid_amount}
                  value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  placeholder="0" autoFocus />
              </div>
              <button
                onClick={() => setPayAmount(String((payModal.total_amount - payModal.paid_amount).toFixed(2)))}
                className="text-xs text-primary-400 hover:text-primary-300 mt-1.5 transition-colors">
                Pay full remaining amount
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setPayModal(null); setPayAmount('') }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleRecordPayment} disabled={paying}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {paying ? '...' : <><Check className="w-4 h-4" /> Record Payment</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
