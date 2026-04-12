import { useState, useEffect } from 'react'
import Modal from '../shared/Modal'
import { productsApi, categoriesApi, suppliersApi } from '../../lib/productsApi'
import { batchesApi } from '../../lib/productsApi'
import { useSettings } from '../../hooks/useSettings'
import type { Product, Category } from '../../types'
import { Plus, Barcode } from 'lucide-react'
import { generateBatchNumber } from '../../utils'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'

interface ProductFormProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  onSaved: () => void
}

const UNITS = ['pcs', 'kg', 'g', 'liter', 'ml', 'box', 'pack', 'dozen', 'meter', 'bottle', 'bag']
const OTHERS = ['others', 'other', 'अन्य']

export default function ProductForm({ isOpen, onClose, product, onSaved }: ProductFormProps) {
  const isEdit = !!product
  const { settings } = useSettings()
  const { user } = useAuthStore()

  const [form, setForm] = useState({
    name: '', brand: '', category_id: '', supplier_name: '',
    selling_price: '', cost_price: '', unit: 'pcs', description: '', stock_adjustment: '', barcode: '',
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [loading, setLoading] = useState(false)
  const [catLoading, setCatLoading] = useState(false)
  const [addingCat, setAddingCat] = useState(false)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [scanMode, setScanMode] = useState(false)

  useBarcodeScanner({
    enabled: scanMode && settings.barcode_scanner_enabled,
    onScan: async (barcode) => {
      if (!barcode.trim()) return
      // Check if barcode is already assigned to a different product
      const existing = allProducts.find(p => p.barcode === barcode && p.id !== product?.id)
      if (existing) {
        toast.error(`Barcode already assigned to: ${existing.name}`)
        return
      }
      set('barcode', barcode)
      toast.success('Barcode scanned!')
      setScanMode(false)
    },
    minLength: 3,
    scanDelay: 50,
  })

  useEffect(() => {
    if (!isOpen) return
    setCatLoading(true)
    Promise.all([
      categoriesApi.getAll(),
      productsApi.getAll(),
    ]).then(([cats, prods]) => {
      setCategories(cats)
      setAllProducts(prods)
    }).catch(() => {}).finally(() => setCatLoading(false))
  }, [isOpen])

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name, brand: product.brand || '',
        category_id: product.category_id || '',
        supplier_name: product.supplier_name || '',
        selling_price: String(product.selling_price),
        cost_price: product.avg_cost ? String(product.avg_cost) : '',
        unit: product.unit || 'pcs', description: product.description || '',
        stock_adjustment: String(product.total_stock || 0),
        barcode: product.barcode || '',
      })
    } else {
      setForm({ name: '', brand: '', category_id: '', supplier_name: '', selling_price: '', cost_price: '', unit: 'pcs', description: '', stock_adjustment: '', barcode: '' })
    }
    setShowNewCat(false); setNewCategory(''); setScanMode(false)
  }, [product, isOpen])

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const sortCats = (cats: Category[]) => {
    const main = cats.filter(c => !OTHERS.includes(c.name.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
    const others = cats.filter(c => OTHERS.includes(c.name.toLowerCase()))
    return [...main, ...others]
  }

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return
    setAddingCat(true)
    try {
      const cat = await categoriesApi.findOrCreate(newCategory)
      setCategories(prev => sortCats([...prev, cat]))
      set('category_id', cat.id)
      setNewCategory(''); setShowNewCat(false)
      toast.success('Category added')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add category')
    } finally { setAddingCat(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) { toast.error('Product name is required'); return }

    // Check for duplicate product name (only when creating new product)
    if (!isEdit) {
      const nameLower = name.toLowerCase()
      const duplicate = allProducts.find(p => p.name.toLowerCase() === nameLower)
      if (duplicate) {
        toast.error(`Product "${duplicate.name}" already exists`)
        return
      }
    }

    setLoading(true)
    try {
      // Resolve supplier if entered
      let resolvedSupplierId: string | null = null
      const supplierName = form.supplier_name.trim()
      if (supplierName) {
        const sup = await suppliersApi.findOrCreate(supplierName)
        resolvedSupplierId = sup.id
      }

      if (isEdit && product) {
        const sellingPrice = parseFloat(form.selling_price)
        if (isNaN(sellingPrice) || sellingPrice < 0) { toast.error('Enter a valid selling price'); setLoading(false); return }
        
        const costPrice = form.cost_price.trim() ? parseFloat(form.cost_price) : undefined
        if (costPrice !== undefined && (isNaN(costPrice) || costPrice < 0)) { toast.error('Enter a valid cost price'); setLoading(false); return }

        await productsApi.update(product.id, {
          name, brand: form.brand.trim() || undefined,
          category_id: form.category_id || null,
          supplier_id: resolvedSupplierId,
          selling_price: sellingPrice,
          cost_price: costPrice,
          unit: form.unit,
          description: form.description.trim() || undefined,
          barcode: form.barcode.trim() || undefined,
        })

        // Absolute stock quantity update — only if the value differs from current
        if (form.stock_adjustment.trim() !== '') {
          const newQty = parseInt(form.stock_adjustment)
          if (isNaN(newQty) || newQty < 0) {
            toast.error('Stock quantity cannot be negative'); setLoading(false); return
          }
          const currentStock = product.total_stock || 0
          if (newQty !== currentStock) {
            if (newQty > currentStock) {
              // Increase: add a batch for the difference
              const diff = newQty - currentStock
              await batchesApi.createBatch({
                product_id: product.id, batch_number: generateBatchNumber(),
                quantity_received: diff, quantity_remaining: diff,
                cost_price: product.avg_cost || 0, received_at: new Date().toISOString(),
                business_id: user?.business_id || '',
              })
            } else {
              // Decrease: deduct from newest batch(es) first
              const { supabase } = await import('../../lib/supabase')
              const allBatches = await batchesApi.getByProduct(product.id)
              const sorted = [...allBatches].sort(
                (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
              )
              let toRemove = currentStock - newQty
              for (const batch of sorted) {
                if (toRemove <= 0) break
                const deduct = Math.min(toRemove, batch.quantity_remaining)
                await supabase
                  .from('inventory_batches')
                  .update({ quantity_remaining: batch.quantity_remaining - deduct })
                  .eq('id', batch.id)
                  .eq('business_id', user?.business_id || '')
                toRemove -= deduct
              }
            }
          }
        }
        toast.success('Product updated')
      } else {
        await productsApi.create({
          name, brand: form.brand.trim() || undefined,
          category_id: form.category_id || null,
          supplier_id: resolvedSupplierId,
          selling_price: 0, unit: 'pcs', is_active: true,
          barcode: form.barcode.trim() || undefined,
        })
        toast.success('Product added — use Restock to set price and stock')
      }

      onSaved(); onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save product')
    } finally { setLoading(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add New Product'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Product Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Rice, Bread, T-Shirt" required autoFocus />
        </div>

        <div>
          <label className="label">Brand</label>
          <input className="input" value={form.brand} onChange={e => set('brand', e.target.value)}
            placeholder="e.g. Unilever, Local" />
        </div>

        {/* Category */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Category</label>
            <button type="button" onClick={() => setShowNewCat(v => !v)}
              className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
              <Plus className="w-3 h-3" /> New
            </button>
          </div>
          {showNewCat ? (
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder="Category name" value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }} autoFocus />
              <button type="button" onClick={handleAddCategory} disabled={addingCat || !newCategory.trim()} className="btn-primary px-3 text-sm">
                {addingCat ? '...' : 'Add'}
              </button>
            </div>
          ) : (
            <select className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)} disabled={catLoading}>
              <option value="">{catLoading ? 'Loading...' : '— Select category —'}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Supplier — available in both add and edit mode */}
        <div>
          <label className="label">Supplier</label>
          <input className="input" type="text" value={form.supplier_name}
            onChange={e => set('supplier_name', e.target.value)}
            placeholder="Type supplier name (auto-creates if new)" />
        </div>

        {/* Barcode — available in both add and edit mode (only if setting is enabled) */}
        {settings.barcode_scanner_enabled && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Barcode (Optional)</label>
              <button type="button" onClick={() => setScanMode(v => !v)}
                className={`text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded ${scanMode ? 'text-primary-400 bg-primary-500/10' : 'text-slate-500 hover:text-primary-400'}`}>
                {scanMode ? '✓ Scan Active' : '📱 Scan to fill'}
              </button>
            </div>
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="input pl-10" type="text" value={form.barcode}
                onChange={e => set('barcode', e.target.value)}
                placeholder="Scan or type barcode..." />
            </div>
          </div>
        )}

        {/* Edit-only fields */}
        {isEdit && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Selling Price (रु)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm">रु</span>
                  <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
                    value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Cost Price (रु)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm">रु</span>
                  <input className="input pl-9 font-mono" type="number" step="0.01" min="0"
                    value={form.cost_price} onChange={e => set('cost_price', e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stock Quantity</label>
              <input className="input font-mono" type="number" min="0" step="1"
                value={form.stock_adjustment} onChange={e => set('stock_adjustment', e.target.value)}
                placeholder="Enter quantity" />
              <p className="text-xs text-slate-500 mt-1">
                This sets stock to the exact value you enter (not additive).
                {form.stock_adjustment !== '' && parseInt(form.stock_adjustment) >= 0 && parseInt(form.stock_adjustment) !== (product?.total_stock || 0) && (
                  <span className="ml-1 text-primary-400">
                    → will change from {product?.total_stock || 0} to {form.stock_adjustment} {product?.unit}
                  </span>
                )}
              </p>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={2} value={form.description}
                onChange={e => set('description', e.target.value)} placeholder="Optional notes" />
            </div>
          </>
        )}

        {!isEdit && (
          <p className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700/30 rounded-lg px-3 py-2">
            After adding, use <span className="text-primary-400 font-medium">Restock</span> to set cost price, selling price, and initial stock.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
