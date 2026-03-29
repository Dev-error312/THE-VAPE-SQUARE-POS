import { useEffect, useState, useCallback } from 'react'
import { ShoppingCart, X } from 'lucide-react'
import { productsApi } from '../../lib/productsApi'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../utils'
import type { Product } from '../../types'
import ProductGrid from './ProductGrid'
import CartPanel from './CartPanel'
import CheckoutModal from './CheckoutModal'

export default function POSPage() {
  const [products, setProducts]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showMobileCart, setShowMobileCart] = useState(false)

  // Cart summary for floating button
  const cartItemCount = useCartStore(s => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const cartTotal     = useCartStore(s => s.getTotal())

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

  // Close mobile cart when checkout opens
  const handleCheckout = () => {
    setShowMobileCart(false)
    setShowCheckout(true)
  }

  return (
    <div className="flex h-full relative">
      {/* ── Product Grid (always visible) ─────────────────────────────── */}
      <div className="flex-1 bg-slate-950 border-r border-slate-800 overflow-hidden flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white">Point of Sale</h1>
          <p className="text-xs text-slate-400">Select products to add to cart</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <ProductGrid products={products} loading={loading} />
        </div>
      </div>

      {/* ── Desktop Cart Panel (lg+) ───────────────────────────────────── */}
      <div className="hidden lg:flex w-80 xl:w-96 bg-slate-900 flex-col flex-shrink-0">
        <CartPanel onCheckout={() => setShowCheckout(true)} />
      </div>

      {/* ── Mobile Cart Overlay (< lg) ────────────────────────────────── */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <h2 className="font-bold text-white text-base">Your Cart</h2>
            <button
              onClick={() => setShowMobileCart(false)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <CartPanel onCheckout={handleCheckout} />
          </div>
        </div>
      )}

      {/* ── Mobile Floating Cart Button ───────────────────────────────── */}
      {cartItemCount > 0 && !showMobileCart && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="
            fixed bottom-20 right-4 z-40 lg:hidden
            bg-primary-600 hover:bg-primary-500 active:scale-95
            text-white rounded-2xl px-4 py-3
            flex items-center gap-2.5
            shadow-xl shadow-slate-950/60
            transition-all duration-150
          "
        >
          <ShoppingCart className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold text-sm whitespace-nowrap">
            {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} · {formatCurrency(cartTotal)}
          </span>
        </button>
      )}

      {/* ── Checkout Modal ────────────────────────────────────────────── */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onComplete={() => { setShowCheckout(false); loadProducts() }}
      />
    </div>
  )
}
