import { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { useSettings, BusinessSettings } from '../hooks/useSettings'
import { setGlobalFormatSettings } from '../utils/dynamicFormatters'
import { onSettingsChange } from '../utils/settingsEvents'

interface SettingsContextType {
  settings: BusinessSettings
  loading: boolean
}

const SettingsContext = createContext<SettingsContextType | null>(null)

/**
 * Provider component that should wrap the entire app
 * Provides access to business settings throughout the component tree
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { settings, loading } = useSettings()
  const [, setRenderCounter] = useState(0)

  // Sync settings to global state for dynamic formatters
  useEffect(() => {
    setGlobalFormatSettings({
      dateFormat: settings.date_format,
      currency: settings.currency,
    })
  }, [settings.date_format, settings.currency])

  // Subscribe to settings changes to trigger re-renders
  useEffect(() => {
    const unsubscribe = onSettingsChange(() => {
      setRenderCounter((prev: number) => prev + 1)
    })
    return unsubscribe
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

/**
 * Hook to access business settings from anywhere in the app
 * Must be used within a SettingsProvider
 */
export function useSettingsContext(): SettingsContextType {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettingsContext must be used within SettingsProvider')
  }
  return context
}
