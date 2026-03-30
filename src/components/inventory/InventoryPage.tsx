import { useEffect, useState, useCallback, useMemo } from 'react'
import { productsApi, categoriesApi, suppliersApi } from '../../lib/productsApi'
import { useIsAdmin } from '../../hooks/useRole'
import type { Product, Category, Supplier } from '../../types'
import { formatCurrency } from '../../utils'
import {
  Plus, Search, RefreshCw, Edit2, Trash2, Package,
  TrendingUp, AlertTriangle, Archive, ChevronUp, ChevronDown
} from 'lucide-react'
import ProductForm from './ProductForm'
import RestockForm from './RestockForm'
import ConfirmDialog from '../shared/ConfirmDialog'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

type SortKey = 'name' | 'category_name' | 'supplier_name' | 'total_stock' | 'avg_cost' | 'selling_price'
type SortDir = 'asc' | 'desc'

export default function InventoryPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('name')
  const [sortDir, setSortDir]       = useState<SortDir>('asc')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showRestockForm, setShowRestockForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = useIsAdmin()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats, sups] = await Promise.all([
        productsApi.getAll(),
        categoriesApi.getAll(),
        suppliersApi.getAll(),
      ])
      setProducts(prods); setCategories(cats); setSuppliers(sups)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load inventory')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products
      .filter(p => {
        const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)
        const matchCat    = !categoryFilter || p.category_id === categoryFilter
        const matchSup    = !supplierFilter || p.supplier_id === supplierFilter
        return matchSearch && matchCat && matchSup
      })
      .sort((a, b) => {
        let av: string | number = a[sortKey] ?? ''
        let bv: string | number = b[sortKey] ?? ''
        if (typeof av === 'string') av = av.toLowerCase()
        if (typeof bv === 'string') bv = bv.toLowerCase()
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
  }, [products, search, categoryFilter, supplierFilter, sortKey, sortDir])

  const totals = useMemo(() => {
    const qty        = filtered.reduce((s, p) => s + (p.total_stock || 0), 0)
    const stockValue = filtered.reduce((s, p) => s + (p.total_stock || 0) * (p.avg_cost || 0), 0)
    const sellValue  = filtered.reduce((s, p) => s + (p.total_stock || 0) * p.selling_price, 0)
    const potProfit  = sellValue - stockValue
    return { qty, stockValue, sellValue, potProfit }
  }, [filtered])

  const handleDelete = async () => {
    if (!selectedProduct) return
    setDeleting(true)
    try {
      await productsApi.delete(selectedProduct.id)
      toast.success('Product archived'); load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive')
    } finally { setDeleting(false); setShowDeleteConfirm(false); setSelectedProduct(null) }
  }

  const stockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', cls: 'bg-red-500/15 text-red-400 border border-red-500/30' }
    if (stock < 10)  return { label: 'Low Stock',    cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' }
    return { label: 'In Stock', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' }
  }

  const stats = useMemo(() => ({
    total:      products.length,
    inStock:    products.filter(p => (p.total_stock || 0) >= 10).length,
    lowStock:   products.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) < 10).length,
    outOfStock: products.filter(p => (p.total_stock || 0) === 0).length,
  }), [products])

  const SortIcon = ({ k }: { k: SortKey }) => (
    sortKey === k
      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : <ChevronUp className="w-3 h-3 opacity-20" />
  )

  const Th = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <th onClick={() => handleSort(k)}
      className={`px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none transition-colors whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      <span className="inline-flex items-center gap-1">{label} <SortIcon k={k} /></span>
    </th>
  )

  // Column count changes based on role (for colSpan calculations)
  // Admin:   Name, Brand, Category, Supplier, Stock, Cost, StockValue, SellPrice, Status, Actions = 10
  // Cashier: Name, Brand, Category,           Stock,                   SellPrice, Status, Actions = 7
  const colCount = isAdmin ? 10 : 7

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Manage products and stock levels</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setSelectedProduct(null); setShowProductForm(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Products', value: stats.total,      icon: Package,       color: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: 'In Stock',       value: stats.inStock,    icon: TrendingUp,    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Low Stock',      value: stats.lowStock,   icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10' },
          { label: 'Out of Stock',   value: stats.outOfStock, icon: Archive,       color: 'text-red-400',     bg: 'bg-red-500/10' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{s.value}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-400" />
          <input className="input pl-9" placeholder="Search name or brand..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-44" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isAdmin && (
          <select className="input sm:w-44" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button onClick={load} className="btn-secondary flex items-center gap-2 flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Loading inventory..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800/50">
                <tr>
                  <Th label="Product Name" k="name" />
                  <Th label="Brand"        k="name" />
                  <Th label="Category"     k="category_name" />
                  {isAdmin && <Th label="Supplier"   k="supplier_name" />}
                  <Th label="Stock"        k="total_stock"   right />
                  {isAdmin && <Th label="Cost Price" k="avg_cost"      right />}
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      Stock Value
                    </th>
                  )}
                  <Th label="Selling Price" k="selling_price" right />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="text-center py-16 text-slate-500">
                      <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">
                        {search || categoryFilter || supplierFilter
                          ? 'No products match your filters'
                          : 'No products yet. Add your first product!'}
                      </p>
                    </td>
                  </tr>
                ) : filtered.map(product => {
                  const stock      = product.total_stock || 0
                  const costPrice  = product.avg_cost || 0
                  const stockValue = stock * costPrice
                  const status     = stockStatus(stock)
                  return (
                    <tr key={product.id} className="border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-200 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate max-w-[160px]">{product.name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[100px] truncate">{product.brand || <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{product.category_name || <span className="text-slate-600">—</span>}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{product.supplier_name || <span className="text-slate-600">—</span>}</td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold font-mono text-sm ${stock === 0 ? 'text-red-400' : stock < 10 ? 'text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                          {stock}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">{product.unit}</span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                          {costPrice > 0 ? formatCurrency(costPrice) : <span className="text-slate-600">—</span>}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                          {stockValue > 0 ? formatCurrency(stockValue) : <span className="text-slate-600">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white text-sm">
                        {formatCurrency(product.selling_price)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setSelectedProduct(product); setShowRestockForm(true) }}
                            title="Restock" className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => { setSelectedProduct(product); setShowProductForm(true) }}
                                title="Edit" className="p-1.5 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-all">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setSelectedProduct(product); setShowDeleteConfirm(true) }}
                                title="Archive" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Footer totals — admin only (contains cost-based figures) */}
              {!loading && filtered.length > 0 && isAdmin && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/70 font-semibold">
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300" colSpan={4}>
                      {categoryFilter
                        ? `Totals: ${categories.find(c => c.id === categoryFilter)?.name || 'Category'}`
                        : 'Totals: All Products'}
                      <span className="text-slate-500 font-normal ml-1">({filtered.length} items)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white font-bold">{totals.qty}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-mono text-amber-400 text-sm">{formatCurrency(totals.stockValue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-violet-400 text-sm">{formatCurrency(totals.sellValue)}</td>
                    <td className="px-4 py-3 text-left">
                      <span className={`text-xs font-medium ${totals.potProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        Pot. profit: {formatCurrency(totals.potProfit)}
                      </span>
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-slate-100 dark:bg-slate-800/40 text-xs text-slate-500">
                    <td colSpan={4} className="px-4 py-1.5">
                      Selling Value vs Cost — {formatCurrency(totals.sellValue)} − {formatCurrency(totals.stockValue)} = {formatCurrency(totals.potProfit)}
                    </td>
                    <td colSpan={6} />
                  </tr>
                </tfoot>
              )}

              {/* Cashier footer — stock count only */}
              {!loading && filtered.length > 0 && !isAdmin && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/70 font-semibold">
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300" colSpan={3}>
                      Totals
                      <span className="text-slate-500 font-normal ml-1">({filtered.length} items)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white font-bold">{totals.qty}</td>
                    <td className="px-4 py-3 text-right font-mono text-violet-400 text-sm">{formatCurrency(totals.sellValue)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-800/30">
            <p className="text-xs text-slate-500">Showing {filtered.length} of {products.length} products</p>
          </div>
        )}
      </div>

      {isAdmin && (
        <ProductForm isOpen={showProductForm}
          onClose={() => { setShowProductForm(false); setSelectedProduct(null) }}
          product={selectedProduct} onSaved={load} />
      )}
      {selectedProduct && (
        <RestockForm isOpen={showRestockForm}
          onClose={() => { setShowRestockForm(false); setSelectedProduct(null) }}
          product={selectedProduct} onRestocked={load} />
      )}
      {isAdmin && (
        <ConfirmDialog isOpen={showDeleteConfirm}
          onClose={() => { setShowDeleteConfirm(false); setSelectedProduct(null) }}
          onConfirm={handleDelete} title="Archive Product"
          message={`Archive "${selectedProduct?.name}"? It will be hidden from POS and inventory.`}
          confirmLabel="Archive" danger loading={deleting} />
      )}
    </div>
  )
}
