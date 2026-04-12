export type UserRole = 'admin' | 'cashier'

export interface User {
  id: string
  auth_user_id: string
  email: string
  full_name?: string
  name?: string
  role: UserRole
  business_id: string
  business_name?: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  address?: string
  created_at: string
}

export interface Product {
  id: string
  name: string
  brand?: string
  category_id: string | null
  category_name?: string
  supplier_id?: string | null
  supplier_name?: string
  selling_price: number
  unit: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  total_stock?: number
  avg_cost?: number
  barcode?: string
  barcode_type?: string
}

export interface InventoryBatch {
  id: string
  product_id: string
  product?: Product
  batch_number: string
  quantity_received: number
  quantity_remaining: number
  cost_price: number
  supplier_id?: string | null
  supplier?: Supplier
  notes?: string
  received_at: string
  created_at: string
  created_by?: string
}

export interface Purchase {
  id: string
  supplier_id: string | null
  supplier?: Supplier
  product_id: string | null
  product?: Product
  batch_id?: string | null
  quantity: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
  payment_type: 'full' | 'credit' | 'partial'
  notes?: string
  created_at: string
  created_by?: string
}

export interface Expense {
  id: string
  title: string
  amount: number
  expense_date: string
  notes?: string
  created_at: string
  created_by?: string
}

export interface DamagedProduct {
  id: string
  product_id: string | null
  product_name: string
  quantity: number
  cost_price: number
  loss_amount: number
  damage_date: string
  notes?: string
  created_at: string
}

export type PaymentMethod = 'cash' | 'online' | 'split'

export interface Sale {
  id: string
  sale_number: string
  subtotal: number
  discount_type: 'percentage' | 'fixed' | 'none'
  discount_value: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total: number
  payment_method: PaymentMethod
  cash_amount: number
  online_amount: number
  change_amount: number
  status: 'completed' | 'refunded' | 'void'
  notes?: string
  created_at: string
  created_by?: string
  sale_items?: SaleItem[]
  payments?: Payment[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product?: Product
  batch_id?: string
  product_name: string
  quantity: number
  cost_price: number
  unit_price: number
  discount_amount: number
  line_total: number
}

export interface Payment {
  id: string
  sale_id: string
  method: 'cash' | 'online'
  amount: number
  reference?: string
  created_at: string
}

export interface CartItem {
  product: Product
  quantity: number
  unit_price: number
  discount_amount: number
  batch_id?: string
  cost_price: number
}

export interface DashboardStats {
  today_sales: number
  today_revenue: number
  today_profit: number
  total_products: number
  low_stock_count: number
  monthly_revenue: number
  monthly_sales: number
  // Stock valuation
  total_stock_value: number       // SUM(cost_price * quantity_remaining)
  potential_selling_value: number // SUM(selling_price * quantity_remaining)
  potential_profit: number        // potential_selling_value - total_stock_value
}

export interface AnalyticsRow {
  date: string
  sales: number
  revenue: number
  gross_profit: number
  expenses: number
  damages: number
  net_profit: number
}

export interface WholesaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price: number
  line_total: number
}

export interface WholesaleSale {
  id: string
  sale_number: string
  customer_name: string
  customer_phone: string | null
  items: WholesaleItem[]
  subtotal: number
  discount_amount: number
  total: number
  payment_method: 'cash' | 'online' | 'credit' | 'split'
  status: 'completed' | 'pending' | 'cancelled'
  notes: string | null
  created_at: string
  sale_date: string
}
