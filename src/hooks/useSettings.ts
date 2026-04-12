import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { settingsApi } from '../lib/updatesApi'
import { onSettingsChange } from '../utils/settingsEvents'

/**
 * Business settings from the database
 */
export interface BusinessSettings {
  date_format: 'AD' | 'BS'
  currency: 'NPR' | 'USD'
  printer_enabled: boolean
  automatic_backup: boolean
  notification_enabled: boolean
  tax_calculation_enabled: boolean
  low_stock_alert_enabled: boolean
  discount_approval_required: boolean
}

const DEFAULT_SETTINGS: BusinessSettings = {
  date_format: 'AD',
  currency: 'NPR',
  printer_enabled: false,
  automatic_backup: false,
  notification_enabled: true,
  tax_calculation_enabled: false,
  low_stock_alert_enabled: true,
  discount_approval_required: false,
}

// Global cache version to force refetches
let settingsCacheVersion = 0

export function invalidateSettingsCache(): void {
  settingsCacheVersion++
}

/**
 * Hook to read business settings from the database
 * Settings are cached at the app level to avoid repeated DB hits
 * 
 * Usage:
 * const { settings, loading } = useSettings()
 * if (settings.currency === 'USD') { ... }
 */
export function useSettings(): { settings: BusinessSettings; loading: boolean; error: Error | null } {
  const user = useAuthStore(s => s.user)
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user?.business_id) {
      setLoading(false)
      return
    }

    const loadSettings = async () => {
      try {
        setLoading(true)
        const allSettings = await settingsApi.getAll()
        const loaded: Partial<BusinessSettings> = {}

        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          const setting = allSettings.find(s => s.setting_key === key)
          if (setting?.setting_value?.value !== undefined) {
            loaded[key as keyof BusinessSettings] = setting.setting_value.value
          }
        }

        setSettings(prev => ({ ...prev, ...loaded } as BusinessSettings))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load settings'))
        console.warn('Failed to load business settings, using defaults', err)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [user?.business_id, settingsCacheVersion])

  return { settings, loading, error }
}

/**
 * Hook that causes a component to re-render when settings change
 * Use this in components that display formatted dates/currencies
 * 
 * Usage:
 * function MyComponent() {
 *   useSettingsChanges() // Subscribes to settings changes
 *   // Component will re-render when settings change
 * }
 */
export function useSettingsChanges(): void {
  const [, setChangeCounter] = useState(0)

  useEffect(() => {
    // Subscribe to settings changes
    const unsubscribe = onSettingsChange(() => {
      // Trigger a re-render by incrementing the counter
      setChangeCounter(prev => prev + 1)
    })

    // Clean up subscription on unmount
    return unsubscribe
  }, [])
}
