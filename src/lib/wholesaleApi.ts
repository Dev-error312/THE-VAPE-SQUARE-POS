import { supabase, isRefreshTokenExpired } from './supabase'
import { useAuthStore } from '../store/authStore'
import type { WholesaleSale } from '../types'

function getBusinessId(): string {
  const store = useAuthStore.getState()
  if (!store.user?.business_id) throw new Error('Not authenticated — no business_id')
  return store.user.business_id
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

export const wholesaleApi = {
  async getAll(startDate?: string, endDate?: string): Promise<WholesaleSale[]> {
    const businessId = getBusinessId()
    let query = supabase
      .from('wholesale_sales')
      .select('*')
      .eq('business_id', businessId)
      .order('sale_date', { ascending: false })
    if (startDate) query = query.gte('sale_date', startDate)
    if (endDate)   query = query.lte('sale_date', endDate)
    const { data, error } = await query
    if (error) {
      if (isRefreshTokenExpired(error)) await handleRefreshTokenError(error)
      throw new Error(`Failed to fetch wholesale sales: ${error.message}`)
    }
    return data || []
  },

  async create(sale: {
    product_id?: string | null
    product_name: string
    quantity: number
    cost_price: number
    selling_price: number
    buyer_name?: string
    notes?: string
    sale_date: string
    created_by?: string
    customer_name?: string
    customer_phone?: string | null
    items?: any
    payment_method?: string
    total?: number
  }): Promise<WholesaleSale> {
    const businessId = getBusinessId()
    if (sale.quantity <= 0 && !sale.items) throw new Error('Quantity must be greater than 0')
    if (sale.selling_price < 0) throw new Error('Selling price cannot be negative')
    if (sale.cost_price < 0) throw new Error('Cost price cannot be negative')
    const { data, error } = await supabase
      .from('wholesale_sales').insert({
        ...sale,
        business_id: businessId,
      }).select().single()
    if (error) {
      if (isRefreshTokenExpired(error)) await handleRefreshTokenError(error)
      throw new Error(`Failed to create wholesale sale: ${error.message}`)
    }
    return data
  },

  async delete(id: string): Promise<void> {
    const businessId = getBusinessId()
    const { error } = await supabase.from('wholesale_sales').delete().eq('id', id).eq('business_id', businessId)
    if (error) {
      if (isRefreshTokenExpired(error)) await handleRefreshTokenError(error)
      throw new Error(`Failed to delete wholesale sale: ${error.message}`)
    }
  },

  async getSummary(startDate: string, endDate: string): Promise<{
    total_revenue: number; total_profit: number; total_sales: number
  }> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('wholesale_sales')
      .select('total, items')
      .eq('business_id', businessId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
    if (error) return { total_revenue: 0, total_profit: 0, total_sales: 0 }
    const rows = data || []
    
    let totalRevenue = 0
    let totalProfit = 0
    
    for (const row of rows) {
      totalRevenue += row.total || 0
      
      // Calculate profit from items: (unit_price - cost_price) * quantity
      if (row.items && Array.isArray(row.items)) {
        for (const item of row.items) {
          const profit = (item.unit_price - item.cost_price) * item.quantity
          totalProfit += profit
        }
      }
    }
    
    return {
      total_revenue: totalRevenue,
      total_profit: totalProfit,
      total_sales: rows.length,
    }
  },
}
