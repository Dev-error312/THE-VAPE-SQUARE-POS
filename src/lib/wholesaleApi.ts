import { supabase } from './supabase'
import type { WholesaleSale } from '../types'

export const wholesaleApi = {
  async getAll(startDate?: string, endDate?: string): Promise<WholesaleSale[]> {
    let query = supabase
      .from('wholesale_sales')
      .select('*')
      .order('sale_date', { ascending: false })
    if (startDate) query = query.gte('sale_date', startDate)
    if (endDate)   query = query.lte('sale_date', endDate)
    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch wholesale sales: ${error.message}`)
    return data || []
  },

  async create(sale: {
    product_id: string | null
    product_name: string
    quantity: number
    cost_price: number
    selling_price: number
    buyer_name?: string
    notes?: string
    sale_date: string
    created_by?: string
  }): Promise<WholesaleSale> {
    // Validate
    if (sale.quantity <= 0) throw new Error('Quantity must be greater than 0')
    if (sale.selling_price < 0) throw new Error('Selling price cannot be negative')
    if (sale.cost_price < 0) throw new Error('Cost price cannot be negative')
    const { data, error } = await supabase
      .from('wholesale_sales').insert(sale).select().single()
    if (error) throw new Error(`Failed to create wholesale sale: ${error.message}`)
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('wholesale_sales').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete wholesale sale: ${error.message}`)
  },

  async getSummary(startDate: string, endDate: string): Promise<{
    total_revenue: number; total_profit: number; total_sales: number
  }> {
    const { data, error } = await supabase
      .from('wholesale_sales')
      .select('total_amount, profit')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
    if (error) return { total_revenue: 0, total_profit: 0, total_sales: 0 }
    const rows = data || []
    return {
      total_revenue: rows.reduce((s, r) => s + (r.total_amount || 0), 0),
      total_profit:  rows.reduce((s, r) => s + (r.profit || 0), 0),
      total_sales:   rows.length,
    }
  },
}
