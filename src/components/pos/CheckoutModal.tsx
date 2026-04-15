import { useState, useRef } from 'react'
import Modal from '../shared/Modal'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import { salesApi } from '../../lib/salesApi'
import { formatCurrency, formatDateTime } from '../../utils'
import { Banknote, Wifi, GitMerge, Check, Printer, AlertCircle, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Sale } from '../../types'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

function round2(n: number) { return Math.round(n * 100) / 100 }

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function CheckoutModal({ isOpen, onClose, onComplete }: CheckoutModalProps) {
  const {
    items,
    paymentMethod, cashAmount, onlineAmount,
    setPaymentMethod, setCashAmount, setOnlineAmount,
    getSubtotal, getDiscountAmount, getTotal, getChange,
    isPaymentValid, isSplitValid, clearCart,
    getItemEnteredAmount, getItemDiscount,
  } = useCartStore()
  const { user } = useAuthStore()

  const [step, setStep] = useState<'payment' | 'invoice'>('payment')
  const [loading, setLoading] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState(items)
  const [saleDate, setSaleDate] = useState(toLocalDatetimeValue(new Date()))
  const invoiceRef = useRef<HTMLDivElement>(null)

  const subtotal       = getSubtotal()
  const discountAmount = getDiscountAmount()
  const total          = getTotal()
  const change         = getChange()

  const METHODS = [
    { id: 'cash'   as const, label: 'Cash',   icon: Banknote },
    { id: 'online' as const, label: 'Online', icon: Wifi },
    { id: 'split'  as const, label: 'Split',  icon: GitMerge },
  ]

  const quickAmounts = [...new Set([
    total,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
  ])].filter(v => v >= total).slice(0, 4)

  const handleCheckout = async () => {
    if (!user)             { toast.error('Not logged in'); return }
    if (items.length === 0){ toast.error('Cart is empty'); return }
    if (!isPaymentValid()) {
      if (paymentMethod === 'cash')   toast.error('Cash must be at least ' + formatCurrency(total))
      else if (paymentMethod === 'online') toast.error('Online amount must equal ' + formatCurrency(total))
      else toast.error('Cash + Online must equal ' + formatCurrency(total))
      return
    }

    setLoading(true)
    try {
      const snapshot = [...items]
      const saleDateISO = saleDate ? new Date(saleDate).toISOString() : undefined
      const isBackdated = saleDateISO && saleDateISO < new Date().toISOString()

      // Build cart items with per-item entered amounts baked in
      // so createSale can distribute discount correctly
      const itemsWithEnteredAmount = snapshot.map(item => ({
        ...item,
        // discount_amount per item — used by createSale for proportional distribution
        discount_amount: getItemDiscount(item.product.id),
        // line_total = actual amount received for this item
        unit_price: item.unit_price,
      }))

      const sale = await salesApi.createSale({
        items: itemsWithEnteredAmount,
        discountType: discountAmount > 0 ? 'fixed' : 'none',
        discountValue: discountAmount,
        discountAmount,
        taxRate: 0,
        taxAmount: 0,
        subtotal,
        total,
        paymentMethod,
        cashAmount:   paymentMethod === 'online' ? 0 : cashAmount,
        onlineAmount: paymentMethod === 'cash'   ? 0 : onlineAmount,
        changeAmount: change,
        userId: user.auth_user_id,
        saleDate: saleDateISO,
      })

      setSaleItems(snapshot)
      setCompletedSale(sale)
      setStep('invoice')
      toast.success(isBackdated ? 'Backdated sale recorded!' : 'Sale completed!')
    } catch (err: unknown) {
      let msg = 'Failed to process sale'
      
      if (err instanceof Error) {
        msg = err.message
        // Provide friendly hints for common errors
        if (msg.includes('Load Failed') || msg.includes('Network')) {
          msg = 'Network connection issue. The system will retry automatically. Please wait...'
        } else if (msg.includes('Insufficient stock')) {
          msg = `${msg} — Please reduce quantity and try again.`
        } else if (msg.includes('stock available')) {
          msg = `${msg} — Update inventory and try again.`
        }
      }
      
      console.error('[Checkout]', err)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!invoiceRef.current) return
    const content = invoiceRef.current.innerHTML
    const w = window.open('', '_blank', 'width=420,height=700')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;color:#000;width:300px}</style>
      </head><body>${content}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print(); w.close() }, 250)
  }

  const handleDone = () => {
    clearCart()
    setCompletedSale(null)
    setSaleItems([])
    setStep('payment')
    setSaleDate(toLocalDatetimeValue(new Date()))
    onComplete()
    onClose()
  }

  const handleClose = () => {
    if (step === 'invoice') handleDone()
    else onClose()
  }

  const splitRemaining = paymentMethod === 'split'
    ? Math.max(0, total - cashAmount - onlineAmount)
    : 0

  const isNowOrFuture = new Date(saleDate) >= new Date(Date.now() - 60000)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={step === 'payment' ? 'Checkout' : 'Invoice'} size="lg">
      {step === 'payment' ? (
        <div className="space-y-4">
          {/* Order Summary */}
          <div className="bg-slate-200 dark:bg-slate-700/40 rounded-xl p-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2 uppercase tracking-wide">Order Summary</p>
            <div className="max-h-36 overflow-y-auto space-y-1.5 mb-3">
              {items.map(item => {
                const entered      = getItemEnteredAmount(item.product.id)
                const itemDiscount = getItemDiscount(item.product.id)
                const listPrice    = item.unit_price * item.quantity
                return (
                  <div key={item.product.id} className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-700 dark:text-slate-300 truncate flex-1 mr-2">
                        {item.product.name} <span className="text-slate-500">×{item.quantity}</span>
                      </span>
                      <span className="text-slate-900 dark:text-white flex-shrink-0 font-mono">{formatCurrency(entered)}</span>
                    </div>
                    {itemDiscount > 0 && (
                      <div className="flex justify-between text-xs text-amber-400 mt-0.5">
                        <span className="text-slate-600">List: {formatCurrency(listPrice)}</span>
                        <span>Discount: −{formatCurrency(itemDiscount)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-slate-300 dark:border-slate-600 pt-2 space-y-1">
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-amber-400">
                  <span>Total Discount</span>
                  <span>−{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white">
                <span>Total</span>
                <span className="text-primary-400 font-mono">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Sale Date */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Sale Date & Time
              {!isNowOrFuture && <span className="text-amber-400 text-xs font-medium ml-1">• Backdated</span>}
            </label>
            <input className="input" type="datetime-local" value={saleDate}
              max={toLocalDatetimeValue(new Date())}
              onChange={e => setSaleDate(e.target.value)} />
          </div>

          {/* Payment Method - Modern Card Design */}
          <div>
            <p className="label mb-3">Select Payment Method</p>
            <div className="grid grid-cols-3 gap-3">
              {METHODS.map(m => {
                const isSelected = paymentMethod === m.id
                return (
                  <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                    className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 transform group ${
                      isSelected 
                        ? 'scale-105 shadow-lg shadow-primary-500/30' 
                        : 'hover:scale-102 shadow-md'
                    }`}>
                    {/* Background gradient */}
                    <div className={`absolute inset-0 transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-br from-primary-500 to-primary-600'
                        : 'bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800'
                    }`} />
                    
                    {/* Border highlight */}
                    {isSelected && (
                      <div className="absolute inset-0 border-2 border-primary-300/50 rounded-2xl animate-pulse" />
                    )}
                    
                    {/* Content */}
                    <div className="relative flex flex-col items-center gap-2.5 zindex-10">
                      <div className={`transition-all duration-300 ${isSelected ? 'text-white scale-110' : 'text-slate-600 dark:text-slate-400 group-hover:scale-110'}`}>
                        <m.icon className="w-6 h-6" />
                      </div>
                      <span className={`text-sm font-bold tracking-wide transition-colors duration-300 ${
                        isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {m.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cash Payment Section */}
          {paymentMethod === 'cash' && (
            <div className="space-y-4 animate-fade-in">
              {/* Amount Input Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-800/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Cash Payment</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2 block">Amount Tendered</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">रु</span>
                      <input 
                        className="w-full pl-12 pr-4 py-3 text-2xl font-bold font-mono bg-white dark:bg-slate-900/50 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors" 
                        type="number" 
                        step="1" 
                        min={total}
                        value={cashAmount || ''} 
                        onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                        placeholder={String(Math.ceil(total))} 
                        autoFocus 
                      />
                    </div>
                  </div>

                  {/* Change Display */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border-2 border-emerald-300 dark:border-emerald-700/30">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Change</p>
                    <p className="text-3xl font-bold text-emerald-500 font-mono">{formatCurrency(change)}</p>
                  </div>
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2.5">Quick Select</p>
                <div className="grid grid-cols-2 gap-2">
                  {quickAmounts.map(amt => (
                    <button key={amt} onClick={() => setCashAmount(amt)}
                      className={`py-2.5 rounded-xl font-mono font-bold text-sm transition-all transform hover:scale-105 ${
                        cashAmount === amt 
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30' 
                          : 'bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 border-2 border-slate-300 dark:border-slate-600'
                      }`}>
                      {formatCurrency(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation Message */}
              {cashAmount > 0 && cashAmount < total && (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3 border-l-4 border-red-500">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold">Short by {formatCurrency(total - cashAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Online Payment Section */}
          {paymentMethod === 'online' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/30 dark:to-cyan-900/20 rounded-2xl p-5 border border-cyan-200 dark:border-cyan-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">Online Payment</span>
                  <span className="ml-auto text-xs font-medium text-cyan-600 dark:text-cyan-500">eSewa • Khalti • Bank</span>
                </div>
                
                <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border-2 border-cyan-300 dark:border-cyan-700">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3 block">Enter Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-cyan-600 dark:text-cyan-400">रु</span>
                    <input 
                      className="w-full pl-12 pr-4 py-3 text-2xl font-bold font-mono bg-slate-50 dark:bg-slate-800 border-2 border-cyan-300 dark:border-cyan-700 rounded-xl focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors" 
                      type="number" 
                      step="1"
                      value={onlineAmount || ''} 
                      onChange={e => setOnlineAmount(parseFloat(e.target.value) || 0)}
                      placeholder={String(total)} 
                      autoFocus 
                    />
                  </div>
                </div>

                <button 
                  onClick={() => setOnlineAmount(total)}
                  className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/20">
                  Use Exact Amount: {formatCurrency(total)}
                </button>

                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    { label: 'eSewa', icon: '💳' },
                    { label: 'Khalti', icon: '📱' },
                    { label: 'Bank', icon: '🏦' }
                  ].map((method, idx) => (
                    <div key={idx} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-center border border-cyan-300/30 dark:border-cyan-700/30">
                      <span className="text-xl mb-1 block">{method.icon}</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{method.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Split Payment Section */}
          {paymentMethod === 'split' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 rounded-2xl p-5 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Split Payment</span>
                  <span className="text-xs text-amber-600 dark:text-amber-500 font-medium ml-auto">50/50 Split</span>
                </div>

                {/* Split Input Cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Cash Input */}
                  <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border-2 border-emerald-300 dark:border-emerald-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Cash</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-emerald-600 dark:text-emerald-400">रु</span>
                      <input 
                        className="w-full pl-9 pr-3 py-2.5 text-lg font-bold font-mono bg-slate-50 dark:bg-slate-800 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors" 
                        type="number" 
                        step="1" 
                        min={0} 
                        max={total}
                        value={cashAmount || ''}
                        onChange={e => { const v = parseFloat(e.target.value) || 0; setCashAmount(v); setOnlineAmount(Math.max(0, round2(total - v))) }}
                        placeholder="0" 
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Online Input */}
                  <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border-2 border-cyan-300 dark:border-cyan-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Online</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-cyan-600 dark:text-cyan-400">रु</span>
                      <input 
                        className="w-full pl-9 pr-3 py-2.5 text-lg font-bold font-mono bg-slate-50 dark:bg-slate-800 border-2 border-cyan-300 dark:border-cyan-700 rounded-lg focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 transition-colors" 
                        type="number" 
                        step="1" 
                        min={0} 
                        max={total}
                        value={onlineAmount || ''}
                        onChange={e => { const v = parseFloat(e.target.value) || 0; setOnlineAmount(v); setCashAmount(Math.max(0, round2(total - v))) }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Balance Summary */}
                <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 space-y-3 border-2 border-amber-200 dark:border-amber-700/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Amount</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(total)}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-slate-900/50 rounded-lg p-3 border-2 border-emerald-200 dark:border-emerald-700/30">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Cash Allocated</span>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(cashAmount)}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900/50 rounded-lg p-3 border-2 border-cyan-200 dark:border-cyan-700/30">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Online Allocated</span>
                      <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400 font-mono">{formatCurrency(onlineAmount)}</span>
                    </div>
                  </div>

                  {!isSplitValid() ? (
                    <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 rounded px-3 py-2 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Remaining</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">{formatCurrency(splitRemaining)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500 rounded px-3 py-2 flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Payment Balanced ✓</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button onClick={handleCheckout}
            disabled={loading || items.length === 0 || !isPaymentValid()}
            className="btn-primary w-full py-3.5 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Check className="w-5 h-5" />Complete Sale · {formatCurrency(total)}</>
            }
          </button>
        </div>
      ) : (
        /* ── Invoice ── */
        <div>
          <div className="flex gap-3 mb-4">
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={handleDone} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> New Sale
            </button>
          </div>

          <div ref={invoiceRef} className="bg-white text-black rounded-xl p-5 font-mono text-xs leading-relaxed">
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>{user?.business_name || 'The Vape Square'}</div>
              <div style={{ fontSize: 11 }}>Point of Sale System</div>
              <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            </div>
            {completedSale && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>Invoice #:</span><span style={{ fontWeight: 'bold' }}>{completedSale.sale_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>Date:</span><span>{formatDateTime(completedSale.created_at)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                {/* Items — show SN, product name, qty×price, list price total, discount */}
                {saleItems.map((item, idx) => {
                  const itemDiscount = getItemDiscount(item.product.id)
                  const listPrice    = item.unit_price * item.quantity
                  return (
                    <div key={idx} style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 'bold' }}>{idx + 1}. {item.product.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.quantity} × रु {item.unit_price}</span>
                        <span>रु {listPrice.toFixed(0)}</span>
                      </div>
                      {itemDiscount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Discount</span>
                          <span>-रु {itemDiscount.toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>List Price Total:</span><span>रु {subtotal.toFixed(0)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Total Discount:</span><span>-रु {discountAmount.toFixed(0)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
                  <span>TOTAL:</span><span>रु {total.toFixed(0)}</span>
                </div>
                {completedSale.payment_method === 'cash' && (<>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Cash:</span><span>रु {(completedSale.cash_amount||0).toFixed(0)}</span>
                  </div>
                  {(completedSale.change_amount||0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>Change:</span><span>रु {(completedSale.change_amount||0).toFixed(0)}</span>
                    </div>
                  )}
                </>)}
                {completedSale.payment_method === 'online' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Online:</span><span>रु {(completedSale.online_amount||0).toFixed(0)}</span>
                  </div>
                )}
                {completedSale.payment_method === 'split' && (<>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Cash:</span><span>रु {(completedSale.cash_amount||0).toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Online:</span><span>रु {(completedSale.online_amount||0).toFixed(0)}</span>
                  </div>
                </>)}
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: 11 }}>Thank you for shopping!</div>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
