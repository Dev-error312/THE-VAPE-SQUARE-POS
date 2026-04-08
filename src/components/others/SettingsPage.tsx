import { useEffect, useState, useCallback } from 'react'
import { settingsApi } from '../../lib/updatesApi'
import { Settings as SettingsIcon, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Toggle settings
  const [settings, setSettings] = useState({
    printer_enabled: false,
    automatic_backup: false,
    notification_enabled: true,
    tax_calculation_enabled: false,
    low_stock_alert_enabled: true,
    discount_approval_required: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Load all settings
      const allSettings = await settingsApi.getAll()
      const loaded: Record<string, boolean> = {}

      for (const [key] of Object.entries(settings)) {
        const setting = allSettings.find(s => s.setting_key === key)
        loaded[key] = setting?.setting_value?.enabled ?? settings[key as keyof typeof settings]
      }

      setSettings(prev => ({ ...prev, ...loaded }))
    } catch (e: unknown) {
      // Settings might not exist yet, use defaults
      console.log('Using default settings')
    } finally {
      setLoading(false)
    }
  }, [settings])

  useEffect(() => {
    load()
  }, [load])

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save all settings
      for (const [key, value] of Object.entries(settings)) {
        await settingsApi.setBoolean(key, value as boolean)
      }
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

  const settingGroups = [
    {
      title: 'Printing & Hardware',
      description: 'Configure printer and hardware settings',
      settings: [
        {
          key: 'printer_enabled' as const,
          label: 'Enable Printer',
          description: 'Automatically print receipts after sale completion',
          icon: '🖨️'
        },
      ]
    },
    {
      title: 'System Features',
      description: 'Toggle system features and functionality',
      settings: [
        {
          key: 'automatic_backup' as const,
          label: 'Automatic Backup',
          description: 'Automatically backup data daily at midnight',
          icon: '💾'
        },
        {
          key: 'notification_enabled' as const,
          label: 'Notifications',
          description: 'Show low stock and important alerts',
          icon: '🔔'
        },
        {
          key: 'tax_calculation_enabled' as const,
          label: 'Tax Calculation',
          description: 'Enable tax in price calculations',
          icon: '📊'
        },
      ]
    },
    {
      title: 'Alerts & Approvals',
      description: 'Configure business rules and approvals',
      settings: [
        {
          key: 'low_stock_alert_enabled' as const,
          label: 'Low Stock Alerts',
          description: 'Alert when product stock falls below threshold',
          icon: '⚠️'
        },
        {
          key: 'discount_approval_required' as const,
          label: 'Discount Approval',
          description: 'Require admin approval for discounts above 20%',
          icon: '✓'
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

                  {/* Toggle Switch */}
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
          <strong>Note:</strong> Settings are saved per business and apply to all users in your organization.
        </p>
      </div>
      </div>
    </div>
  )
}
