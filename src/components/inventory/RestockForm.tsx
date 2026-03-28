import { useState, useEffect } from 'react'
import Modal from '../shared/Modal'
import { batchesApi, purchasesApi } from '../../lib/productsApi'
import type { Product } from '../../types'
import { generateBatchNumber, formatCurrency } from '../../utils'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'

interface RestockFormProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  onRestocked: () => void
}

const PAYMENT_TYPES = [
  { id: 'full',    label: 'Full Payment', desc: 'Paid now' },
  { id: 'credit',  label: 'Credit',       desc: 'Pay later' },
  { id: 'partial', label: 'Partial',      desc: 'Part now' },
] as const

type FormState = {
  quantity: string
  cost_price: string
  selling_price: string
  payment_type: 'full' | 'credit' | 'partial'
  paid_amount: string
  notes: string
  received_at: string
}

const RESET = (product: Product): FormState => ({
  quantity: '',
  cost_price: '',
  selling_price: String(product.selling_price || ''),
  payment_type: 'full',
  paid_amount: '',
  notes: '',
  received_at: new Date().toISOString().slice(0, 10),
})

export default function RestockForm({ isOpen, onClose, product, onRestocked }: RestockFormProps) {
  const { user } = useAuthStore()
  const [form, setForm] = useState<FormState>(RESET(product))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) setForm(RESET(product))
  }, [isOpen, product])

  const set = (field: string, value: string | number) => setForm(f => ({ ...f, [field]: value }))

  const qty        = parseInt(form.quantity) || 0
  const cost       = parseFloat(form.cost_price) || 0
  const sellPrice  = parseFloat(form.selling_price) || 0
  const totalCost  = qty * cost
  const paidAmount =
    form.payment_type === 'full'   ? totalCost :
    form.payment_type === 'credit' ? 0 :
    Math.min(parseFloat(form.paid_amount) || 0, totalCost)
  const remaining  = totalCost - paidAmount
  const margin     = cost > 0 && sellPrice > 0
    ? ((sellPrice - cost) / sellPrice) * 100 : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (qty <= 0) { toast.error('Quantity must be greater than 0'); return }
    if (cost < 0) { toast.error('Cost price cannot be negative'); return }
    if (sellPrice <= 0) { toast.error('Selling price must be greater than 0'); return }
    if (sellPrice < cost) { toast.error('Selling price should not be less than cost price'); return }
    if (form.payment_type === 'partial') {
      const paid = parseFloat(form.paid_amount) || 0
      if (paid <= 0) { toast.error('Enter the amount paid now'); return }
      if (paid >= totalCost) { toast.error('Partial amount must be less than total'); return }
    }

    setLoading(true)
    try {
      // 1. Update product selling price if changed
      if (sellPrice !== product.selling_price) {
        const { productsApi } = await import('../../lib/productsApi')
        await productsApi.update(product.id, { selling_price: sellPrice })
      }

      // 2. Create inventory batch
      const batch = await batchesApi.createBatch({
        product_id:         product.id,
        batch_number:       generateBatchNumber(),
        quantity_received:  qty,
        quantity_remaining: qty,
        cost_price:         cost,
        supplier_id:        product.supplier_id || null,
        notes:              form.notes.trim() || undefined,
        received_at:        new Date(form.received_at).toISOString(),
      })

      // 3. Record purchase
      await purchasesApi.create({
        supplier_id:  product.supplier_id || null,
        product_id:   product.id,
        batch_id:     batch.id,
        quantity:     qty,
        total_amount: totalCost,
        paid_amount:  paidAmount,
        payment_type: form.payment_type,
        notes:        form.notes.trim() || undefined,
        created_by:   user?.id,
      })

      toast.success(`Restocked ${qty} ${product.unit} of "${product.name}"`)
      onRestocked()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Restock failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Restock Product" size="lg">
      {/* Product banner */}
      <div className="mb-4 p-3 bg-slate-700/40 rounded-xl border border-slate-700/50 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{product.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Current stock: <span className="text-white font-medium">{product.total_stock || 0} {product.unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Current price</p>
          <p className="text-sm font-bold text-primary-400 font-mono">{formatCurrency(product.selling_price)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quantity + Cost Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Quantity *</label>
            <input className="input font-mono" type="number" min="1" step="1"
              value={form.quantity} onChange={e => set('quantity', e.target.value)}
              placeholder="0" required autoFocus />
          </div>
          <div>
            <label className="label">Cost Price / {product.unit} (रु) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
              <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
                value={form.cost_price} onChange={e => set('cost_price', e.target.value)}
                placeholder="0" required />
            </div>
          </div>
        </div>

        {/* Selling Price */}
        <div>
          <label className="label">Selling Price / {product.unit} (रु) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
            <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
              value={form.selling_price} onChange={e => set('selling_price', e.target.value)}
              placeholder="0" required />
          </div>
          <p className="text-xs text-slate-500 mt-1">This will update the product's selling price.</p>
        </div>

        {/* Payment Type */}
        <div>
          <label className="label">Payment Type</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_TYPES.map(pt => (
              <button key={pt.id} type="button"
                onClick={() => set('payment_type', pt.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  form.payment_type === pt.id
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-slate-700/40 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}>
                <p className="text-xs font-bold leading-tight">{pt.label}</p>
                <p className="text-xs opacity-70 mt-0.5 leading-tight">{pt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Partial: amount paid now */}
        {form.payment_type === 'partial' && (
          <div>
            <label className="label">Amount Paid Now (रु)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">रु</span>
              <input className="input pl-9 font-mono" type="number" step="0.01" min="0.01"
                max={totalCost > 0 ? totalCost - 0.01 : undefined}
                value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)}
                placeholder="0" />
            </div>
          </div>
        )}

        {/* Date + Notes */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Received Date</label>
            <input className="input" type="date" value={form.received_at}
              onChange={e => set('received_at', e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Invoice #, etc." />
          </div>
        </div>

        {/* Preview */}
        {qty > 0 && (
          <div className="bg-slate-700/40 rounded-xl p-3 grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Total Cost</p>
              <p className="text-sm font-bold text-white font-mono">{formatCurrency(totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Paid Now</p>
              <p className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(paidAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Remaining</p>
              <p className={`text-sm font-bold font-mono ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatCurrency(remaining)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Margin</p>
              <p className={`text-sm font-bold ${margin !== null && margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {margin !== null ? `${margin.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading || qty <= 0} className="btn-primary flex-1">
            {loading ? 'Processing...' : `Restock ${qty > 0 ? qty + ' ' + product.unit : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
