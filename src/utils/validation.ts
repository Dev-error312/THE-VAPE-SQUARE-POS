export interface ValidationResult {
  valid: boolean
  error: string | null
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || !value.trim()) return { valid: false, error: `${fieldName} is required` }
  return { valid: true, error: null }
}

export function validateProductName(name: string): ValidationResult {
  const trimmed = name.trim()
  if (!trimmed) return { valid: false, error: 'Product name is required' }
  if (trimmed.length < 2) return { valid: false, error: 'Product name must be at least 2 characters' }
  if (trimmed.length > 150) return { valid: false, error: 'Product name is too long (max 150 characters)' }
  return { valid: true, error: null }
}

export function validatePrice(value: string | number, fieldName = 'Price'): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (value === '' || value === null || value === undefined) return { valid: false, error: `${fieldName} is required` }
  if (isNaN(num)) return { valid: false, error: `${fieldName} must be a valid number` }
  if (num < 0) return { valid: false, error: `${fieldName} cannot be negative` }
  if (num > 10_000_000) return { valid: false, error: `${fieldName} value seems too large` }
  return { valid: true, error: null }
}

export function validateQuantity(value: string | number, fieldName = 'Quantity', min = 1): ValidationResult {
  const num = typeof value === 'string' ? parseInt(value, 10) : value
  if (value === '' || value === null || value === undefined) return { valid: false, error: `${fieldName} is required` }
  if (isNaN(num) || !Number.isInteger(num)) return { valid: false, error: `${fieldName} must be a whole number` }
  if (num < min) return { valid: false, error: `${fieldName} must be at least ${min}` }
  if (num > 100_000) return { valid: false, error: `${fieldName} value seems too large` }
  return { valid: true, error: null }
}

export function validateSellingPrice(selling: number, cost: number): ValidationResult {
  if (selling <= 0) return { valid: false, error: 'Selling price must be greater than 0' }
  if (selling < cost) return { valid: false, error: 'Selling price should not be lower than cost price' }
  return { valid: true, error: null }
}

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim()
  if (!trimmed) return { valid: false, error: 'Email is required' }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(trimmed)) return { valid: false, error: 'Please enter a valid email address' }
  return { valid: true, error: null }
}

/** Run multiple validators and return the first error found, or null if all pass. */
export function runValidations(...results: ValidationResult[]): string | null {
  for (const r of results) {
    if (!r.valid) return r.error
  }
  return null
}
