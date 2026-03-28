import { useEffect, useState, useCallback, useMemo } from 'react'
import { expensesApi, damagedApi, testerApi } from '../../lib/expensesApi'
import { productsApi } from '../../lib/productsApi'
import { useAuthStore } from '../../store/authStore'
import type { Expense, DamagedProduct, Product } from '../../types'
import { formatCurrency, formatDate } from '../../utils'
import {
  Plus, Trash2, Edit2, DollarSign, AlertTriangle,
  RefreshCw, X, Check, Package, Calendar, FlaskConical, List
} from 'lucide-react'
import Modal from '../shared/Modal'
import ConfirmDialog from '../shared/ConfirmDialog'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

type Tab = 'expenses' | 'damaged' | 'tester' | 'all'

// Helper: is this expense a tester entry?
const isTester = (exp: Expense) =>
  exp.notes?.startsWith('[TESTER]') || exp.title?.startsWith('Tester:')

export default function ExpensesPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('expenses')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [damaged, setDamaged] = useState<DamagedProduct[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const todayStr = new Date().toISOString().slice(0, 10)
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [filterStart, setFilterStart] = useState(monthStartStr)
  const [filterEnd, setFilterEnd] = useState(todayStr)

  const DATE_PRESETS = [
    { label: 'Today',      start: todayStr, end: todayStr },
    { label: 'This Week',  start: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), end: todayStr },
    { label: 'This Month', start: monthStartStr, end: todayStr },
  ]

  const [showExpForm, setShowExpForm] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [expForm, setExpForm] = useState({ title: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' })
  const [expLoading, setExpLoading] = useState(false)

  const [showDmgForm, setShowDmgForm] = useState(false)
  const [dmgForm, setDmgForm] = useState({ product_id: '', product_name: '', quantity: '1', cost_price: '', damage_date: new Date().toISOString().slice(0, 10), notes: '' })
  const [dmgLoading, setDmgLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'expenses' | 'damaged' } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [showTesterForm, setShowTesterForm] = useState(false)
  const [testerForm, setTesterForm] = useState({
    product_id: '', product_name: '', quantity: '1',
    cost_price: '', tester_date: new Date().toISOString().slice(0, 10), notes: '',
  })
  const [testerLoading, setTesterLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [exp, dmg, prods] = await Promise.all([
        expensesApi.getAll(filterStart, filterEnd),
        damagedApi.getAll(filterStart, filterEnd),
        productsApi.getAll(),
      ])
      setExpenses(exp)
      setDamaged(dmg)
      setProducts(prods)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [filterStart, filterEnd])

  useEffect(() => { load() }, [load])

  const normalExpenses = useMemo(() => expenses.filter(e => !isTester(e)), [expenses])
  const testerExpenses = useMemo(() => expenses.filter(e => isTester(e)), [expenses])

  const cleanNotes = (notes: string | null | undefined) => {
    if (!notes) return '—'
    return notes.replace(/^\[TESTER\]\s*/, '') || '—'
  }

  const totalExpenses = useMemo(() => normalExpenses.reduce((s, e) => s + e.amount, 0), [normalExpenses])
  const totalDamages  = useMemo(() => damaged.reduce((s, d) => s + d.loss_amount, 0), [damaged])
  const totalTesters  = useMemo(() => testerExpenses.reduce((s, e) => s + e.amount, 0), [testerExpenses])
  const totalAll      = useMemo(() => totalExpenses + totalDamages + totalTesters, [totalExpenses, totalDamages, totalTesters])

  const openAddExpense = () => {
    setEditExpense(null)
    setExpForm({ title: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' })
    setShowExpForm(true)
  }
  const openEditExpense = (e: Expense) => {
    setEditExpense(e)
    setExpForm({ title: e.title, amount: String(e.amount), expense_date: e.expense_date.slice(0, 10), notes: e.notes || '' })
    setShowExpForm(true)
  }

  const handleSaveExpense = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const title = expForm.title.trim()
    const amount = parseFloat(expForm.amount)
    if (!title || isNaN(amount) || amount <= 0) { toast.error('Title and valid amount required'); return }
    setExpLoading(true)
    try {
      if (editExpense) {
        await expensesApi.update(editExpense.id, { title, amount, expense_date: expForm.expense_date, notes: expForm.notes || undefined })
        toast.success('Expense updated')
      } else {
        await expensesApi.create({ title, amount, expense_date: expForm.expense_date, notes: expForm.notes || undefined, created_by: user?.id })
        toast.success('Expense added')
      }
      setShowExpForm(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setExpLoading(false) }
  }

  const handleProductSelect = (productId: string) => {
    const p = products.find(pr => pr.id === productId)
    if (p) {
      setDmgForm(f => ({ ...f, product_id: p.id, product_name: p.name, cost_price: String(p.avg_cost || '') }))
    } else {
      setDmgForm(f => ({ ...f, product_id: '', product_name: '' }))
    }
  }

  const handleSaveDamaged = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const qty = parseInt(dmgForm.quantity)
    const cost = parseFloat(dmgForm.cost_price)
    const name = dmgForm.product_name.trim()
    if (!name || qty <= 0 || isNaN(cost) || cost < 0) { toast.error('Product name, quantity, and cost price required'); return }
    setDmgLoading(true)
    try {
      await damagedApi.create({
        product_id: dmgForm.product_id || null,
        product_name: name, quantity: qty, cost_price: cost,
        damage_date: dmgForm.damage_date, notes: dmgForm.notes || undefined, created_by: user?.id,
      })
      toast.success('Damage recorded')
      setShowDmgForm(false)
      setDmgForm({ product_id: '', product_name: '', quantity: '1', cost_price: '', damage_date: new Date().toISOString().slice(0, 10), notes: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to record')
    } finally { setDmgLoading(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'expenses') await expensesApi.delete(deleteTarget.id)
      else await damagedApi.delete(deleteTarget.id)
      toast.success('Deleted')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  const handleTesterProductSelect = (productId: string) => {
    const p = products.find(pr => pr.id === productId)
    if (p) {
      setTesterForm(f => ({ ...f, product_id: p.id, product_name: p.name, cost_price: String(p.avg_cost || '') }))
    } else {
      setTesterForm(f => ({ ...f, product_id: '', product_name: '' }))
    }
  }

  const handleSaveTester = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const qty  = parseInt(testerForm.quantity)
    const cost = parseFloat(testerForm.cost_price)
    const name = testerForm.product_name.trim()
    if (!testerForm.product_id) { toast.error('Select a product from inventory'); return }
    if (!name || qty <= 0)       { toast.error('Product and quantity are required'); return }
    if (isNaN(cost) || cost < 0) { toast.error('Cost price is required'); return }
    setTesterLoading(true)
    try {
      await testerApi.create({
        product_id: testerForm.product_id, product_name: name, quantity: qty,
        cost_price: cost, tester_date: testerForm.tester_date,
        notes: testerForm.notes || undefined, created_by: user?.id,
      })
      toast.success(`Tester recorded — ${qty} units deducted from stock`)
      setShowTesterForm(false)
      setTesterForm({ product_id: '', product_name: '', quantity: '1', cost_price: '', tester_date: new Date().toISOString().slice(0, 10), notes: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to record tester')
    } finally { setTesterLoading(false) }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses & Damages</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track business expenses, damaged stock, and tester products</p>
        </div>
        {tab !== 'all' && (
          <button
            onClick={() => {
              if (tab === 'expenses') openAddExpense()
              else if (tab === 'damaged') setShowDmgForm(true)
              else if (tab === 'tester') setShowTesterForm(true)
            }}
            className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {tab === 'expenses' ? 'Add Expense' : tab === 'damaged' ? 'Record Damage' : 'Record Tester'}
          </button>
        )}
      </div>

      {/* Date filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
            <input type="date" className="input" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
          </div>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Apply
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {DATE_PRESETS.map(p => (
            <button key={p.label}
              onClick={() => { setFilterStart(p.start); setFilterEnd(p.end) }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                filterStart === p.start && filterEnd === p.end ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => { setFilterStart(''); setFilterEnd('') }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            All Time
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">Expenses</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-slate-500 mt-1">{normalExpenses.length} records</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">Damage Loss</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{formatCurrency(totalDamages)}</p>
          <p className="text-xs text-slate-500 mt-1">{damaged.length} records</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">Tester Cost</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{formatCurrency(totalTesters)}</p>
          <p className="text-xs text-slate-500 mt-1">{testerExpenses.length} records</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-500/10 rounded-xl flex items-center justify-center">
              <List className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">Total Outflow</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{formatCurrency(totalAll)}</p>
          <p className="text-xs text-slate-500 mt-1">{normalExpenses.length + damaged.length + testerExpenses.length} records</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
        {([
          { id: 'expenses', label: 'Expenses' },
          { id: 'damaged',  label: 'Damaged Products' },
          { id: 'tester',   label: 'Tester Products' },
          { id: 'all',      label: 'All Expenses' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><LoadingSpinner text="Loading..." /></div>
      ) : tab === 'expenses' ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
            <h2 className="text-base font-semibold text-white">Expenses</h2>
            <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700/40 bg-slate-800/40">
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Notes</th>
                  <th className="text-right px-5 py-3">Amount</th>
                  <th className="text-center px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {normalExpenses.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-500 text-sm">No expenses recorded yet</td></tr>
                ) : normalExpenses.map(exp => (
                  <tr key={exp.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-200 text-sm">{exp.title}</td>
                    <td className="px-5 py-3 text-sm text-slate-400">{formatDate(exp.expense_date)}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{exp.notes || '—'}</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-red-400">{formatCurrency(exp.amount)}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEditExpense(exp)} className="p-1.5 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteTarget({ id: exp.id, type: 'expenses' })} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {normalExpenses.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-800/60">
                    <td colSpan={3} className="px-5 py-3 font-semibold text-slate-300">Total</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-red-400 text-base">{formatCurrency(totalExpenses)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : tab === 'damaged' ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
            <h2 className="text-base font-semibold text-white">Damaged Products</h2>
            <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700/40 bg-slate-800/40">
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-right px-5 py-3">Qty</th>
                  <th className="text-right px-5 py-3">Cost/Unit</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Notes</th>
                  <th className="text-right px-5 py-3">Loss</th>
                  <th className="text-center px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {damaged.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">No damaged products recorded</td></tr>
                ) : damaged.map(d => (
                  <tr key={d.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-200 text-sm">{d.product_name}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">{d.quantity}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">{formatCurrency(d.cost_price)}</td>
                    <td className="px-5 py-3 text-sm text-slate-400">{formatDate(d.damage_date)}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{d.notes || '—'}</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-amber-400">{formatCurrency(d.loss_amount)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => setDeleteTarget({ id: d.id, type: 'damaged' })} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {damaged.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-800/60">
                    <td colSpan={5} className="px-5 py-3 font-semibold text-slate-300">Total Loss</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-amber-400 text-base">{formatCurrency(totalDamages)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : tab === 'tester' ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
            <h2 className="text-base font-semibold text-white">Tester Products</h2>
            <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700/40 bg-slate-800/40">
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Notes</th>
                  <th className="text-right px-5 py-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {testerExpenses.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-slate-500 text-sm">No tester products recorded yet</td></tr>
                ) : testerExpenses.map(exp => (
                  <tr key={exp.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-200 text-sm">{exp.title.replace(/^Tester:\s*/, '')}</td>
                    <td className="px-5 py-3 text-sm text-slate-400">{formatDate(exp.expense_date)}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{cleanNotes(exp.notes)}</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-violet-400">{formatCurrency(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
              {testerExpenses.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-800/60">
                    <td colSpan={3} className="px-5 py-3 font-semibold text-slate-300">Total Tester Cost</td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-violet-400 text-base">{formatCurrency(totalTesters)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* ALL EXPENSES TAB */
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
            <h2 className="text-base font-semibold text-white">All Expenses</h2>
            <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700/40 bg-slate-800/40">
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Title / Product</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Notes</th>
                  <th className="text-right px-5 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(normalExpenses.length + damaged.length + testerExpenses.length) === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-500 text-sm">No records found</td></tr>
                ) : (
                  <>
                    {normalExpenses.map(exp => (
                      <tr key={`exp-${exp.id}`} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3"><span className="badge bg-red-500/15 text-red-400 border border-red-500/30 text-xs">Expense</span></td>
                        <td className="px-5 py-3 font-medium text-slate-200 text-sm">{exp.title}</td>
                        <td className="px-5 py-3 text-sm text-slate-400">{formatDate(exp.expense_date)}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{exp.notes || '—'}</td>
                        <td className="px-5 py-3 text-right font-bold font-mono text-red-400">{formatCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                    {damaged.map(d => (
                      <tr key={`dmg-${d.id}`} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3"><span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs">Damaged</span></td>
                        <td className="px-5 py-3 font-medium text-slate-200 text-sm">{d.product_name}</td>
                        <td className="px-5 py-3 text-sm text-slate-400">{formatDate(d.damage_date)}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{d.notes || '—'}</td>
                        <td className="px-5 py-3 text-right font-bold font-mono text-amber-400">{formatCurrency(d.loss_amount)}</td>
                      </tr>
                    ))}
                    {testerExpenses.map(exp => (
                      <tr key={`tst-${exp.id}`} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3"><span className="badge bg-violet-500/15 text-violet-400 border border-violet-500/30 text-xs">Tester</span></td>
                        <td className="px-5 py-3 font-medium text-slate-200 text-sm">{exp.title.replace(/^Tester:\s*/, '')}</td>
                        <td className="px-5 py-3 text-sm text-slate-400">{formatDate(exp.expense_date)}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{cleanNotes(exp.notes)}</td>
                        <td className="px-5 py-3 text-right font-bold font-mono text-violet-400">{formatCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {(normalExpenses.length + damaged.length + testerExpenses.length) > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-800/60">
                    <td colSpan={4} className="px-5 py-3 font-semibold text-slate-300">
                      Total Outflow
                      <span className="text-slate-500 font-normal text-xs ml-2">
                        ({normalExpenses.length} expenses · {damaged.length} damaged · {testerExpenses.length} testers)
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold font-mono text-white text-base">{formatCurrency(totalAll)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      <Modal isOpen={showExpForm} onClose={() => setShowExpForm(false)} title={editExpense ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="e.g. Rent, Salary, Electricity" value={expForm.title}
              onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (रु) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
                <input className="input pl-9 font-mono" type="number" step="0.01" min="0.01"
                  value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" required />
              </div>
            </div>
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" value={expForm.expense_date}
                onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" placeholder="Optional notes" value={expForm.notes}
              onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowExpForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={expLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {expLoading ? '...' : <><Check className="w-4 h-4" /> {editExpense ? 'Update' : 'Add Expense'}</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Damaged Form Modal */}
      <Modal isOpen={showDmgForm} onClose={() => setShowDmgForm(false)} title="Record Damaged Product">
        <form onSubmit={handleSaveDamaged} className="space-y-4">
          <div>
            <label className="label">Product</label>
            <select className="input" value={dmgForm.product_id} onChange={e => handleProductSelect(e.target.value)}>
              <option value="">— Select from inventory (or type below) —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Product Name *</label>
            <input className="input" placeholder="Product name" value={dmgForm.product_name}
              onChange={e => setDmgForm(f => ({ ...f, product_name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Quantity *</label>
              <input className="input font-mono" type="number" min="1" step="1"
                value={dmgForm.quantity} onChange={e => setDmgForm(f => ({ ...f, quantity: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Cost/Unit (रु) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
                <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
                  value={dmgForm.cost_price} onChange={e => setDmgForm(f => ({ ...f, cost_price: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" value={dmgForm.damage_date}
                onChange={e => setDmgForm(f => ({ ...f, damage_date: e.target.value }))} required />
            </div>
          </div>
          {dmgForm.quantity && dmgForm.cost_price && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-300">
                  Loss: <strong className="font-mono">{formatCurrency((parseInt(dmgForm.quantity) || 0) * (parseFloat(dmgForm.cost_price) || 0))}</strong>
                </span>
              </div>
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <input className="input" placeholder="Reason, details..." value={dmgForm.notes}
              onChange={e => setDmgForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowDmgForm(false)} className="btn-secondary flex-1">
              <X className="w-4 h-4 inline mr-1" /> Cancel
            </button>
            <button type="submit" disabled={dmgLoading} className="btn-danger flex-1">
              {dmgLoading ? '...' : 'Record Damage'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Record" message="Delete this record permanently? This cannot be undone."
        confirmLabel="Delete" danger loading={deleting} />

      {/* Tester Product Modal */}
      <Modal isOpen={showTesterForm} onClose={() => setShowTesterForm(false)} title="Record Tester Product">
        <form onSubmit={handleSaveTester} className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs text-amber-300">
            <FlaskConical className="w-4 h-4 inline mr-1.5 mb-0.5" />
            Records product used internally. Stock is deducted and cost is logged as an expense.
          </div>
          <div>
            <label className="label">Product *</label>
            <select className="input" value={testerForm.product_id}
              onChange={e => handleTesterProductSelect(e.target.value)} required autoFocus>
              <option value="">— Select from inventory —</option>
              {products.filter(p => (p.total_stock || 0) > 0).map(p => (
                <option key={p.id} value={p.id}>{p.name} (Stock: {p.total_stock} {p.unit})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Quantity *</label>
              <input className="input font-mono" type="number" min="1" step="1"
                value={testerForm.quantity} onChange={e => setTesterForm(f => ({ ...f, quantity: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Cost / Unit (रु) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
                <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
                  value={testerForm.cost_price} onChange={e => setTesterForm(f => ({ ...f, cost_price: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" value={testerForm.tester_date}
                onChange={e => setTesterForm(f => ({ ...f, tester_date: e.target.value }))} required />
            </div>
          </div>
          {testerForm.quantity && testerForm.cost_price && (
            <div className="bg-slate-700/40 rounded-lg px-4 py-3 flex justify-between text-sm">
              <span className="text-slate-400">Expense to record</span>
              <span className="font-mono font-bold text-amber-400">
                {formatCurrency((parseInt(testerForm.quantity) || 0) * (parseFloat(testerForm.cost_price) || 0))}
              </span>
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <input className="input" placeholder="Purpose, event, etc." value={testerForm.notes}
              onChange={e => setTesterForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowTesterForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={testerLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {testerLoading ? '...' : <><FlaskConical className="w-4 h-4" /> Record Tester</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
