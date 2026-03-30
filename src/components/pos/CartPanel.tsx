import { useCartStore } from '../../store/cartStore'
import { useIsAdmin } from '../../hooks/useRole'
import { formatCurrency } from '../../utils'
import { Trash2, Plus, Minus, ShoppingCart, X } from 'lucide-react'

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary-400" />
          <span className="font-semibold text-slate-900 dark:text-white text-sm">Cart</span>
          {items.length > 0 && (
            <span className="bg-primary-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {items.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button onClick={clearCart}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600 select-none">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="text-xs mt-1 opacity-70">Tap products to add</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {items.map(item => {
              const listPrice    = item.unit_price * item.quantity
              const entered      = getItemEnteredAmount(item.product.id)
              const itemDiscount = getItemDiscount(item.product.id)
              const itemProfit   = getItemProfit(item.product.id)

              return (
                <div key={item.product.id} className="px-4 py-3 space-y-2">
                  {/* Product name + remove */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate leading-tight">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        List: {formatCurrency(item.unit_price)} × {item.quantity}
                        {' = '}<span className={itemDiscount > 0 ? 'line-through text-slate-600' : ''}>{formatCurrency(listPrice)}</span>
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.product.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700">
                      <Minus className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0
                        updateQuantity(item.product.id, Math.min(v, item.product.total_stock || 999))
                      }}
                      className="w-10 text-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white py-1 font-mono"
                      min="1" max={item.product.total_stock}
                    />
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= (item.product.total_stock || 0)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed">
                      <Plus className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                    </button>
                    <span className="text-xs text-slate-600 ml-1">
                      {item.product.total_stock || 0} left
                    </span>
                  </div>

                  {/* Amount received input */}
                  <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">Amount Received</label>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-xs">रु</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max={listPrice}
                          value={entered === 0 ? '' : entered}
                          onChange={e => setEnteredAmount(item.product.id, parseFloat(e.target.value) || 0)}
                          placeholder={String(listPrice)}
                          className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm font-mono text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      {itemDiscount > 0 && (
                        <button
                          onClick={() => setEnteredAmount(item.product.id, listPrice)}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 whitespace-nowrap transition-colors">
                          Full
                        </button>
                      )}
                    </div>

                    {/* Discount always visible; profit only for admin */}
                    <div className="flex justify-between text-xs">
                      <span className={itemDiscount > 0 ? 'text-amber-400' : 'text-slate-600'}>
                        {itemDiscount > 0 ? `Discount: −${formatCurrency(itemDiscount)}` : 'No discount'}
                      </span>
                      {isAdmin && (
                        <span className={`font-mono font-medium ${itemProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Profit: {formatCurrency(itemProfit)}
                        </span>
                      )}
                    </div>
                  </div>

                  {(item.product.total_stock || 0) <= 5 && (
                    <p className="text-xs text-amber-500">⚠ Only {item.product.total_stock} left</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Totals + Checkout */}
      {items.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-4 space-y-3 bg-white dark:bg-slate-900">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>List Price Total</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Total Discount</span>
                <span className="font-mono">−{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base pt-1.5 border-t border-slate-200 dark:border-slate-800">
              <span>Total Received</span>
              <span className="text-primary-400 font-mono">{formatCurrency(total)}</span>
            </div>
          </div>

          <button onClick={onCheckout}
            className="btn-primary w-full py-3.5 text-base font-bold tracking-wide">
            Checkout · {formatCurrency(total)}
          </button>
        </div>
      )}
    </div>
  )
}
