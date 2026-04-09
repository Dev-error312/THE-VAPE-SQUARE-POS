import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { RefreshCw, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../shared/LoadingSpinner'
import Modal from '../shared/Modal'

interface AccountingData {
  openingCash: number
  openingStock: number
  openingCapital: number
  retailRevenue: number
  wholesaleRevenue: number
  totalRevenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  restockCash: number
  restockStockValue: number
  damagedLoss: number
  closingCash: number
  closingStock: number
  creditOutstanding: number
  currentCapital: number
  cashChange: number
  stockChange: number
  capitalChange: number
  grossMargin: number
  netMargin: number
  retailShare: number
  wholesaleShare: number
  hasOpeningBalance: boolean
  openingBalanceDate: string
}

const fmt = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n ?? 0))

const fmtShort = (n: number) => {
  const abs = Math.abs(n ?? 0)
  const s = (n ?? 0) < 0 ? '-' : ''
  if (abs >= 1e7) return s + 'Rs.' + (abs / 1e7).toFixed(1) + 'Cr'
  if (abs >= 1e5) return s + 'Rs.' + (abs / 1e5).toFixed(1) + 'L'
  if (abs >= 1e3) return s + 'Rs.' + (abs / 1e3).toFixed(1) + 'K'
  return s + 'Rs.' + Math.round(abs)
}

const fmtPct = (n: number) => (n ?? 0).toFixed(1) + '%'

function Trend({ value }: { value?: number }) {
  if (value == null) return null
  if (Math.abs(value) < 0.5)
    return <span className="text-xs font-bold text-slate-600 dark:text-slate-400">— No change</span>
  const up = value > 0
  return (
    <span className={`text-xs font-bold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
      {up ? '↑' : '↓'} {fmtShort(Math.abs(value))}
    </span>
  )
}

function MetricCard({
  label,
  value,
  sub,
  trend,
  highlight = false,
  color = 'slate',
}: {
  label: string
  value: number
  sub?: string
  trend?: number
  highlight?: boolean
  color?: string
}) {
  const colorMap: Record<string, { bg: string; border: string; accent: string; text: string }> = {
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-300 dark:border-emerald-700/50',
      accent: 'text-emerald-600 dark:text-emerald-400',
      text: 'text-emerald-900 dark:text-emerald-100',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-300 dark:border-emerald-700/50',
      accent: 'text-emerald-600 dark:text-emerald-400',
      text: 'text-emerald-900 dark:text-emerald-100',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-300 dark:border-red-700/50',
      accent: 'text-red-600 dark:text-red-400',
      text: 'text-red-900 dark:text-red-100',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-300 dark:border-blue-700/50',
      accent: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-900 dark:text-blue-100',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      border: 'border-purple-300 dark:border-purple-700/50',
      accent: 'text-purple-600 dark:text-purple-400',
      text: 'text-purple-900 dark:text-purple-100',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-300 dark:border-amber-700/50',
      accent: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-900 dark:text-amber-100',
    },
    slate: {
      bg: 'bg-slate-100 dark:bg-slate-800/50',
      border: 'border-slate-300 dark:border-slate-700',
      accent: 'text-slate-600 dark:text-slate-400',
      text: 'text-slate-900 dark:text-slate-100',
    },
  }

  const c = colorMap[color || 'slate'] || colorMap['slate']
  if (!c) {
    // Fallback if something goes wrong
    return (
      <div className="card p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
        <div className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">{label}</div>
        <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2">
          {(value ?? 0) < 0 ? `(${fmt(value)})` : fmt(value)}
        </div>
      </div>
    )
  }
  return (
    <div
      className={`${c.bg} border ${c.border} rounded-xl p-4 transition-all ${
        highlight ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${c.accent}` : ''
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${c.accent}`}>{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${c.text}`}>
        {(value ?? 0) < 0 ? `(${fmt(value)})` : fmt(value)}
      </div>
      {sub && <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{sub}</div>}
      {trend !== undefined && <div className="mt-2"><Trend value={trend} /></div>}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">{title}</h2>
      <div>{children}</div>
    </div>
  )
}

function StatRow({
  label,
  value,
  indent = false,
  total = false,
  colorKey = 'slate',
}: {
  label: string
  value: number
  indent?: boolean
  total?: boolean
  colorKey?: string
}) {
  const cols: Record<string, string> = {
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    muted: 'text-slate-500 dark:text-slate-400',
  }

  const col = cols[colorKey] || 'text-slate-900 dark:text-slate-100'
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${
        total ? 'border-t-2 border-slate-300 dark:border-slate-700 pt-3 font-bold' : ''
      }`}
    >
      <span className={`text-sm ${indent ? 'ml-4 text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
        {label}
      </span>
      <span className={`text-sm ${total ? 'font-bold' : ''} font-mono ${col}`}>
        {(value ?? 0) < 0 ? `(${fmt(value)})` : fmt(value)}
      </span>
    </div>
  )
}

function OpeningBalanceModal({
  onSave,
  onClose,
  saving,
  initialCash,
  initialDate,
  defaultDate,
}: {
  onSave: (data: { cash: number; date: string }) => Promise<void>
  onClose: () => void
  saving: boolean
  initialCash?: number
  initialDate?: string
  defaultDate?: string
}) {
  const [cash, setCash] = useState(initialCash ? String(initialCash) : '')
  // Default to period start date (when opening balance becomes effective), not today
  const [date, setDate] = useState(initialDate || defaultDate || new Date().toISOString().split('T')[0])

  return (
    <Modal isOpen={true} onClose={onClose} title={initialCash ? "Edit Opening Balance" : "Set Opening Balance"}>
      <div className="space-y-4">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Cash in Hand (Rs.)</label>
          <input
            type="number"
            placeholder="e.g. 300000"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            className="input"
          />
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-700/50 rounded-lg">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            💡 Stock value is automatically calculated from your current inventory. You only need to set the opening cash amount.
          </p>
        </div>
        {cash && (
          <div className="card p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-700/50">
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Opening Cash
            </div>
            <div className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-100 mt-2">
              {fmt(Number(cash) || 0)}
            </div>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              try {
                onSave({
                  cash: Number(cash) || 0,
                  date,
                }).catch((err) => {
                  console.error('Save error:', err)
                })
              } catch (err) {
                console.error('Save error:', err)
              }
            }}
            disabled={saving || !cash}
            className="btn-primary flex-1"
          >
            {saving ? 'Saving...' : initialCash ? 'Update Opening Balance' : 'Save Opening Balance'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

async function fetchAccountingData(businessId: string, from: string, to: string): Promise<AccountingData> {
  try {
    // Helper to safely execute Supabase queries
    const execQuery = async (fn: () => any) => {
      try {
        const result = await fn()
        return result.data ?? []
      } catch (err) {
        console.error('Query error:', err)
        return []
      }
    }

    // ── Nepal is UTC+5:45 — convert local date boundaries to UTC ────────
    // "from" date at 00:00 Nepal time = previous day at 18:15 UTC
    // "to" date at 23:59:59 Nepal time = same day at 18:14:59 UTC
    const nepalOffsetMs = (5 * 60 + 45) * 60 * 1000
    const fromUTC = new Date(new Date(`${from}T00:00:00`).getTime() - nepalOffsetMs).toISOString()
    const toUTC   = new Date(new Date(`${to}T23:59:59.999`).getTime() - nepalOffsetMs).toISOString()

    const [
      salesRows,        // retail sales with their items
      expRows,          // expenses
      closingInventoryRows, // current stock
      damageRows,       // damaged products
      restockRows,      // purchases with actual paid amounts
      wholesaleRows,    // wholesale sales with items JSON
    ] = await Promise.all([
      // ── Retail sales: fetch the sale total + sale_items for COGS ──────
      execQuery(() =>
        supabase
          .from('sales')
          .select('total, sale_items(cost_price, quantity, line_total)')
          .eq('business_id', businessId)
          .eq('status', 'completed')
          .gte('created_at', fromUTC)
          .lte('created_at', toUTC)
      ),
      // ── Expenses ─────────────────────────────────────────────────────
      execQuery(() =>
        supabase
          .from('expenses')
          .select('amount')
          .eq('business_id', businessId)
          .gte('expense_date', from)
          .lte('expense_date', to)
      ),
      // ── Closing stock: current inventory (ground truth) ──────────────
      execQuery(() =>
        supabase
          .from('inventory_batches')
          .select('cost_price, quantity_remaining')
          .eq('business_id', businessId)
      ),
      // ── Damaged products ─────────────────────────────────────────────
      execQuery(() =>
        supabase
          .from('damaged_products')
          .select('loss_amount')
          .eq('business_id', businessId)
          .gte('damage_date', from)
          .lte('damage_date', to)
      ),
      // ── Purchases/Restocks: fetch total_amount + paid_amount ─────────
      // total_amount = stock value received (for inventory movement)
      // paid_amount  = actual cash paid out (for cash flow)
      execQuery(() =>
        supabase
          .from('purchases')
          .select('total_amount, paid_amount')
          .eq('business_id', businessId)
          .gte('created_at', fromUTC)
          .lte('created_at', toUTC)
      ),
      // ── Wholesale: fetch total + items JSON (NOT flat legacy fields) ──
      execQuery(() =>
        supabase
          .from('wholesale_sales')
          .select('total, items')
          .eq('business_id', businessId)
          .gte('sale_date', from)
          .lte('sale_date', to)
      ),
    ])

    // ── Fetch opening cash from DB ──────────────────────────────────────
    let openingCash = 0
    let hasOpeningBalance = false
    let openingBalanceDate = ''
    try {
      const { data: obRows } = await supabase
        .from('accounting_opening_balance')
        .select('cash_amount, balance_date')
        .eq('business_id', businessId)
        .lte('balance_date', to)
        .order('balance_date', { ascending: false })
        .limit(1)
      if (obRows?.[0]) {
        openingCash = Number(obRows[0].cash_amount ?? 0)
        openingBalanceDate = obRows[0].balance_date ?? ''
        hasOpeningBalance = true
      }
    } catch (e) {
      console.log('Opening balance not available:', e)
    }

    // ── Closing stock: current inventory value ──────────────────────────
    let closingStock = 0
    for (const batch of closingInventoryRows) {
      closingStock += Number(batch.quantity_remaining ?? 0) * Number(batch.cost_price ?? 0)
    }

    // ── Retail revenue & COGS ───────────────────────────────────────────
    // Revenue = sales.total (actual amount collected from customer)
    // COGS = sum of (cost_price × quantity) from sale_items
    let retailRevenue = 0
    let retailCogs = 0
    for (const sale of salesRows) {
      retailRevenue += Number(sale.total ?? 0)
      const items = Array.isArray(sale.sale_items) ? sale.sale_items : []
      for (const item of items) {
        retailCogs += Number(item.cost_price ?? 0) * Number(item.quantity ?? 0)
      }
    }

    // ── Wholesale revenue & COGS ────────────────────────────────────────
    // Revenue = wholesale_sales.total (actual amount charged)
    // COGS = sum of (cost_price × quantity) from items JSON array
    let wholesaleRevenue = 0
    let wholesaleCogs = 0
    for (const wsale of wholesaleRows) {
      wholesaleRevenue += Number(wsale.total ?? 0)
      const items = Array.isArray(wsale.items) ? wsale.items : []
      for (const item of items) {
        wholesaleCogs += Number(item.cost_price ?? 0) * Number(item.quantity ?? 0)
      }
    }

    const totalRevenue = retailRevenue + wholesaleRevenue
    const cogs = retailCogs + wholesaleCogs
    const grossProfit = totalRevenue - cogs
    const expenses = expRows.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)
    const netProfit = grossProfit - expenses

    // ── Restock: stock value received vs cash actually paid ─────────────
    // restockStockValue = total_amount (what the stock is worth)
    // restockCash       = paid_amount  (actual cash that left the register)
    let restockStockValue = 0
    let restockCash = 0
    for (const purchase of restockRows) {
      restockStockValue += Number(purchase.total_amount ?? 0)
      restockCash += Number(purchase.paid_amount ?? 0)
    }

    const damagedLoss = damageRows.reduce((s: number, d: any) => s + Number(d.loss_amount ?? 0), 0)

    // ── Credit outstanding: total unpaid amount to suppliers ─────────────
    // This is a running total (NOT date-filtered) — debts persist until paid
    let creditOutstanding = 0
    try {
      const { data: creditRows } = await supabase
        .from('purchases')
        .select('total_amount, paid_amount')
        .eq('business_id', businessId)
        .in('original_payment_type', ['credit', 'partial'])
      if (creditRows) {
        for (const row of creditRows) {
          const remaining = Number(row.total_amount ?? 0) - Number(row.paid_amount ?? 0)
          if (remaining > 0) creditOutstanding += remaining
        }
      }
    } catch (e) {
      console.log('Credit query error:', e)
    }

    // ── Opening stock via accounting identity ───────────────────────────
    // Opening = Closing − Restocked + Sold(COGS) + Damaged
    const openingStock = closingStock - restockStockValue + cogs + damagedLoss

    const openingCapital = openingCash + openingStock

    // ── Closing cash: accounts for actual cash paid out ─────────────────
    const closingCash = openingCash + totalRevenue - expenses - restockCash
    // Capital = Assets (Cash + Stock) minus Liabilities (Credit Owed)
    const currentCapital = closingCash + closingStock - creditOutstanding

    return {
      openingCash,
      openingStock,
      openingCapital,
      retailRevenue,
      wholesaleRevenue,
      totalRevenue,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      restockCash,
      restockStockValue,
      damagedLoss,
      closingCash,
      closingStock,
      creditOutstanding,
      currentCapital,
      cashChange: closingCash - openingCash,
      stockChange: closingStock - openingStock,
      capitalChange: currentCapital - openingCapital,
      grossMargin: totalRevenue ? (grossProfit / totalRevenue) * 100 : 0,
      netMargin: totalRevenue ? (netProfit / totalRevenue) * 100 : 0,
      retailShare: totalRevenue ? (retailRevenue / totalRevenue) * 100 : 0,
      wholesaleShare: totalRevenue ? (wholesaleRevenue / totalRevenue) * 100 : 0,
      hasOpeningBalance,
      openingBalanceDate,
    }
  } catch (error) {
    console.error('Error fetching accounting data:', error)
    throw error
  }
}

export default function AccountingPage() {
  const todayStr = new Date().toISOString().slice(0, 10)
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [selectedPreset, setSelectedPreset] = useState<string>('This Month')
  const [data, setData] = useState<AccountingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasPromptedForOpeningBalance, setHasPromptedForOpeningBalance] = useState(false)

  const user = useAuthStore((s) => s.user)
  const businessId = user?.business_id || ''

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

  const load = useCallback(async () => {
    if (!businessId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    if (!startDate || !endDate) {
      setError('Please select a date range')
      setLoading(false)
      return
    }

    if (startDate > endDate) {
      setError('Start date must be before end date')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const d = await fetchAccountingData(businessId, startDate, endDate)
      if (d) {
        setData(d)
        
        // Only show modal on first visit if opening balances are empty (both 0)
        if (!hasPromptedForOpeningBalance && d.openingCash === 0 && d.openingStock === 0) {
          setShowModal(true)
          setHasPromptedForOpeningBalance(true)
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to load accounting data'
      console.error('Load error:', errMsg)
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, businessId, hasPromptedForOpeningBalance])

  useEffect(() => {
    load()
  }, [load])

  const handleSaveOB = async (input: { cash: number; date: string }) => {
    setSaving(true)
    try {
      if (data?.hasOpeningBalance) {
        // Update existing - unique constraint is on business_id only
        const { data: updated, error } = await supabase
          .from('accounting_opening_balance')
          .update({
            cash_amount: input.cash,
            balance_date: input.date,
          })
          .eq('business_id', businessId)
          .select()
        
        if (error) {
          console.error('Open balance update error:', error)
          toast.error(error.message || 'Unable to update opening balance')
          setSaving(false)
          return
        }
        if (!updated || updated.length === 0) {
          console.error('Open balance update returned no rows — likely RLS issue')
          toast.error('Update failed — check database permissions')
          setSaving(false)
          return
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('accounting_opening_balance')
          .insert({
            business_id: businessId,
            cash_amount: input.cash,
            balance_date: input.date,
          })
          .select()
        
        if (error) {
          console.error('Open balance insert error:', error)
          if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
            // Record exists, update it instead
            const { data: updated, error: updateError } = await supabase
              .from('accounting_opening_balance')
              .update({
                cash_amount: input.cash,
                balance_date: input.date,
              })
              .eq('business_id', businessId)
              .select()
            
            if (updateError || !updated || updated.length === 0) {
              toast.error(updateError?.message || 'Unable to save opening balance — check permissions')
              setSaving(false)
              return
            }
          } else if (error.code === 'PGRST301' || error.message?.includes('relation') || error.message?.includes('permission')) {
            toast.error('Opening balance table not set up yet. Contact your admin or proceed without it.')
            setSaving(false)
            setHasPromptedForOpeningBalance(true)
            return
          } else {
            toast.error(error.message || 'Unable to save opening balance')
            setSaving(false)
            setHasPromptedForOpeningBalance(true)
            return
          }
        }
      }
      
      toast.success('Opening balance saved!')
      setShowModal(false)
      setHasPromptedForOpeningBalance(true)
      setSaving(false)
      // Auto-reload data so the UI updates immediately
      load()
    } catch (e) {
      console.error('Save error:', e)
      toast.error('Unable to save opening balance, but you can continue.')
      setSaving(false)
      setShowModal(false)
      setHasPromptedForOpeningBalance(true)
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Loading accounting data..." />
      </div>
    )

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {showModal && (
        <OpeningBalanceModal 
          onSave={handleSaveOB} 
          onClose={() => setShowModal(false)} 
          saving={saving}
          initialCash={data?.openingCash}
          initialDate={data?.openingBalanceDate}
          defaultDate={startDate}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accounting</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
            Financial overview · {startDate} → {endDate}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
          🏦 Opening Balance
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label flex items-center gap-1">
            <Calendar className="w-3 h-3" /> From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setSelectedPreset('') }}
            className="input"
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('') }}
            className="input"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map((p) => {
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
              load().catch((err) => {
                console.error('Load error:', err)
              })
            }}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700/50 text-red-700 dark:text-red-300 text-sm">
          <b>Error:</b> {error}
          <button 
            onClick={() => {
              load().catch((err) => {
                console.error('Retry error:', err)
              })
            }} 
            className="ml-4 font-bold underline"
          >
            Retry →
          </button>
        </div>
      )}

      {!loading && data && data.hasOpeningBalance && (
        <button
          onClick={() => setShowModal(true)}
          className="w-full card p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 border border-emerald-300 dark:border-emerald-700/50 hover:shadow-md transition-all text-left group"
        >
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            Opening Balance Set
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold font-mono text-emerald-900 dark:text-emerald-100">
                {fmt(data.openingCash)}
              </span>
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                at {new Date(data.openingBalanceDate + 'T00:00:00').toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </span>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
              Click to edit →
            </span>
          </div>
        </button>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard label="Opening Capital" value={data.openingCapital} color="slate" sub={`Cash ${fmtShort(data.openingCash)} + Stock ${fmtShort(data.openingStock)}`} />
            <MetricCard label="Total Revenue" value={data.totalRevenue} color="blue" sub={`${fmtPct(data.retailShare)} retail`} />
            <MetricCard label="Credit Outstanding" value={data.creditOutstanding} color={data.creditOutstanding > 0 ? 'red' : 'emerald'} sub={data.creditOutstanding > 0 ? 'Owed to suppliers' : 'No pending credits'} />
            <MetricCard
              label="Net Profit"
              value={data.netProfit}
              color={data.netProfit >= 0 ? 'emerald' : 'red'}
              highlight
              sub={`Net margin: ${fmtPct(data.netMargin)}`}
            />
            <MetricCard label="Cash in Hand" value={data.closingCash} color="amber" trend={data.cashChange} />
            <MetricCard label="Stock Value" value={data.closingStock} color="purple" trend={data.stockChange} />
            <MetricCard label="Total Restocked" value={data.restockStockValue} color="blue" sub={`Stock purchased in period`} />
            <MetricCard
              label="Current Capital"
              value={data.currentCapital}
              color="purple"
              highlight
              sub={data.creditOutstanding > 0 ? `Cash + Stock − ${fmtShort(data.creditOutstanding)} credit` : `Cash ${fmtShort(data.closingCash)} + Stock ${fmtShort(data.closingStock)}`}
              trend={data.capitalChange}
            />
          </div>

          {/* Four-section grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Revenue Breakdown">
              <StatRow label="Retail sales" value={data.retailRevenue} colorKey="blue" />
              <StatRow label="Wholesale sales" value={data.wholesaleRevenue} colorKey="blue" />
              <StatRow label="Total revenue" value={data.totalRevenue} colorKey="blue" total />
            </SectionCard>

            <SectionCard title="Profit & Loss Statement">
              <StatRow label="Total revenue" value={data.totalRevenue} colorKey="blue" />
              <StatRow label="(−) Cost of goods sold" value={-data.cogs} colorKey="red" indent />
              <StatRow label="Gross profit" value={data.grossProfit} colorKey="emerald" total />
              <StatRow label="(−) Operating expenses" value={-data.expenses} colorKey="red" indent />
              <StatRow label="Net profit" value={data.netProfit} colorKey={data.netProfit >= 0 ? 'emerald' : 'red'} total />
            </SectionCard>

            <SectionCard title="Cash Flow Statement">
              <StatRow label="Opening cash" value={data.openingCash} colorKey="muted" />
              <StatRow label="(+) Sales collected" value={data.totalRevenue} colorKey="emerald" indent />
              <StatRow label="(−) Expenses paid" value={-data.expenses} colorKey="red" indent />
              <StatRow label="(−) Restock payments" value={-data.restockCash} colorKey="red" indent />
              <StatRow label="Closing cash" value={data.closingCash} total />
              <div className="mt-3">
                <Trend value={data.cashChange} />
              </div>
            </SectionCard>

            <SectionCard title="Inventory Movement">
              <StatRow label="Opening stock" value={data.openingStock} colorKey="muted" />
              <StatRow label="(+) Restocked" value={data.restockStockValue} colorKey="emerald" indent />
              <StatRow label="(−) Cost of goods sold" value={-data.cogs} colorKey="red" indent />
              <StatRow label="(−) Damaged / loss" value={-data.damagedLoss} colorKey="red" indent />
              <StatRow label="Closing stock" value={data.closingStock} colorKey="purple" total />
              <div className="mt-3">
                <Trend value={data.stockChange} />
              </div>
            </SectionCard>
          </div>

          {/* Accounting Equation */}
          <div className="card p-4 bg-slate-100 dark:bg-slate-800/60">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
              Accounting Equation
            </p>
            <div className="text-sm font-mono text-slate-700 dark:text-slate-300 space-y-1">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-purple-600 dark:text-purple-400 font-bold">{fmt(data.currentCapital)}</span>
                <span>=</span>
                <span className="text-amber-600 dark:text-amber-400">{fmt(data.closingCash)}</span>
                <span>+</span>
                <span className="text-emerald-600 dark:text-emerald-400">{fmt(data.closingStock)}</span>
                {data.creditOutstanding > 0 && (
                  <>
                    <span>−</span>
                    <span className="text-red-500 dark:text-red-400">{fmt(data.creditOutstanding)}</span>
                  </>
                )}
                <span
                  className={
                    Math.abs(data.currentCapital - (data.closingCash + data.closingStock - data.creditOutstanding)) < 1
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-amber-600 dark:text-amber-400 font-bold'
                  }
                >
                  {Math.abs(data.currentCapital - (data.closingCash + data.closingStock - data.creditOutstanding)) < 1 ? '✓ Balanced' : '⚠ Check figures'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
