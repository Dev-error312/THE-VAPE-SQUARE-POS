import { create } from 'zustand'
import type { CartItem, Product, PaymentMethod } from '../types'
import { round2 } from '../utils'

interface CartState {
  items: CartItem[]
  // Per-item entered amounts (cashier types the final price for each item)
  // Key: product.id, Value: amount the cashier entered (≤ selling_price * qty)
  enteredAmounts: Record<string, number>

  paymentMethod: PaymentMethod
  cashAmount: number
  onlineAmount: number

  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setEnteredAmount: (productId: string, amount: number) => void

  setPaymentMethod: (method: PaymentMethod) => void
  setCashAmount: (amount: number) => void
  setOnlineAmount: (amount: number) => void
  clearCart: () => void

  // Derived values
  getSubtotal: () => number         // sum of (unit_price * quantity) — list price
  getDiscountAmount: () => number   // list price - final price (auto from enteredAmounts)
  getTotal: () => number            // sum of enteredAmounts (what customer actually pays)
  getChange: () => number
  isSplitValid: () => boolean
  isPaymentValid: () => boolean

  // Per-item helpers
  getItemEnteredAmount: (productId: string) => number  // enteredAmount or default (full price)
  getItemDiscount: (productId: string) => number       // list - entered
  getItemProfit: (productId: string) => number         // entered - cost
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  enteredAmounts: {},
  paymentMethod: 'cash',
  cashAmount: 0,
  onlineAmount: 0,

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find(i => i.product.id === product.id)
      if (existing) {
        const stock = product.total_stock ?? 0
        if (existing.quantity >= stock) return state
        const newQty = existing.quantity + 1
        // Scale entered amount with new quantity
        const newEntered = round2(product.selling_price * newQty)
        return {
          items: state.items.map(i =>
            i.product.id === product.id ? { ...i, quantity: newQty } : i
          ),
          enteredAmounts: { ...state.enteredAmounts, [product.id]: newEntered },
        }
      }
      return {
        items: [...state.items, {
          product,
          quantity: 1,
          unit_price: product.selling_price,
          discount_amount: 0,
          batch_id: undefined,
          cost_price: product.avg_cost ?? 0,
        }],
        // Default entered amount = full selling price
        enteredAmounts: { ...state.enteredAmounts, [product.id]: product.selling_price },
      }
    })
  },

  removeItem: (productId) =>
    set((state) => {
      const { [productId]: _, ...rest } = state.enteredAmounts
      return { items: state.items.filter(i => i.product.id !== productId), enteredAmounts: rest }
    }),

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) { get().removeItem(productId); return }
    set((state) => {
      const item = state.items.find(i => i.product.id === productId)
      if (!item) return state
      // Scale entered amount proportionally to new quantity
      const perUnit = state.enteredAmounts[productId]
        ? state.enteredAmounts[productId] / item.quantity
        : item.unit_price
      const newEntered = round2(perUnit * quantity)
      return {
        items: state.items.map(i => i.product.id === productId ? { ...i, quantity } : i),
        enteredAmounts: { ...state.enteredAmounts, [productId]: newEntered },
      }
    })
  },

  setEnteredAmount: (productId, amount) => {
    const item = get().items.find(i => i.product.id === productId)
    if (!item) return
    // Allow any non-negative amount (including above list price)
    const clamped = round2(Math.max(0, amount))
    set(state => ({
      enteredAmounts: { ...state.enteredAmounts, [productId]: clamped },
    }))
  },

  setPaymentMethod: (method) => set({
    paymentMethod: method,
    cashAmount: method === 'cash' ? get().getTotal() : 0,
    onlineAmount: method === 'online' ? get().getTotal() : 0,
  }),
  setCashAmount: (amount) => set({ cashAmount: round2(amount) }),
  setOnlineAmount: (amount) => set({ onlineAmount: round2(amount) }),

  clearCart: () => set({
    items: [],
    enteredAmounts: {},
    paymentMethod: 'cash',
    cashAmount: 0,
    onlineAmount: 0,
  }),

  getSubtotal: () => {
    const { items } = get()
    return round2(items.reduce((s, i) => s + i.unit_price * i.quantity, 0))
  },

  getDiscountAmount: () => {
    const { items, enteredAmounts } = get()
    return round2(items.reduce((s, i) => {
      const listPrice = i.unit_price * i.quantity
      const entered = enteredAmounts[i.product.id] ?? listPrice
      return s + Math.max(0, listPrice - entered)
    }, 0))
  },

  getTotal: () => {
    const { items, enteredAmounts } = get()
    return round2(items.reduce((s, i) => {
      const listPrice = i.unit_price * i.quantity
      return s + (enteredAmounts[i.product.id] ?? listPrice)
    }, 0))
  },

  getChange: () => {
    const { paymentMethod, cashAmount, onlineAmount, getTotal } = get()
    const total = getTotal()
    if (paymentMethod === 'cash')   return round2(Math.max(0, cashAmount - total))
    if (paymentMethod === 'split')  return round2(Math.max(0, cashAmount + onlineAmount - total))
    return 0
  },

  isSplitValid: () => {
    const { paymentMethod, cashAmount, onlineAmount, getTotal } = get()
    if (paymentMethod !== 'split') return true
    return round2(cashAmount + onlineAmount) === getTotal()
  },

  isPaymentValid: () => {
    const { paymentMethod, cashAmount, onlineAmount, getTotal } = get()
    const total = getTotal()
    if (paymentMethod === 'cash')   return cashAmount >= total
    if (paymentMethod === 'online') return onlineAmount >= total
    if (paymentMethod === 'split')  return round2(cashAmount + onlineAmount) === total
    return false
  },

  getItemEnteredAmount: (productId) => {
    const { items, enteredAmounts } = get()
    const item = items.find(i => i.product.id === productId)
    if (!item) return 0
    return enteredAmounts[productId] ?? item.unit_price * item.quantity
  },

  getItemDiscount: (productId) => {
    const { items, enteredAmounts } = get()
    const item = items.find(i => i.product.id === productId)
    if (!item) return 0
    const listPrice = item.unit_price * item.quantity
    const entered = enteredAmounts[productId] ?? listPrice
    return round2(Math.max(0, listPrice - entered))
  },

  getItemProfit: (productId) => {
    const { items, enteredAmounts } = get()
    const item = items.find(i => i.product.id === productId)
    if (!item) return 0
    const entered = enteredAmounts[productId] ?? item.unit_price * item.quantity
    return round2(entered - item.cost_price * item.quantity)
  },
}))
