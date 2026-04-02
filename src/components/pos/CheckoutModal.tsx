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
      const msg = err instanceof Error ? err.message : 'Failed to process sale'
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

          {/* Payment Method */}
          <div>
            <p className="label">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                    paymentMethod === m.id
                      ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-900/30'
                      : 'bg-slate-200 dark:bg-slate-700/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}>
                  <m.icon className="w-5 h-5" />
                  <span className="text-sm font-semibold">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label">Amount Tendered</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm font-medium">रु</span>
                    <input className="input pl-9 font-mono" type="number" step="1" min={total}
                      value={cashAmount || ''} onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                      placeholder={String(Math.ceil(total))} autoFocus />
                  </div>
                </div>
                <div>
                  <p className="label">Change</p>
                  <div className="input bg-white dark:bg-slate-900/70 font-mono font-bold text-emerald-400 flex items-center">
                    {formatCurrency(change)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {quickAmounts.map(amt => (
                  <button key={amt} onClick={() => setCashAmount(amt)}
                    className={`flex-1 text-xs py-2 rounded-lg transition-colors font-mono ${
                      cashAmount === amt ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                    }`}>
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
              {cashAmount > 0 && cashAmount < total && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Short by {formatCurrency(total - cashAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Online */}
          {paymentMethod === 'online' && (
            <div>
              <p className="label">Online Amount (eSewa, Khalti, Bank Transfer)</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm font-medium">रु</span>
                <input className="input pl-9 font-mono" type="number" step="1"
                  value={onlineAmount || ''} onChange={e => setOnlineAmount(parseFloat(e.target.value) || 0)}
                  placeholder={String(total)} autoFocus />
              </div>
              <button onClick={() => setOnlineAmount(total)}
                className="mt-2 text-xs text-primary-400 hover:text-primary-300 transition-colors">
                Set exact: {formatCurrency(total)}
              </button>
            </div>
          )}

          {/* Split */}
          {paymentMethod === 'split' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label">Cash Amount</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm">रु</span>
                    <input className="input pl-9 font-mono" type="number" step="1" min={0} max={total}
                      value={cashAmount || ''} autoFocus
                      onChange={e => { const v = parseFloat(e.target.value) || 0; setCashAmount(v); setOnlineAmount(Math.max(0, round2(total - v))) }}
                      placeholder="0" />
                  </div>
                </div>
                <div>
                  <p className="label">Online Amount</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-sm">रु</span>
                    <input className="input pl-9 font-mono" type="number" step="1" min={0} max={total}
                      value={onlineAmount || ''}
                      onChange={e => { const v = parseFloat(e.target.value) || 0; setOnlineAmount(v); setCashAmount(Math.max(0, round2(total - v))) }}
                      placeholder="0" />
                  </div>
                </div>
              </div>
              <div className="bg-slate-200 dark:bg-slate-700/40 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Total</span>
                  <span className="text-slate-900 dark:text-white font-mono font-bold">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Paid</span>
                  <span className={`font-mono font-bold ${isSplitValid() ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {formatCurrency(cashAmount + onlineAmount)}
                  </span>
                </div>
                {splitRemaining > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Remaining</span>
                    <span className="font-mono">{formatCurrency(splitRemaining)}</span>
                  </div>
                )}
                {isSplitValid() && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Balanced
                  </div>
                )}
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
