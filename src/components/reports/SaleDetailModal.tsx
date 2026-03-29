import Modal from '../shared/Modal'
import type { Sale } from '../../types'
import { formatCurrency, formatDateTime } from '../../utils'
import { useIsAdmin } from '../../hooks/useRole'
import { Printer } from 'lucide-react'
import { useRef } from 'react'

interface SaleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
}

export default function SaleDetailModal({ isOpen, onClose, sale }: SaleDetailModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null)
  const isAdmin    = useIsAdmin()

  const handlePrint = () => {
    if (!invoiceRef.current) return
    const content = invoiceRef.current.innerHTML
    const w = window.open('', '_blank', 'width=420,height=700')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice ${sale?.sale_number}</title>
      <style>
        * { margin:0;padding:0;box-sizing:border-box }
        body { font-family:'Courier New',monospace;font-size:12px;padding:16px;color:#000;width:300px }
        .row { display:flex;justify-content:space-between;margin:2px 0 }
        .divider { border-top:1px dashed #000;margin:6px 0 }
        .bold { font-weight:bold }
        .center { text-align:center }
      </style></head><body>${content}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print(); w.close() }, 250)
  }

  if (!sale) return null

  const items = sale.sale_items || []
  const profit = items.reduce((sum, item) => {
    return sum + (item.line_total - item.cost_price * item.quantity)
  }, 0)
  const cost = sale.total - profit

  const paymentLabel = (method: string) => {
    if (method === 'cash')   return 'Cash'
    if (method === 'online') return 'Online'
    if (method === 'split')  return 'Split'
    return method
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Sale: ${sale.sale_number}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
          <span className={`badge capitalize text-xs ${sale.status === 'completed'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
            {sale.status}
          </span>
        </div>

        {/* Profit summary — admin only */}
        {isAdmin ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Revenue</p>
              <p className="font-bold text-white font-mono text-sm">{formatCurrency(sale.total)}</p>
            </div>
            <div className="bg-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Cost (COGS)</p>
              <p className="font-bold text-white font-mono text-sm">{formatCurrency(cost)}</p>
            </div>
            <div className="bg-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Profit</p>
              <p className={`font-bold font-mono text-sm ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(profit)}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-700/40 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 mb-1">Sale Total</p>
            <p className="font-bold text-white font-mono text-lg">{formatCurrency(sale.total)}</p>
          </div>
        )}

        {/* Payment breakdown */}
        <div className="bg-slate-700/30 rounded-xl p-4 text-sm space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Payment Details</p>
          <div className="flex justify-between">
            <span className="text-slate-400">Method</span>
            <span className="text-slate-200 font-medium">{paymentLabel(sale.payment_method)}</span>
          </div>
          {sale.payment_method === 'cash' && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-400">Cash Paid</span>
                <span className="text-slate-200 font-mono">{formatCurrency(sale.cash_amount)}</span>
              </div>
              {(sale.change_amount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Change</span>
                  <span className="text-emerald-400 font-mono">{formatCurrency(sale.change_amount)}</span>
                </div>
              )}
            </>
          )}
          {sale.payment_method === 'online' && (
            <div className="flex justify-between">
              <span className="text-slate-400">Online Amount</span>
              <span className="text-slate-200 font-mono">{formatCurrency(sale.online_amount)}</span>
            </div>
          )}
          {sale.payment_method === 'split' && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-400">Cash</span>
                <span className="text-slate-200 font-mono">{formatCurrency(sale.cash_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Online</span>
                <span className="text-slate-200 font-mono">{formatCurrency(sale.online_amount)}</span>
              </div>
            </>
          )}
        </div>

        {/* Printable invoice — always shows only customer-facing info */}
        <div ref={invoiceRef} className="bg-white text-black rounded-xl p-5 font-mono text-xs leading-relaxed">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>The Vape Square</div>
            <div style={{ fontSize: 11 }}>Point of Sale System</div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Invoice #:</span><span style={{ fontWeight: 'bold' }}>{sale.sale_number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Date:</span><span>{formatDateTime(sale.created_at)}</span>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          {items.map((item, i) => {
            const listPrice  = item.unit_price * item.quantity
            const hasDiscount = item.discount_amount > 0
            return (
              <div key={i} style={{ marginBottom: 4 }}>
                <div style={{ fontWeight: 'bold' }}>{item.product_name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.quantity} × रु {item.unit_price}</span>
                  <span style={{ textDecoration: hasDiscount ? 'line-through' : 'none', color: hasDiscount ? '#888' : 'inherit' }}>
                    रु {listPrice.toFixed(0)}
                  </span>
                </div>
                {hasDiscount && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Discount</span><span>-रु {item.discount_amount.toFixed(0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>Final</span><span>रु {item.line_total.toFixed(0)}</span>
                    </div>
                  </>
                )}
              </div>
            )
          })}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Subtotal:</span><span>रु {sale.subtotal.toFixed(0)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Discount:</span><span>-रु {sale.discount_amount.toFixed(0)}</span>
            </div>
          )}
          {sale.tax_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Tax ({sale.tax_rate}%):</span><span>रु {sale.tax_amount.toFixed(0)}</span>
            </div>
          )}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
            <span>TOTAL:</span><span>रु {sale.total.toFixed(0)}</span>
          </div>
          {sale.payment_method === 'cash' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>Cash Paid:</span><span>रु {sale.cash_amount.toFixed(0)}</span>
              </div>
              {(sale.change_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>Change:</span><span>रु {sale.change_amount.toFixed(0)}</span>
                </div>
              )}
            </>
          )}
          {sale.payment_method === 'online' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Online Paid:</span><span>रु {sale.online_amount.toFixed(0)}</span>
            </div>
          )}
          {sale.payment_method === 'split' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>Cash:</span><span>रु {sale.cash_amount.toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>Online:</span><span>रु {sale.online_amount.toFixed(0)}</span>
              </div>
            </>
          )}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 11 }}>Thank you for shopping!</div>
        </div>
      </div>
    </Modal>
  )
}
