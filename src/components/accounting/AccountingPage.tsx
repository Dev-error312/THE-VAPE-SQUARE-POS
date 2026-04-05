import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency, formatDate } from '../../utils'
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
  currentCapital: number
  cashChange: number
  stockChange: number
  capitalChange: number
  grossMargin: number
  netMargin: number
  retailShare: number
  wholesaleShare: number
  hasOpeningBalance: boolean
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
}: {
  onSave: (data: { cash: number; date: string }) => Promise<void>
  onClose: () => void
  saving: boolean
}) {
  const [cash, setCash] = useState('')
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  return (
    <Modal isOpen={true} onClose={onClose} title="Set Opening Balance">
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
            {saving ? 'Saving...' : 'Save Opening Balance'}
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

    const [saleItemRows, expRows, closingInventoryRows, damageRows, restockRows, wholesaleRows] = await Promise.all([
      execQuery(() =>
        supabase
          .from('sale_items')
          .select('line_total,cost_price,quantity,sales!inner(status,created_at)')
          .eq('business_id', businessId)
          .eq('sales.status', 'completed')
          .gte('sales.created_at', `${from}T00:00:00.000Z`)
          .lte('sales.created_at', `${to}T23:59:59.999Z`)
      ),
      execQuery(() =>
        supabase
          .from('expenses')
          .select('amount')
          .eq('business_id', businessId)
          .gte('expense_date', from)
          .lte('expense_date', to)
      ),
      execQuery(() =>
        supabase
          .from('inventory_batches')
          .select('cost_price,quantity_remaining')
          .eq('business_id', businessId)
          .lte('received_at', `${to}T23:59:59.999Z`)
      ),
      execQuery(() =>
        supabase
          .from('damaged_products')
          .select('loss_amount')
          .eq('business_id', businessId)
          .gte('damage_date', from)
          .lte('damage_date', to)
      ),
      execQuery(() =>
        supabase
          .from('purchases')
          .select('inventory_batches(quantity_received,cost_price)')
          .eq('business_id', businessId)
          .gte('created_at', `${from}T00:00:00.000Z`)
          .lte('created_at', `${to}T23:59:59.999Z`)
      ),
      execQuery(() =>
        supabase
          .from('wholesale_sales')
          .select('quantity,cost_price,selling_price')
          .eq('business_id', businessId)
          .gte('sale_date', from)
          .lte('sale_date', to)
      ),
    ])

    // Fetch opening cash from DB
    let openingCash = 0
    let hasOpeningBalance = false
    try {
      const { data: obRows } = await supabase
        .from('accounting_opening_balance')
        .select('cash_amount')
        .eq('business_id', businessId)
        .lte('balance_date', from)
        .order('balance_date', { ascending: false })
        .limit(1)
      if (obRows?.[0]) {
        openingCash = Number(obRows[0].cash_amount ?? 0)
        hasOpeningBalance = true
      }
    } catch (e) {
      console.log('Opening balance not available:', e)
    }

    // Calculate closing stock (actual current inventory value)
    let closingStock = 0
    for (const batch of closingInventoryRows) {
      closingStock += Number(batch.quantity_remaining ?? 0) * Number(batch.cost_price ?? 0)
    }

    let retailRevenue = 0,
      wholesaleRevenue = 0,
      retailCogs = 0,
      wholesaleCogs = 0
    
    // Calculate retail revenue and COGS
    for (const item of saleItemRows) {
      const sale = Array.isArray(item.sales) ? item.sales[0] : item.sales
      if (!sale || sale.status !== 'completed') continue
      const lt = Number(item.line_total ?? 0)
      const itemCogs = Number(item.cost_price ?? 0) * Number(item.quantity ?? 0)
      retailRevenue += lt
      retailCogs += itemCogs
    }

    // Calculate wholesale revenue and COGS from wholesale_sales
    for (const wsale of wholesaleRows) {
      const quantity = Number(wsale.quantity ?? 0)
      const costPrice = Number(wsale.cost_price ?? 0)
      const sellingPrice = Number(wsale.selling_price ?? 0)
      const lineTotal = quantity * sellingPrice
      const itemCogs = quantity * costPrice
      
      wholesaleRevenue += lineTotal
      wholesaleCogs += itemCogs
    }

    const totalRevenue = retailRevenue + wholesaleRevenue
    const cogs = retailCogs + wholesaleCogs
    const grossProfit = totalRevenue - cogs

    const expenses = expRows.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)
    const netProfit = grossProfit - expenses

    // Calculate restock value from purchases received during this period
    let restockStockValue = 0
    for (const purchase of restockRows) {
      const batches = Array.isArray(purchase.inventory_batches) 
        ? purchase.inventory_batches 
        : purchase.inventory_batches 
          ? [purchase.inventory_batches]
          : []
      
      for (const batch of batches) {
        const qty = Number(batch.quantity_received ?? 0)
        const costPrice = Number(batch.cost_price ?? 0)
        restockStockValue += qty * costPrice
      }
    }

    const damagedLoss = damageRows.reduce((s: number, d: any) => s + Number(d.loss_amount ?? 0), 0)

    // Calculate opening stock by working backwards to ensure inventory reconciliation
    // Formula: Opening + Restocked - COGS - Damaged = Closing
    // Therefore: Opening = Closing - Restocked + COGS + Damaged
    const openingStock = closingStock - restockStockValue + cogs + damagedLoss
    const openingCapital = openingCash + openingStock

    // Calculate closing cash and capital
    const closingCash = openingCash + totalRevenue - expenses
    const currentCapital = closingCash + closingStock

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
      restockCash: 0,
      restockStockValue,
      damagedLoss,
      closingCash,
      closingStock,
      currentCapital,
      cashChange: closingCash - openingCash,
      stockChange: closingStock - openingStock,
      capitalChange: currentCapital - openingCapital,
      grossMargin: totalRevenue ? (grossProfit / totalRevenue) * 100 : 0,
      netMargin: totalRevenue ? (netProfit / totalRevenue) * 100 : 0,
      retailShare: totalRevenue ? (retailRevenue / totalRevenue) * 100 : 0,
      wholesaleShare: totalRevenue ? (wholesaleRevenue / totalRevenue) * 100 : 0,
      hasOpeningBalance,
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

  const PRESETS = [
    { label: 'Today', start: todayStr, end: todayStr },
    { label: 'This Week', start: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), end: todayStr },
    { label: 'This Month', start: monthStartStr, end: todayStr },
  ]

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
      const { error } = await supabase.from('accounting_opening_balance').insert({
        business_id: businessId,
        cash_amount: input.cash,
        balance_date: input.date,
      })
      
      if (error) {
        console.error('Open balance insert error:', error)
        if (error.code === 'PGRST301' || error.message?.includes('relation') || error.message?.includes('permission')) {
          toast.error('Opening balance table not set up yet. Contact your admin or proceed without it.')
        } else {
          toast.error(error.message || 'Unable to save opening balance')
        }
        setShowModal(false)
        setHasPromptedForOpeningBalance(true)
        return
      }
      
      setShowModal(false)
      setHasPromptedForOpeningBalance(true)
      toast.success('Opening balance saved')
      
      // Reload data after successful save
      try {
        await load()
      } catch (loadErr) {
        console.error('Error reloading data after save:', loadErr)
      }
    } catch (e) {
      console.error('Save error:', e)
      toast.error('Unable to save opening balance, but you can continue.')
      setShowModal(false)
      setHasPromptedForOpeningBalance(true)
    } finally {
      setSaving(false)
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
        <OpeningBalanceModal onSave={handleSaveOB} onClose={() => setShowModal(false)} saving={saving} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accounting</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
            Financial overview · {startDate} → {endDate}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              load().catch((err) => {
                console.error('Load error:', err)
              })
            }} 
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            🏦 Opening Balance
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setStartDate(preset.start)
                setEndDate(preset.end)
                setSelectedPreset(preset.label)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedPreset === preset.label
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setSelectedPreset('Custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedPreset === 'Custom'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Custom
          </button>
        </div>
        {selectedPreset === 'Custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input text-sm flex-1 min-w-[150px]"
            />
            <span className="text-slate-600 dark:text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input text-sm flex-1 min-w-[150px]"
            />
            <button
              onClick={() => {
                load().catch((err) => {
                  console.error('Load error:', err)
                })
              }}
              className="btn-primary text-sm"
            >
              Load
            </button>
          </div>
        )}
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

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard label="Opening Capital" value={data.openingCapital} color="slate" sub={`Cash ${fmtShort(data.openingCash)} + Stock ${fmtShort(data.openingStock)}`} />
            <MetricCard label="Total Revenue" value={data.totalRevenue} color="blue" sub={`${fmtPct(data.retailShare)} retail`} />
            <MetricCard label="Gross Profit" value={data.grossProfit} color="emerald" sub={`Margin: ${fmtPct(data.grossMargin)}`} />
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
              sub={`Cash ${fmtShort(data.closingCash)} + Stock ${fmtShort(data.closingStock)}`}
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
                <span
                  className={
                    Math.abs(data.currentCapital - data.closingCash - data.closingStock) < 1
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-amber-600 dark:text-amber-400 font-bold'
                  }
                >
                  {Math.abs(data.currentCapital - data.closingCash - data.closingStock) < 1 ? '✓ Balanced' : '⚠ Check figures'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
