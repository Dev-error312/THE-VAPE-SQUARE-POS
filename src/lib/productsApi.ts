import { supabase } from './supabase'
import type { Product, InventoryBatch, Category, Supplier } from '../types'

function round2(n: number) { return Math.round(n * 100) / 100 }

// ─── Suppliers ─────────────────────────────────────────────────────────────
export const suppliersApi = {
  async getAll(): Promise<Supplier[]> {
    const { data, error } = await supabase.from('suppliers').select('*').order('name')
    if (error) throw new Error(`Suppliers fetch failed: ${error.message}`)
    return data || []
  },
  async create(supplier: { name: string; phone?: string; address?: string }): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single()
    if (error) throw new Error(`Failed to create supplier: ${error.message}`)
    return data
  },
  async update(id: string, updates: { name?: string; phone?: string; address?: string }): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update supplier: ${error.message}`)
    return data
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete supplier: ${error.message}`)
  },

  // Find supplier by name (case-insensitive). If not found, create and return.
  async findOrCreate(name: string): Promise<Supplier> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Supplier name cannot be empty')
    // Check existing (ilike = case-insensitive)
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, name, phone, address, created_at')
      .ilike('name', trimmed)
      .limit(1)
      .single()
    if (existing) return existing as Supplier
    // Not found — create new
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: trimmed })
      .select('id, name, phone, address, created_at')
      .single()
    if (error) throw new Error(`Failed to create supplier: ${error.message}`)
    return data as Supplier
  },
}

// ─── Categories ────────────────────────────────────────────────────────────
export const categoriesApi = {
  async getAll(): Promise<Category[]> {
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) throw new Error(`Categories fetch failed: ${error.message}`)
    const cats = data || []
    // Sort A→Z but always push "Others" / "Other" / "अन्य" to the end
    const OTHERS = ['others', 'other', 'अन्य']
    const main = cats.filter(c => !OTHERS.includes(c.name.toLowerCase()))
    const others = cats.filter(c => OTHERS.includes(c.name.toLowerCase()))
    return [...main, ...others]
  },
  async create(name: string): Promise<Category> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Category name cannot be empty')
    const { data, error } = await supabase.from('categories').insert({ name: trimmed }).select().single()
    if (error) throw new Error(`Failed to create category: ${error.message}`)
    return data
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete category: ${error.message}`)
  },
}

// ─── Products ──────────────────────────────────────────────────────────────
export const productsApi = {
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, brand, category_id, supplier_id, selling_price, unit, description,
        is_active, created_at, updated_at,
        categories ( id, name ),
        suppliers ( id, name ),
        inventory_batches ( quantity_remaining, cost_price )
      `)
      .eq('is_active', true)
      .order('name')

    if (error) throw new Error(`Products fetch failed: ${error.message}`)

    return (data || []).map(p => {
      const batches = (p.inventory_batches || []) as { quantity_remaining: number; cost_price: number }[]
      const totalStock = batches.reduce((s, b) => s + b.quantity_remaining, 0)
      const avgCost = totalStock > 0
        ? batches.reduce((s, b) => s + b.cost_price * b.quantity_remaining, 0) / totalStock : 0
      return {
        id: p.id,
        name: p.name,
        brand: p.brand || '',
        category_id: p.category_id,
        category_name: (p.categories as unknown as { id: string; name: string } | null)?.name || '',
        supplier_id: p.supplier_id,
        supplier_name: (p.suppliers as unknown as { id: string; name: string } | null)?.name || '',
        selling_price: p.selling_price,
        unit: p.unit,
        description: p.description,
        is_active: p.is_active,
        created_at: p.created_at,
        updated_at: p.updated_at,
        total_stock: totalStock,
        avg_cost: round2(avgCost),
      }
    })
  },

  async create(product: {
    name: string
    brand?: string
    category_id: string | null
    supplier_id: string | null
    selling_price: number
    unit: string
    description?: string
    is_active: boolean
  }): Promise<Product> {
    const { data, error } = await supabase.from('products').insert(product).select().single()
    if (error) throw new Error(`Failed to create product: ${error.message}`)
    return data
  },

  async update(id: string, updates: {
    name?: string
    brand?: string
    category_id?: string | null
    supplier_id?: string | null
    selling_price?: number
    unit?: string
    description?: string
  }): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw new Error(`Failed to update product: ${error.message}`)
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(`Failed to archive product: ${error.message}`)
  },
}

// ─── Batches ───────────────────────────────────────────────────────────────
export const batchesApi = {
  async getByProduct(productId: string): Promise<InventoryBatch[]> {
    const { data, error } = await supabase
      .from('inventory_batches').select('*').eq('product_id', productId)
      .order('received_at', { ascending: true })
    if (error) throw new Error(`Batches fetch failed: ${error.message}`)
    return data || []
  },

  async createBatch(batch: {
    product_id: string
    batch_number: string
    quantity_received: number
    quantity_remaining: number
    cost_price: number
    supplier_id?: string | null
    notes?: string
    received_at: string
  }): Promise<InventoryBatch> {
    const { data, error } = await supabase.from('inventory_batches').insert(batch).select().single()
    if (error) throw new Error(`Failed to create batch: ${error.message}`)
    return data
  },
}

// ─── Purchases ─────────────────────────────────────────────────────────────
export const purchasesApi = {
  async getAll(): Promise<import('../types').Purchase[]> {
    const { data, error } = await supabase
      .from('purchases')
      .select(`*, suppliers(id, name), products(id, name)`)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Purchases fetch failed: ${error.message}`)
    return (data || []).map(p => ({
      ...p,
      supplier: p.suppliers,
      product: p.products,
    }))
  },

  async create(purchase: {
    supplier_id: string | null
    product_id: string | null
    batch_id: string | null
    quantity: number
    total_amount: number
    paid_amount: number
    payment_type: 'full' | 'credit' | 'partial'
    notes?: string
    created_by?: string
  }): Promise<import('../types').Purchase> {
    // original_payment_type locks in the initial type so we can always
    // identify credit/partial records even after full payment
    const payload = {
      ...purchase,
      original_payment_type: purchase.payment_type,
    }
    const { data, error } = await supabase.from('purchases').insert(payload).select().single()
    if (error) throw new Error(`Failed to create purchase: ${error.message}`)
    return data
  },

  async recordPayment(id: string, additionalPayment: number): Promise<void> {
    const { data: purchase } = await supabase.from('purchases').select('paid_amount, total_amount').eq('id', id).single()
    if (!purchase) throw new Error('Purchase not found')
    const newPaid = Math.min(purchase.paid_amount + additionalPayment, purchase.total_amount)
    const newType = newPaid >= purchase.total_amount ? 'full' : 'partial'
    const { error } = await supabase.from('purchases').update({ paid_amount: newPaid, payment_type: newType }).eq('id', id)
    if (error) throw new Error(`Failed to record payment: ${error.message}`)
  },

  async getFiltered(params: {
    startDate?: string
    endDate?: string
    supplierId?: string
    creditOnly?: boolean   // if true, only show records that were originally credit/partial
  }): Promise<import('../types').Purchase[]> {
    let query = supabase
      .from('purchases')
      .select(`*, suppliers(id, name), products(id, name)`)
      .order('created_at', { ascending: false })
    if (params.startDate)  query = query.gte('created_at', params.startDate + 'T00:00:00.000Z')
    if (params.endDate)    query = query.lte('created_at', params.endDate + 'T23:59:59.999Z')
    if (params.supplierId) query = query.eq('supplier_id', params.supplierId)
    if (params.creditOnly) {
      // Show only purchases that were originally credit or partial
      query = query.in('original_payment_type', ['credit', 'partial'])
    }
    const { data, error } = await query
    if (error) throw new Error(`Purchases fetch failed: ${error.message}`)
    return (data || []).map(p => ({ ...p, supplier: p.suppliers, product: p.products }))
  },
}
