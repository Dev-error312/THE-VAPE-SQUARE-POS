import { supabase, isRefreshTokenExpired } from './supabase'
import { useAuthStore } from '../store/authStore'
import type { Product, InventoryBatch, Category, Supplier } from '../types'

function round2(n: number) { return Math.round(n * 100) / 100 }

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

// ─── Suppliers ─────────────────────────────────────────────────────────────
export const suppliersApi = {
  async getAll(): Promise<Supplier[]> {
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('suppliers')
      .select('*')
      .eq('business_id', businessId)
      .order('name')
    if (error) {
      if (isRefreshTokenExpired(error)) await handleRefreshTokenError(error)
      throw new Error(`Suppliers fetch failed: ${error.message}`)
    }
    return data || []
  },
  async create(supplier: { name: string; phone?: string; address?: string }): Promise<Supplier> {
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('suppliers').insert({
      ...supplier,
      business_id: businessId,
    }).select().single()
    if (error) throw new Error(`Failed to create supplier: ${error.message}`)
    return data
  },
  async update(id: string, updates: { name?: string; phone?: string; address?: string }): Promise<Supplier> {
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('suppliers').update(updates).eq('id', id).eq('business_id', businessId).select().single()
    if (error) throw new Error(`Failed to update supplier: ${error.message}`)
    return data
  },
  async delete(id: string): Promise<void> {
    const businessId = getBusinessId()
    const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('business_id', businessId)
    if (error) throw new Error(`Failed to delete supplier: ${error.message}`)
  },

  async findOrCreate(name: string): Promise<Supplier> {
    const businessId = getBusinessId()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Supplier name cannot be empty')
    const { data: existing, error: checkError } = await supabase
      .from('suppliers')
      .select('id, name, phone, address, created_at')
      .ilike('name', trimmed)
      .eq('business_id', businessId)
      .limit(1)
    
    if (existing && existing.length > 0) {
      return existing[0] as Supplier
    }
    
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: trimmed, business_id: businessId })
      .select('id, name, phone, address, created_at')
      .single()
    if (error) throw new Error(`Failed to create supplier: ${error.message}`)
    return data as Supplier
  },
}

// ─── Categories ────────────────────────────────────────────────────────────
export const categoriesApi = {
  async getAll(): Promise<Category[]> {
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('categories')
      .select('*')
      .eq('business_id', businessId)
      .order('name')
    if (error) throw new Error(`Categories fetch failed: ${error.message}`)
    const cats = data || []
    const OTHERS = ['others', 'other', 'अन्य']
    const main = cats.filter(c => !OTHERS.includes(c.name.toLowerCase()))
    const others = cats.filter(c => OTHERS.includes(c.name.toLowerCase()))
    return [...main, ...others]
  },
  async create(name: string): Promise<Category> {
    const businessId = getBusinessId()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Category name cannot be empty')
    const { data, error } = await supabase.from('categories').insert({
      name: trimmed,
      business_id: businessId,
    }).select().single()
    if (error) throw new Error(`Failed to create category: ${error.message}`)
    return data
  },
  async findOrCreate(name: string): Promise<Category> {
    const businessId = getBusinessId()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Category name cannot be empty')
    // Check if category already exists (case-insensitive)
    const { data: existing, error: checkError } = await supabase
      .from('categories')
      .select('id, name, business_id, created_at')
      .ilike('name', trimmed)
      .eq('business_id', businessId)
      .limit(1)
    
    if (existing && existing.length > 0) {
      return existing[0] as Category
    }
    
    // Create new category if it doesn't exist
    const { data, error } = await supabase.from('categories').insert({
      name: trimmed,
      business_id: businessId,
    }).select().single()
    if (error) throw new Error(`Failed to create category: ${error.message}`)
    return data as Category
  },
  async delete(id: string): Promise<void> {
    const businessId = getBusinessId()
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('business_id', businessId)
    if (error) throw new Error(`Failed to delete category: ${error.message}`)
  },
}

// ─── Products ──────────────────────────────────────────────────────────────
export const productsApi = {
  async getAll(): Promise<Product[]> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, brand, category_id, supplier_id, selling_price, unit, description,
        is_active, created_at, updated_at,
        categories ( id, name ),
        suppliers ( id, name ),
        inventory_batches ( quantity_remaining, cost_price )
      `)
      .eq('business_id', businessId)
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
    const businessId = getBusinessId()
    const { data, error } = await supabase.from('products').insert({
      ...product,
      business_id: businessId,
    }).select().single()
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
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).eq('business_id', businessId).select().single()
    if (error) throw new Error(`Failed to update product: ${error.message}`)
    return data
  },

  async delete(id: string): Promise<void> {
    const businessId = getBusinessId()
    const { error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id).eq('business_id', businessId)
    if (error) throw new Error(`Failed to archive product: ${error.message}`)
  },
}

// ─── Batches ───────────────────────────────────────────────────────────────
export const batchesApi = {
  async getByProduct(productId: string): Promise<InventoryBatch[]> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('inventory_batches').select('*').eq('product_id', productId).eq('business_id', businessId)
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
    business_id: string
  }): Promise<InventoryBatch> {
    const { data, error } = await supabase.from('inventory_batches').insert(batch).select().single()
    if (error) throw new Error(`Failed to create batch: ${error.message}`)
    return data
  },
}

// ─── Restock Record (return type for getRestockHistory) ────────────────────
export interface RestockRecord {
  id: string
  product_name: string
  supplier_name: string | null
  /** Actual quantity received — from inventory_batches if linked, else purchases.quantity */
  quantity: number
  /** Cost price per unit at time of restock */
  cost_price: number
  /** quantity × cost_price */
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_type: 'full' | 'credit' | 'partial'
  /** Date the stock was physically received */
  received_at: string
  created_at: string
}

// ─── Purchases ─────────────────────────────────────────────────────────────
export const purchasesApi = {
  async getAll(): Promise<import('../types').Purchase[]> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('purchases')
      .select(`*, suppliers(id, name), products(id, name)`)
      .eq('business_id', businessId)
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
    const businessId = getBusinessId()
    const store = useAuthStore.getState()
    const authUserId = store.user?.auth_user_id
    if (!authUserId) throw new Error('Not authenticated — no auth_user_id')
    
    const payload = {
      ...purchase,
      business_id: businessId,
      created_by: authUserId,
      original_payment_type: purchase.payment_type,
    }
    const { data, error } = await supabase.from('purchases').insert(payload).select().single()
    if (error) throw new Error(`Failed to create purchase: ${error.message}`)
    return data
  },

  async recordPayment(id: string, additionalPayment: number): Promise<void> {
    const businessId = getBusinessId()
    const { data: purchase } = await supabase
      .from('purchases').select('paid_amount, total_amount').eq('id', id).eq('business_id', businessId).single()
    if (!purchase) throw new Error('Purchase not found')
    const newPaid = Math.min(purchase.paid_amount + additionalPayment, purchase.total_amount)
    const newType = newPaid >= purchase.total_amount ? 'full' : 'partial'
    const { error } = await supabase
      .from('purchases').update({ paid_amount: newPaid, payment_type: newType }).eq('id', id).eq('business_id', businessId)
    if (error) throw new Error(`Failed to record payment: ${error.message}`)
  },

  async getFiltered(params: {
    startDate?: string
    endDate?: string
    supplierId?: string
    creditOnly?: boolean
  }): Promise<import('../types').Purchase[]> {
    const businessId = getBusinessId()
    let query = supabase
      .from('purchases')
      .select(`*, suppliers(id, name), products(id, name)`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    if (params.startDate)  query = query.gte('created_at', params.startDate + 'T00:00:00.000Z')
    if (params.endDate)    query = query.lte('created_at', params.endDate + 'T23:59:59.999Z')
    if (params.supplierId) query = query.eq('supplier_id', params.supplierId)
    if (params.creditOnly) query = query.in('original_payment_type', ['credit', 'partial'])
    const { data, error } = await query
    if (error) throw new Error(`Purchases fetch failed: ${error.message}`)
    return (data || []).map(p => ({ ...p, supplier: p.suppliers, product: p.products }))
  },

  /**
   * Restock History — every purchase linked to an inventory batch.
   * Joins: purchases → products, suppliers, inventory_batches
   * Used exclusively by the Reports → Restocks tab.
   */
  async getRestockHistory(params?: {
    startDate?: string
    endDate?: string
  }): Promise<RestockRecord[]> {
    const businessId = getBusinessId()
    let query = supabase
      .from('purchases')
      .select(`
        id,
        quantity,
        total_amount,
        paid_amount,
        payment_type,
        created_at,
        suppliers ( id, name ),
        products  ( id, name ),
        inventory_batches ( quantity_received, cost_price, received_at )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (params?.startDate) {
      query = query.gte('created_at', params.startDate + 'T00:00:00.000Z')
    }
    if (params?.endDate) {
      query = query.lte('created_at', params.endDate + 'T23:59:59.999Z')
    }

    const { data, error } = await query
    if (error) throw new Error(`Restock history fetch failed: ${error.message}`)

    return (data || []).map(p => {
      // Supabase returns single FK relations as objects (not arrays)
      const batch = (Array.isArray(p.inventory_batches) ? p.inventory_batches[0] : p.inventory_batches) as {
        quantity_received: number
        cost_price: number
        received_at: string
      } | null

      const costPerUnit  = batch?.cost_price  ?? 0
      const qty          = batch?.quantity_received ?? p.quantity
      const receivedAt   = batch?.received_at  ?? p.created_at
      const remaining    = round2(Math.max(0, p.total_amount - p.paid_amount))

      return {
        id:               p.id,
        product_name:     ((Array.isArray(p.products) ? p.products[0] : p.products) as { name: string } | null)?.name ?? 'Unknown Product',
        supplier_name:    ((Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers) as { name: string } | null)?.name ?? null,
        quantity:         qty,
        cost_price:       costPerUnit,
        total_amount:     p.total_amount,
        paid_amount:      p.paid_amount,
        remaining_amount: remaining,
        payment_type:     p.payment_type as 'full' | 'credit' | 'partial',
        received_at:      receivedAt,
        created_at:       p.created_at,
      }
    })
  },
}
