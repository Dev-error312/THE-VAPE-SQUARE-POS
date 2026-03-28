import { useEffect, useState, useCallback } from 'react'
import { productsApi } from '../../lib/productsApi'
import type { Product } from '../../types'
import ProductGrid from './ProductGrid'
import CartPanel from './CartPanel'
import CheckoutModal from './CheckoutModal'

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await productsApi.getAll()
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  return (
    <div className="flex h-full">
      {/* Product grid — left/main area */}
      <div className="flex-1 bg-slate-950 border-r border-slate-800 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white">Point of Sale</h1>
          <p className="text-xs text-slate-400">Select products to add to cart</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <ProductGrid products={products} loading={loading} />
        </div>
      </div>

      {/* Cart — right panel */}
      <div className="w-80 xl:w-96 bg-slate-900 flex flex-col flex-shrink-0">
        <CartPanel onCheckout={() => setShowCheckout(true)} />
      </div>

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onComplete={() => { setShowCheckout(false); loadProducts() }}
      />
    </div>
  )
}
