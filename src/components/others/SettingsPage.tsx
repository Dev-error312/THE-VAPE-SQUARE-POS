import { useEffect, useState, useCallback } from 'react'
import { settingsApi } from '../../lib/updatesApi'
import { Settings as SettingsIcon, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { invalidateSettingsCache } from '../../hooks/useSettings'
import { setGlobalFormatSettings } from '../../utils/dynamicFormatters'

interface BusinessSettings {
  printer_enabled: boolean
  automatic_backup: boolean
  notification_enabled: boolean
  tax_calculation_enabled: boolean
  low_stock_alert_enabled: boolean
  discount_approval_required: boolean
  date_format: 'AD' | 'BS'
  currency: 'NPR' | 'USD'
}

const DEFAULT_SETTINGS: BusinessSettings = {
  printer_enabled: false,
  automatic_backup: false,
  notification_enabled: true,
  tax_calculation_enabled: false,
  low_stock_alert_enabled: true,
  discount_approval_required: false,
  date_format: 'AD',
  currency: 'NPR',
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const allSettings = await settingsApi.getAll()
      const loaded: Partial<BusinessSettings> = {}

      // Load all settings from database
      for (const [key] of Object.entries(DEFAULT_SETTINGS)) {
        const setting = allSettings.find(s => s.setting_key === key)
        if (setting?.setting_value) {
          loaded[key as keyof BusinessSettings] = setting.setting_value.value ?? DEFAULT_SETTINGS[key as keyof BusinessSettings]
        }
      }

      setSettings(prev => ({ ...prev, ...loaded }))
    } catch (e: unknown) {
      console.log('Using default settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleToggle = (key: keyof BusinessSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSelectChange = (key: keyof BusinessSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save all settings
      for (const [key, value] of Object.entries(settings)) {
        if (typeof value === 'boolean') {
          await settingsApi.set(key, { value: value }, `Boolean setting for ${key}`)
        } else {
          await settingsApi.set(key, { value }, `Setting for ${key}`)
        }
      }
      
      // Update global format settings immediately so changes take effect instantly
      setGlobalFormatSettings({
        dateFormat: settings.date_format,
        currency: settings.currency,
      })
      
      // Also refresh cache for context updates
      invalidateSettingsCache()
      
      toast.success('Settings saved successfully')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  const settingGroups: Array<{
    title: string
    description: string
    settings: Array<{
      key: keyof BusinessSettings
      label: string
      description: string
      icon: string
      type: 'select' | 'toggle'
      options?: Array<{ value: string; label: string }>
    }>
  }> = [
    {
      title: 'Localization & Format',
      description: 'Configure date format and currency preferences for your business',
      settings: [
        {
          key: 'date_format',
          label: 'Date Format',
          description: 'Choose between Gregorian Calendar (AD) or Nepali Calendar (BS)',
          icon: '📅',
          type: 'select',
          options: [
            { value: 'AD', label: 'Gregorian (AD) - 12 Jun 2025' },
            { value: 'BS', label: 'Nepali (BS) - 29 जेष्ठ 2082' },
          ]
        },
        {
          key: 'currency',
          label: 'Currency',
          description: 'Select the primary currency for your business',
          icon: '💰',
          type: 'select',
          options: [
            { value: 'NPR', label: 'Nepali Rupee (रु)' },
            { value: 'USD', label: 'US Dollar ($)' },
          ]
        },
      ]
    },
    {
      title: 'Printing & Hardware',
      description: 'Configure printer and hardware settings',
      settings: [
        {
          key: 'printer_enabled',
          label: 'Enable Printer',
          description: 'Automatically print receipts after sale completion',
          icon: '🖨️',
          type: 'toggle'
        },
      ]
    },
    {
      title: 'System Features',
      description: 'Toggle system features and functionality',
      settings: [
        {
          key: 'automatic_backup',
          label: 'Automatic Backup',
          description: 'Automatically backup data daily at midnight',
          icon: '💾',
          type: 'toggle'
        },
        {
          key: 'notification_enabled',
          label: 'Notifications',
          description: 'Show low stock and important alerts',
          icon: '🔔',
          type: 'toggle'
        },
        {
          key: 'tax_calculation_enabled',
          label: 'Tax Calculation',
          description: 'Enable tax in price calculations',
          icon: '📊',
          type: 'toggle'
        },
      ]
    },
    {
      title: 'Alerts & Approvals',
      description: 'Configure business rules and approvals',
      settings: [
        {
          key: 'low_stock_alert_enabled',
          label: 'Low Stock Alerts',
          description: 'Alert when product stock falls below threshold',
          icon: '⚠️',
          type: 'toggle'
        },
        {
          key: 'discount_approval_required',
          label: 'Discount Approval',
          description: 'Require admin approval for discounts above 20%',
          icon: '✓',
          type: 'toggle'
        },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary-100 dark:bg-primary-900/30 rounded-lg p-3">
              <SettingsIcon className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Settings
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">Manage your business preferences and system settings</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {settingGroups.map((group) => (
            <div key={group.title} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Group Header */}
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-semibold text-slate-900 dark:text-white">{group.title}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{group.description}</p>
              </div>

              {/* Settings */}
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {group.settings.map((setting) => (
                  <div
                    key={setting.key}
                    className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-2xl">{setting.icon}</div>
                      <div className="min-w-0">
                        <label className="font-medium text-slate-900 dark:text-white cursor-pointer block">
                          {setting.label}
                        </label>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          {setting.description}
                        </p>
                      </div>
                    </div>

                    {/* Control - Toggle or Select */}
                    {setting.type === 'toggle' ? (
                      <button
                        onClick={() => handleToggle(setting.key)}
                        className={`ml-4 relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                          settings[setting.key]
                            ? 'bg-emerald-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            settings[setting.key] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : (
                      <select
                        value={settings[setting.key] as string}
                        onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                        className="ml-4 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 flex-shrink-0"
                      >
                        {setting.options && setting.options.map((opt: any) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Note:</strong> Your settings are saved and shared with your entire team. You'll see changes right away after saving.
          </p>
        </div>
      </div>
    </div>
  )
}
