# Database Schema Analysis: business_settings Table

## Current State

### Table Structure
The `business_settings` table stores per-business configuration settings as flexible JSON documents.

**Current Columns:**
```
id              → UUID (primary key)
business_id     → UUID (foreign key to businesses table)
setting_key     → VARCHAR (unique identifier for the setting)
setting_value   → JSONB (flexible JSON object, can be null)
description     → VARCHAR (optional documentation)
created_at      → TIMESTAMP
updated_at      → TIMESTAMP
```

**TypeScript Interface:**
```typescript
export interface BusinessSetting {
  id: string
  business_id: string
  setting_key: string
  setting_value: Record<string, any> | null
  description?: string
  created_at: string
  updated_at: string
}
```

### Current Settings
Currently stored as boolean settings with `{ enabled: true|false }` structure:

**In SettingsPage.tsx:**
- `printer_enabled` → Controls receipt printing
- `automatic_backup` → Daily backup at midnight
- `notification_enabled` → System notifications
- `tax_calculation_enabled` → Tax calculation
- `low_stock_alert_enabled` → Stock alerts
- `discount_approval_required` → Approval workflow

---

## Hardcoded Formatting (Current Issue)

### Currency
**Location:** `src/utils/index.ts`
- **Hardcoded to:** Nepali Rupee (रु) with `en-IN` locale
- **Function:** `formatCurrency()` and `formatCurrencyDecimal()`
- **Format:** "रु 1,75,000" (lakh system)
- **Used in:** POSPage, InventoryPage, Reports, Accounting, all financial displays

### Date Format
**Location:** `src/utils/index.ts`
- **Hardcoded to:** English format `en-US` locale
- **Function:** `formatDate()` displays "12 Jun 2025"
- **Function:** `formatDateTime()` displays "12 Jun 2025, 02:30 PM"
- **Supabase filters use:** `en-CA` locale (YYYY-MM-DD) internally for UTC+5:45 (Nepal timezone)

---

## Proposed Schema Addition for Preferences

### New Setting Keys to Add

#### 1. `date_format`
Store user's preferred date display format.

**Current Usage Pattern:**
```typescript
setting_key: "date_format"
setting_value: {
  format: "DD-MMM-YYYY",  // or other format
  locale: "en-US",         // display locale
  timezone: "Asia/Kathmandu"
}
```

**Supported Formats (examples):**
- `"DD-MMM-YYYY"` → "12-Jun-2025"
- `"DD/MM/YYYY"` → "12/06/2025"
- `"YYYY-MM-DD"` → "2025-06-12"
- `"MMM DD, YYYY"` → "Jun 12, 2025"

#### 2. `currency_preferences`
Store business currency configuration.

**Current Usage Pattern:**
```typescript
setting_key: "currency_preferences"
setting_value: {
  code: "NPR",              // ISO 4217 currency code
  symbol: "रु",              // Display symbol
  locale: "en-IN",          // Formatting locale
  decimalPlaces: 2,         // Precision for display
  thousandsSeparator: ","   // Or "." or " "
  currencyPosition: "prefix", // "prefix" or "suffix"
  currencySpacing: true     // Space between symbol and amount
}
```

**Example for Nepal:**
```json
{
  "code": "NPR",
  "symbol": "रु",
  "locale": "en-IN",
  "decimalPlaces": 2,
  "thousandsSeparator": ",",
  "currencyPosition": "prefix",
  "currencySpacing": true
}
```

**Example for US Dollar:**
```json
{
  "code": "USD",
  "symbol": "$",
  "locale": "en-US",
  "decimalPlaces": 2,
  "thousandsSeparator": ",",
  "currencyPosition": "prefix",
  "currencySpacing": false
}
```

**Example for Indian Rupee:**
```json
{
  "code": "INR",
  "symbol": "₹",
  "locale": "en-IN",
  "decimalPlaces": 0,  // No decimal places for rupees
  "thousandsSeparator": ",",
  "currencyPosition": "prefix",
  "currencySpacing": true
}
```

#### 3. `timezone` (optional, separate from date_format)
```typescript
setting_key: "timezone"
setting_value: {
  timezone: "Asia/Kathmandu"  // IANA timezone identifier
}
```

---

## API Usage Pattern

The `settingsApi` in `src/lib/updatesApi.ts` provides these methods:

```typescript
// Get a single setting
const setting = await settingsApi.get('currency_preferences')

// Get all settings
const allSettings = await settingsApi.getAll()

// Set/update a setting
await settingsApi.set('currency_preferences', {
  code: 'NPR',
  symbol: 'रु',
  locale: 'en-IN',
  // ...
}, 'Business currency configuration')

// Boolean helpers (for simple on/off settings)
const enabled = await settingsApi.getBoolean('printer_enabled', false)
await settingsApi.setBoolean('printer_enabled', true)
```

---

## Migration Steps (When Ready)

### 1. Add Sample Data to Supabase

```sql
-- Insert default date_format setting
INSERT INTO business_settings (business_id, setting_key, setting_value, description)
VALUES (
  $1,  -- business_id
  'date_format',
  '{"format": "DD-MMM-YYYY", "locale": "en-US", "timezone": "Asia/Kathmandu"}',
  'Date display format preferences'
)
ON CONFLICT (business_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Insert default currency_preferences setting
INSERT INTO business_settings (business_id, setting_key, setting_value, description)
VALUES (
  $1,  -- business_id
  'currency_preferences',
  '{"code": "NPR", "symbol": "रु", "locale": "en-IN", "decimalPlaces": 2, "thousandsSeparator": ",", "currencyPosition": "prefix", "currencySpacing": true}',
  'Business currency and formatting preferences'
)
ON CONFLICT (business_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
```

### 2. Create Settings UI Component

New form fields in SettingsPage.tsx:
- Currency code selector (dropdown: NPR, USD, INR, EUR, etc.)
- Currency symbol input
- Date format selector (dropdown)
- Timezone selector (dropdown)
- Preview panes showing formatted currency and dates

### 3. Update Formatting Utilities

Modify `src/utils/index.ts`:
- Make `formatCurrency()` read from business settings
- Make `formatDate()` and `formatDateTime()` read from business settings
- Add locale detection logic
- Add fallback to current hardcoded values

---

## Files Affected by These Changes

**Core Implementation:**
- `src/lib/updatesApi.ts` — Already has the API, no changes needed
- `src/utils/index.ts` — Must be updated to read from settings

**UI Components:**
- `src/components/others/SettingsPage.tsx` — Add date/currency preference forms
- `src/types/index.ts` — Optionally add types for the settings values

**Uses formatCurrency() — affects display in:**
- `src/components/pos/CheckoutModal.tsx`
- `src/components/dashboard/DashboardPage.tsx`
- `src/components/reports/ReportsPage.tsx`
- `src/components/accounting/AccountingPage.tsx`
- `src/components/expenses/ExpensesPage.tsx`
- `src/components/credits/CreditsPage.tsx`
- Many other components

---

## Important Notes

1. **No SQL Migration Required** — The table already exists and the `setting_value` JSONB column is flexible enough to store any structure

2. **Backward Compatibility** — Keep the current hardcoded values as defaults if settings are not found

3. **Timezone Handling** — Supabase filters use `en-CA` locale (YYYY-MM-DD) internally. The display format should be separate from the storage format.

4. **Performance** — The formatting functions are called frequently. Cache the settings in a React hook (like `useSettings()`) to avoid repeated database queries.

5. **Real-time Updates** — Consider using Supabase's real-time subscriptions if multiple users share the same business account.

---

## Summary

| Aspect | Current State | Needed for Preferences |
|--------|---------------|------------------------|
| **Currency Symbol** | Hardcoded: रु | Store in business_settings |
| **Currency Locale** | Hardcoded: en-IN | Store in business_settings |
| **Date Format** | Hardcoded: en-US "12 Jun 2025" | Store in business_settings |
| **Date Locale** | Hardcoded: en-US | Store in business_settings |
| **Timezone** | Hardcoded: Asia/Kathmandu | Store in business_settings |
| **API Layer** | ✅ Exists (`settingsApi`) | ✅ Ready to use |
| **Database Table** | ✅ Exists (flexible JSONB) | ✅ Ready to use |
