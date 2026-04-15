import { useCartStore } from '../../store/cartStore'
import { useIsAdmin } from '../../hooks/useRole'
import { formatCurrency } from '../../utils'
import { Trash2, Plus, Minus, ShoppingCart, X, AlertTriangle } from 'lucide-react'

interface CartPanelProps {
  onCheckout: () => void
}

export default function CartPanel({ onCheckout }: CartPanelProps) {
  const {
    items, updateQuantity, removeItem, clearCart,
    setEnteredAmount, getItemEnteredAmount, getItemDiscount, getItemProfit,
    getSubtotal, getDiscountAmount, getTotal,
  } = useCartStore()

  const isAdmin = useIsAdmin()

  const subtotal       = getSubtotal()
  const discountAmount = getDiscountAmount()
  const total          = getTotal()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 dark:from-slate-800/50 to-white dark:to-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white">Cart</span>
            {items.length > 0 && (
              <span className="ml-2 badge badge-primary text-xs font-semibold">{items.reduce((s, i) => s + i.quantity, 0)} items</span>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={clearCart}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 flex items-center gap-1.5 transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 select-none p-4">
            <ShoppingCart className="w-14 h-14 mb-3 opacity-30" />
            <p className="text-base font-semibold">Cart is empty</p>
            <p className="text-xs mt-2 opacity-70">Add products to begin</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 p-3 space-y-3">
            {items.map(item => {
              const listPrice    = item.unit_price * item.quantity
              const entered      = getItemEnteredAmount(item.product.id)
              const itemDiscount = getItemDiscount(item.product.id)
              const itemProfit   = getItemProfit(item.product.id)

              return (
                <div key={item.product.id} className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4 space-y-3">
                  {/* Product name + remove */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
                        {formatCurrency(item.unit_price)} × {item.quantity}
                        {itemDiscount > 0 && (
                          <span className="ml-2 line-through opacity-60">{formatCurrency(listPrice)}</span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.product.id)}
                      className="text-slate-500 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex-shrink-0 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg p-1.5 border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-700 dark:text-slate-300 font-bold text-sm">
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0
                        updateQuantity(item.product.id, Math.min(v, item.product.total_stock || 999))
                      }}
                      className="flex-1 text-center bg-transparent border-0 text-sm font-semibold text-slate-900 dark:text-white py-1 focus:outline-none"
                      min="1" max={item.product.total_stock}
                    />
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= (item.product.total_stock || 0)}
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-700 dark:text-slate-300 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed">
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium px-1.5">
                      {item.product.total_stock || 0}
                    </span>
                  </div>

                  {/* Amount received input */}
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Amount</label>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-xs font-semibold">Rs.</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={entered === 0 ? '' : entered}
                          onChange={e => setEnteredAmount(item.product.id, parseFloat(e.target.value) || 0)}
                          placeholder={String(listPrice)}
                          className="w-full pl-8 pr-2 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-semibold text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
                        />
                      </div>
                      {itemDiscount > 0 && (
                        <button
                          onClick={() => setEnteredAmount(item.product.id, listPrice)}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap">
                          Full
                        </button>
                      )}
                    </div>

                    {/* Discount & Profit info */}
                    <div className="flex justify-between items-center text-xs">
                      <span className={`font-semibold ${itemDiscount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {itemDiscount > 0 ? `−${formatCurrency(itemDiscount)} discount` : 'No discount'}
                      </span>
                      {isAdmin && (
                        <span className={`font-mono font-bold ${itemProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatCurrency(itemProfit)}
                        </span>
                      )}
                    </div>
                  </div>

                  {(item.product.total_stock || 0) <= 5 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Low stock: {item.product.total_stock} left
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Totals + Checkout */}
      {items.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-4 space-y-4 bg-gradient-to-t from-white dark:from-slate-900 to-white/50 dark:to-slate-900/50">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-700 dark:text-slate-400 font-medium">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                <span>Discount</span>
                <span className="font-mono">−{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base pt-2.5 border-t border-slate-200 dark:border-slate-800">
              <span>Total</span>
              <span className="text-primary-600 dark:text-primary-400 font-mono">{formatCurrency(total)}</span>
            </div>
          </div>

          <button onClick={onCheckout}
            className="btn-primary w-full py-3.5 text-base font-bold tracking-wide flex items-center justify-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Checkout
          </button>
        </div>
      )}
    </div>
  )
}
