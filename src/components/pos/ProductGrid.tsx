import { useState, useMemo } from 'react'
import type { Product } from '../../types'
import { formatCurrency } from '../../utils'
import { Search, Package } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'

interface ProductGridProps {
  products: Product[]
  loading: boolean
}

export default function ProductGrid({ products, loading }: ProductGridProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const addItem = useCartStore(s => s.addItem)
  const cartItems = useCartStore(s => s.items)

  const categories = useMemo(() => {
    const all = [...new Set(products.map(p => p.category_name).filter(Boolean))] as string[]
    const OTHERS = ['others', 'other', 'अन्य']
    const main = all.filter(c => !OTHERS.includes(c.toLowerCase())).sort()
    const others = all.filter(c => OTHERS.includes(c.toLowerCase()))
    return [...main, ...others]
  }, [products])

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = !search
      || p.name.toLowerCase().includes(search.toLowerCase())
      || (p.brand || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !selectedCategory || p.category_name === selectedCategory
    return matchSearch && matchCat && (p.total_stock || 0) > 0
  }), [products, search, selectedCategory])

  const getCartQty = (productId: string) =>
    cartItems.find(i => i.product.id === productId)?.quantity || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search + Category filters */}
      <div className="p-3 space-y-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input pl-9 py-2 text-sm bg-white dark:bg-slate-900"
            placeholder="Search by name or brand..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                !selectedCategory ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}>
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCategory === cat ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600">
            <Package className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm font-medium">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
            {filtered.map(product => {
              const inCart = getCartQty(product.id)
              const stock = product.total_stock || 0
              const atMax = inCart >= stock
              return (
                <button
                  key={product.id}
                  onClick={() => !atMax && addItem(product)}
                  disabled={atMax}
                  className={`relative bg-slate-100 dark:bg-slate-800 border rounded-xl p-3 text-left transition-all ${
                    atMax
                      ? 'border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                      : 'border-slate-200 dark:border-slate-700 hover:border-primary-500/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 active:scale-95 cursor-pointer'
                  }`}
                >
                  {/* Cart quantity badge */}
                  {inCart > 0 && (
                    <span className="absolute top-2 right-2 bg-primary-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
                      {inCart}
                    </span>
                  )}

                  {/* Product info — no image/icon placeholder */}
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-2 mb-1 pr-6">
                    {product.name}
                  </p>

                  {(product.brand || product.supplier_name) && (
                    <p className="text-xs text-slate-500 truncate mb-1 leading-tight">
                      {[product.brand, product.supplier_name].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-1 mt-auto">
                    <span className="text-primary-400 font-bold text-sm font-mono">
                      {formatCurrency(product.selling_price)}
                    </span>
                    <span className={`text-xs font-mono ${stock <= 5 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {stock} {product.unit}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <p className="text-xs text-slate-500">
          {filtered.length} of {products.filter(p => (p.total_stock || 0) > 0).length} products in stock
        </p>
      </div>
    </div>
  )
}
