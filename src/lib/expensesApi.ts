import { supabase } from './supabase'
import { useAuthStore } from '../store/authStore'
import type { Expense, DamagedProduct } from '../types'

function getBusinessId(): string {
  const store = useAuthStore.getState()
  if (!store.user?.business_id) throw new Error('Not authenticated — no business_id')
  return store.user.business_id
}

export const expensesApi = {
  async getAll(startDate?: string, endDate?: string): Promise<Expense[]> {
    const businessId = getBusinessId()
    let query = supabase.from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .order('expense_date', { ascending: false })
    if (startDate) query = query.gte('expense_date', startDate)
    if (endDate) query = query.lte('expense_date', endDate)
    const { data, error } = await query
    if (error) throw new Error(`Expenses fetch failed: ${error.message}`)
    return data || []
  },

  async create(expense: { title: string; amount: number; expense_date: string; notes?: string; created_by?: string }): Promise<Expense> {
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('expenses').insert({
      ...expense,
      business_id: businessId,
    }).select().single()
    if (error) throw new Error(`Failed to create expense: ${error.message}`)
    return data
  },

  async update(id: string, updates: { title?: string; amount?: number; expense_date?: string; notes?: string }): Promise<Expense> {
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('expenses').update(updates).eq('id', id).eq('business_id', businessId).select().single()
    if (error) throw new Error(`Failed to update expense: ${error.message}`)
    return data
  },

  async delete(id: string): Promise<void> {
    const businessId = getBusinessId()
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('business_id', businessId)
    if (error) throw new Error(`Failed to delete expense: ${error.message}`)
  },

  async getTotalForDateRange(startDate: string, endDate: string): Promise<number> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
    if (error) return 0
    return (data || []).reduce((s, e) => s + e.amount, 0)
  },
}

export const damagedApi = {
  async getAll(startDate?: string, endDate?: string): Promise<DamagedProduct[]> {
    const businessId = getBusinessId()
    let query = supabase.from('damaged_products').select('*, products(name)').eq('business_id', businessId).order('damage_date', { ascending: false })
    if (startDate) query = query.gte('damage_date', startDate)
    if (endDate) query = query.lte('damage_date', endDate)
    const { data, error } = await query
    if (error) throw new Error(`Damaged products fetch failed: ${error.message}`)
    return data || []
  },

  async create(item: {
    product_id: string | null
    product_name: string
    quantity: number
    cost_price: number
    damage_date: string
    notes?: string
    created_by?: string
  }): Promise<DamagedProduct> {
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('damaged_products').insert({ ...item, business_id: businessId }).select().single()
    if (error) throw new Error(`Failed to record damaged product: ${error.message}`)
    return data
  },

  async delete(id: string): Promise<void> {
    const businessId = getBusinessId()
    const { error } = await supabase.from('damaged_products').delete().eq('id', id).eq('business_id', businessId)
    if (error) throw new Error(`Failed to delete record: ${error.message}`)
  },
}

// ─── Tester Products ───────────────────────────────────────────────────────
// A "tester" is a product used internally (demos, samples, testing).
// Recording a tester:
//   1. Deducts stock from inventory_batches (FIFO, newest-first simple deduct)
//   2. Records an expense at cost_price × qty so it shows in P&L
export const testerApi = {
  async create(params: {
    product_id: string
    product_name: string
    quantity: number
    cost_price: number
    tester_date: string
    notes?: string
    created_by?: string
  }): Promise<{ expense_id: string }> {
    const businessId = getBusinessId()
    const { supabase } = await import('./supabase')

    // 1. Verify stock is sufficient
    const { data: batches } = await supabase
      .from('inventory_batches')
      .select('id, quantity_remaining')
      .eq('product_id', params.product_id)
      .eq('business_id', businessId)
      .gt('quantity_remaining', 0)
      .order('received_at', { ascending: false })  // newest first

    const available = (batches || []).reduce((s: number, b: { quantity_remaining: number }) => s + b.quantity_remaining, 0)
    if (available < params.quantity) {
      throw new Error(`Insufficient stock. Available: ${available}, Requested: ${params.quantity}`)
    }

    // 2. Deduct stock (newest-first)
    let toDeduct = params.quantity
    for (const batch of batches || []) {
      if (toDeduct <= 0) break
      const deduct = Math.min(toDeduct, (batch as { id: string; quantity_remaining: number }).quantity_remaining)
      const { error } = await supabase
        .from('inventory_batches')
        .update({ quantity_remaining: (batch as { quantity_remaining: number }).quantity_remaining - deduct })
        .eq('id', (batch as { id: string }).id)
      if (error) throw new Error(`Stock deduction failed: ${error.message}`)
      toDeduct -= deduct
    }

    // 3. Record as expense (type marker in notes so Analytics can filter if needed)
    const expenseAmount = Math.round(params.cost_price * params.quantity * 100) / 100
    const { data: expense, error: expError } = await supabase
      .from('expenses')
      .insert({
        title:        `Tester: ${params.product_name} ×${params.quantity}`,
        amount:       expenseAmount,
        expense_date: params.tester_date,
        business_id:  businessId,
        notes:        params.notes
          ? `[TESTER] ${params.notes}`
          : `[TESTER] Internal use — cost at रु ${params.cost_price}/unit`,
        created_by: params.created_by,
      })
      .select('id')
      .single()

    if (expError) throw new Error(`Failed to record tester expense: ${expError.message}`)
    return { expense_id: (expense as { id: string }).id }
  },
}
