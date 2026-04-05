import { supabase, isRefreshTokenExpired } from './supabase'
import { useAuthStore } from '../store/authStore'
import type { Sale, CartItem, PaymentMethod } from '../types'
import { round2 } from '../utils'

function getBusinessId(): string {
  const store = useAuthStore.getState()
  if (!store.user?.business_id) throw new Error('Not authenticated — no business_id')
  return store.user.business_id
}

function generateSaleNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `INV-${date}-${rand}`
}

// ─── Error Handler for Refresh Token Failures ──────────────────────────────
async function handleRefreshTokenError(error: unknown): Promise<never> {
  if (isRefreshTokenExpired(error)) {
    console.error('❌ Refresh token expired — redirecting to login')
    useAuthStore.getState().clearUser()
    await supabase.auth.signOut().catch(() => {})
    window.location.href = '/auth'
  }
  throw error
}

export const salesApi = {
  async createSale(params: {
    items: CartItem[]
    discountType: 'none' | 'percentage' | 'fixed'
    discountValue: number
    discountAmount: number
    taxRate: number
    taxAmount: number
    subtotal: number
    total: number
    paymentMethod: PaymentMethod
    cashAmount: number
    onlineAmount: number
    changeAmount: number
    userId: string
    saleDate?: string   // optional backdated datetime (ISO string)
  }): Promise<Sale> {
    const businessId = getBusinessId()
    if (!params.items || params.items.length === 0) throw new Error('Cart is empty')

    const saleNumber = generateSaleNumber()

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_number: saleNumber,
        business_id: businessId,
        subtotal: params.subtotal,
        discount_type: params.discountType,
        discount_value: params.discountValue,
        discount_amount: params.discountAmount,
        tax_rate: params.taxRate,
        tax_amount: params.taxAmount,
        total: params.total,
        payment_method: params.paymentMethod,
        cash_amount: params.cashAmount,
        online_amount: params.onlineAmount,
        change_amount: params.changeAmount,
        status: 'completed',
        created_by: params.userId,
        // If backdated, override created_at
        ...(params.saleDate ? { created_at: params.saleDate } : {}),
      })
      .select().single()

    if (saleError || !sale) {
      if (isRefreshTokenExpired(saleError)) await handleRefreshTokenError(saleError)
      console.error('[salesApi] Sale insert error:', saleError)
      throw new Error(`Failed to create sale: ${saleError?.message ?? 'Unknown error'}`)
    }

    const saleItemsToInsert: {
      sale_id: string; product_id: string; batch_id: string | null
      product_name: string; quantity: number
      cost_price: number; unit_price: number; discount_amount: number; line_total: number
      business_id: string
    }[] = []

    // Distribute the cart-level discount proportionally across items.
    const grossSubtotal = params.items.reduce(
      (s, item) => s + item.unit_price * item.quantity, 0
    )
    const cartDiscountRatio = grossSubtotal > 0 ? params.discountAmount / grossSubtotal : 0

    for (const cartItem of params.items) {
      let resolvedCostPrice = cartItem.cost_price
      let resolvedBatchId: string | null = null
      let qtyToDeduct = cartItem.quantity

      const { data: batches, error: batchError } = await supabase
        .from('inventory_batches')
        .select('id, quantity_remaining, cost_price')
        .eq('product_id', cartItem.product.id)
        .eq('business_id', businessId)
        .gt('quantity_remaining', 0)
        .order('received_at', { ascending: true })

      if (batchError) throw new Error(`Failed to fetch stock for ${cartItem.product.name}: ${batchError.message}`)
      if (!batches || batches.length === 0) throw new Error(`No stock available for "${cartItem.product.name}"`)

      for (const batch of batches) {
        if (qtyToDeduct <= 0) break
        const deduct = Math.min(qtyToDeduct, batch.quantity_remaining)
        const { error: updateError } = await supabase
          .from('inventory_batches')
          .update({ quantity_remaining: batch.quantity_remaining - deduct })
          .eq('id', batch.id)
          .eq('business_id', businessId)
        if (updateError) throw new Error(`Failed to deduct stock for "${cartItem.product.name}": ${updateError.message}`)
        qtyToDeduct -= deduct
        resolvedCostPrice = batch.cost_price
        resolvedBatchId = batch.id
      }

      if (qtyToDeduct > 0) throw new Error(`Insufficient stock for "${cartItem.product.name}"`)

      // Proportional discount for this item
      const itemGross = cartItem.unit_price * cartItem.quantity
      const itemDiscount = round2(itemGross * cartDiscountRatio)
      const lineTotal = round2(itemGross - itemDiscount)

      saleItemsToInsert.push({
        sale_id: sale.id,
        product_id: cartItem.product.id,
        batch_id: resolvedBatchId,
        product_name: cartItem.product.name,
        quantity: cartItem.quantity,
        cost_price: resolvedCostPrice,
        unit_price: cartItem.unit_price,
        discount_amount: itemDiscount,
        line_total: lineTotal,
        business_id: businessId,
      })
    }

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsToInsert)
    if (itemsError) throw new Error(`Failed to save sale items: ${itemsError.message}`)

    const paymentsToInsert: { sale_id: string; method: 'cash' | 'online'; amount: number; business_id: string }[] = []
    if (params.paymentMethod === 'cash') paymentsToInsert.push({ sale_id: sale.id, method: 'cash', amount: params.cashAmount, business_id: businessId })
    else if (params.paymentMethod === 'online') paymentsToInsert.push({ sale_id: sale.id, method: 'online', amount: params.onlineAmount, business_id: businessId })
    else if (params.paymentMethod === 'split') {
      if (params.cashAmount > 0) paymentsToInsert.push({ sale_id: sale.id, method: 'cash', amount: params.cashAmount, business_id: businessId })
      if (params.onlineAmount > 0) paymentsToInsert.push({ sale_id: sale.id, method: 'online', amount: params.onlineAmount, business_id: businessId })
    }
    if (paymentsToInsert.length > 0) {
      const { error: paymentError } = await supabase.from('payments').insert(paymentsToInsert)
      if (paymentError) throw new Error(`Failed to record payment: ${paymentError.message}`)
    }

    return sale as Sale
  },

  // ─── Delete a sale and restore stock atomically ──────────────────────────
  async deleteSale(saleId: string): Promise<void> {
    const businessId = getBusinessId()

    // 1. Fetch sale items to restore stock
    const { data: saleItems, error: fetchError } = await supabase
      .from('sale_items')
      .select('batch_id, quantity')
      .eq('sale_id', saleId)

    if (fetchError) throw new Error(`Failed to fetch sale items: ${fetchError.message}`)

    // 2. Restore stock for all batches in parallel
    if (saleItems && saleItems.length > 0) {
      const updatePromises = saleItems
        .filter(item => item.batch_id) // only items with batch_id
        .map(item =>
          supabase
            .from('inventory_batches')
            .select('quantity_remaining')
            .eq('id', item.batch_id)
            .single()
            .then(({ data: batch, error: batchError }) => {
              if (batchError) throw new Error(`Failed to fetch batch: ${batchError.message}`)
              if (!batch) return
              
              const newQuantity = batch.quantity_remaining + item.quantity
              return supabase
                .from('inventory_batches')
                .update({ quantity_remaining: newQuantity })
                .eq('id', item.batch_id)
                .then(({ error: updateError }) => {
                  if (updateError) throw new Error(`Failed to update batch: ${updateError.message}`)
                })
            })
        )

      try {
        await Promise.all(updatePromises)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        console.error('[deleteSale] Batch restore error:', msg)
        throw new Error(`Stock restoration failed: ${msg}`)
      }
    }

    // 3. Delete related records in parallel
    const deletePromises = [
      supabase.from('sale_items').delete().eq('sale_id', saleId),
      supabase.from('payments').delete().eq('sale_id', saleId),
    ]

    const results = await Promise.all(deletePromises)
    
    // Check for errors in deletions
    for (const { error } of results) {
      if (error) throw new Error(`Delete operation failed: ${error.message}`)
    }

    // 4. Finally delete the sale
    const { error: saleDeletionError } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('business_id', businessId)

    if (saleDeletionError) {
      throw new Error(`Failed to delete sale: ${saleDeletionError.message}`)
    }
  },

  async getAll(params?: { startDate?: string; endDate?: string; limit?: number }): Promise<Sale[]> {
    const businessId = getBusinessId()
    let query = supabase
      .from('sales')
      .select(`id, sale_number, subtotal, discount_type, discount_value, discount_amount,
        tax_rate, tax_amount, total, payment_method, cash_amount, online_amount,
        change_amount, status, created_at, created_by,
        sale_items ( id, product_id, product_name, quantity, cost_price, unit_price, discount_amount, line_total, batch_id )`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (params?.startDate) query = query.gte('created_at', params.startDate)
    if (params?.endDate) query = query.lte('created_at', params.endDate)
    if (params?.limit) query = query.limit(params.limit)

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch sales: ${error.message}`)
    return (data || []) as Sale[]
  },

  async getById(id: string): Promise<Sale | null> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('sales').select(`*, sale_items(*), payments(*)`).eq('id', id).eq('business_id', businessId).single()
    if (error) throw new Error(`Failed to fetch sale: ${error.message}`)
    return data as Sale
  },

  async getDashboardStats() {
    const businessId = getBusinessId()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    const [todaySalesRes, monthlySalesRes, productsRes] = await Promise.all([
      supabase.from('sales').select('total, sale_items(quantity, cost_price, unit_price, discount_amount)').eq('status', 'completed').eq('business_id', businessId).gte('created_at', todayStr),
      supabase.from('sales').select('total, sale_items(quantity, cost_price, unit_price, discount_amount)').eq('status', 'completed').eq('business_id', businessId).gte('created_at', monthStart),
      // Fetch selling_price + batch cost for stock valuation
      supabase.from('products').select('id, selling_price, inventory_batches(quantity_remaining, cost_price)').eq('is_active', true).eq('business_id', businessId),
    ])

    // ✅ Filter out orphaned sales (those with no sale_items)
    const todaySales = (todaySalesRes.data || []).filter(s => (s.sale_items || []).length > 0)
    const monthlySales = (monthlySalesRes.data || []).filter(s => (s.sale_items || []).length > 0)
    
    const todayRevenue = todaySales.reduce((s, sale) => s + (sale.total || 0), 0)
    const todayProfit = todaySales.reduce((s, sale) => {
      return s + ((sale.sale_items || []) as { unit_price: number; cost_price: number; quantity: number; discount_amount: number }[])
        // Correct formula: actual selling price (after discount) minus cost
        // = (unit_price * qty - discount) - cost * qty
        // = line_total - cost * qty  (same thing, uses discount_amount correctly)
        .reduce((p, item) =>
          p + ((item.unit_price * item.quantity - item.discount_amount) - item.cost_price * item.quantity), 0)
    }, 0)
    const lowStockCount = (productsRes.data || []).filter(p =>
      ((p.inventory_batches || []) as { quantity_remaining: number }[]).reduce((s, b) => s + b.quantity_remaining, 0) < 10
    ).length

    // Stock valuation
    let totalStockValue = 0
    let potentialSellingValue = 0
    for (const product of productsRes.data || []) {
      const batches = (product.inventory_batches || []) as { quantity_remaining: number; cost_price: number }[]
      for (const b of batches) {
        totalStockValue += b.cost_price * b.quantity_remaining
        potentialSellingValue += (product.selling_price || 0) * b.quantity_remaining
      }
    }

    return {
      today_sales: todaySales.length,
      today_revenue: round2(todayRevenue),
      today_profit: round2(todayProfit),
      total_products: (productsRes.data || []).length,
      low_stock_count: lowStockCount,
      monthly_revenue: round2(monthlySales.reduce((s, sale) => s + (sale.total || 0), 0)),
      monthly_sales: monthlySales.length,
      total_stock_value: round2(totalStockValue),
      potential_selling_value: round2(potentialSellingValue),
      potential_profit: round2(potentialSellingValue - totalStockValue),
    }
  },

  async getAnalyticsReport(startDate: string, endDate: string) {
    const businessId = getBusinessId()
    const [salesRes, expensesRes, damagedRes] = await Promise.all([
      supabase.from('sales').select(`created_at, total, sale_items(quantity, cost_price, unit_price, discount_amount, line_total)`)
        .eq('status', 'completed').eq('business_id', businessId).gte('created_at', startDate).lte('created_at', endDate).order('created_at'),
      supabase.from('expenses').select('expense_date, amount').eq('business_id', businessId).gte('expense_date', startDate.slice(0, 10)).lte('expense_date', endDate.slice(0, 10)),
      supabase.from('damaged_products').select('damage_date, loss_amount').eq('business_id', businessId).gte('damage_date', startDate.slice(0, 10)).lte('damage_date', endDate.slice(0, 10)),
    ])

    const grouped: Record<string, { revenue: number; gross_profit: number; sales: number; expenses: number; damages: number }> = {}

    // ✅ Filter out orphaned sales (those with no sale_items)
    const completeSales = (salesRes.data || []).filter(s => (s.sale_items || []).length > 0)

    for (const sale of completeSales) {
      // FIX: use local date string to avoid UTC→local timezone shift (e.g. Nepal UTC+5:45)
      const date = new Date(sale.created_at).toLocaleDateString('en-CA') // 'en-CA' gives YYYY-MM-DD
      if (!grouped[date]) grouped[date] = { revenue: 0, gross_profit: 0, sales: 0, expenses: 0, damages: 0 }
      grouped[date].revenue += sale.total || 0
      grouped[date].sales += 1
      for (const item of (sale.sale_items || []) as { cost_price: number; quantity: number; line_total: number }[]) {
        grouped[date].gross_profit += item.line_total - item.cost_price * item.quantity
      }
    }
    for (const exp of expensesRes.data || []) {
      const date = exp.expense_date
      if (!grouped[date]) grouped[date] = { revenue: 0, gross_profit: 0, sales: 0, expenses: 0, damages: 0 }
      grouped[date].expenses += exp.amount
    }
    for (const dmg of damagedRes.data || []) {
      const date = dmg.damage_date
      if (!grouped[date]) grouped[date] = { revenue: 0, gross_profit: 0, sales: 0, expenses: 0, damages: 0 }
      grouped[date].damages += dmg.loss_amount || 0
    }

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, stats]) => ({
      date,
      sales: stats.sales,
      revenue: round2(stats.revenue),
      gross_profit: round2(stats.gross_profit),
      expenses: round2(stats.expenses),
      damages: round2(stats.damages),
      net_profit: round2(stats.gross_profit - stats.expenses - stats.damages),
    }))
  },

  // Returns cash_amount and online_amount totals for the date range
  async getPaymentTotals(startDate: string, endDate: string): Promise<{
    cash: number; online: number
  }> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('sales')
      .select('cash_amount, online_amount, sale_items(id)')
      .eq('status', 'completed')
      .eq('business_id', businessId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
    if (error) return { cash: 0, online: 0 }
    // ✅ Filter out orphaned sales (those with no sale_items)
    const rows = (data || []).filter(r => (r.sale_items || []).length > 0)
    return {
      cash:   round2(rows.reduce((s, r) => s + (r.cash_amount || 0), 0)),
      online: round2(rows.reduce((s, r) => s + (r.online_amount || 0), 0)),
    }
  },

  async getSalesReport(startDate: string, endDate: string) {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('sales').select(`created_at, total, sale_items(quantity, cost_price, unit_price, discount_amount, line_total)`)
      .eq('status', 'completed').eq('business_id', businessId).gte('created_at', startDate).lte('created_at', endDate).order('created_at')
    if (error) throw new Error(`Failed to fetch sales report: ${error.message}`)

    const grouped: Record<string, { revenue: number; profit: number; cost: number; sales: number }> = {}
    
    // ✅ Filter out orphaned sales (those with no sale_items)
    const completeSales = (data || []).filter(s => (s.sale_items || []).length > 0)
    
    for (const sale of completeSales) {
      // FIX: use local date string to avoid UTC→local timezone shift (e.g. Nepal UTC+5:45)
      const date = new Date(sale.created_at).toLocaleDateString('en-CA') // 'en-CA' gives YYYY-MM-DD
      if (!grouped[date]) grouped[date] = { revenue: 0, profit: 0, cost: 0, sales: 0 }
      grouped[date].revenue += sale.total || 0
      grouped[date].sales += 1
      for (const item of (sale.sale_items || []) as { cost_price: number; quantity: number; line_total: number }[]) {
        grouped[date].cost += item.cost_price * item.quantity
        grouped[date].profit += item.line_total - item.cost_price * item.quantity
      }
    }
    return Object.entries(grouped).map(([date, stats]) => ({ date, ...stats }))
  },
}
