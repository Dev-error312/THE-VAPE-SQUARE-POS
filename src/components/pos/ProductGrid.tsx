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
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
      {/* Search + Category filters */}
      <div className="p-4 space-y-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
          <input
            className="input pl-10 py-2.5 text-sm font-medium"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                !selectedCategory 
                  ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-sm' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}>
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCategory === cat 
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-sm' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No products found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {filtered.map(product => {
              const inCart = getCartQty(product.id)
              const stock = product.total_stock || 0
              const atMax = inCart >= stock
              return (
                <button
                  key={product.id}
                  onClick={() => !atMax && addItem(product)}
                  disabled={atMax}
                  className={`relative card-hover p-4 text-left flex flex-col h-full transition-all ${
                    atMax
                      ? 'opacity-50 cursor-not-allowed'
                      : 'active:scale-95 cursor-pointer'
                  }`}
                >
                  {/* Cart quantity badge */}
                  {inCart > 0 && (
                    <span className="absolute -top-2 -right-2 bg-gradient-to-br from-primary-600 to-primary-700 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center leading-none shadow-md">
                      {inCart}
                    </span>
                  )}

                  {/* Product info */}
                  <p className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2 mb-2 flex-1">
                    {product.name}
                  </p>

                  {(product.brand || product.supplier_name) && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mb-3 leading-tight font-medium">
                      {[product.brand, product.supplier_name].filter(Boolean).join(' • ')}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-primary-700 dark:text-primary-400 font-bold text-base font-mono">
                      {formatCurrency(product.selling_price)}
                    </span>
                    <span className={`text-xs font-semibold font-mono px-2 py-1 rounded-lg ${
                      stock === 0 
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400' 
                        : stock <= 5 
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {stock}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {filtered.length} of {products.filter(p => (p.total_stock || 0) > 0).length} products available
        </p>
      </div>
    </div>
  )
}
