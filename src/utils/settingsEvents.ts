/**
 * Global event system to notify the app when settings change
 * This allows components to react to setting changes in real-time
 */

type SettingsChangeCallback = () => void

const settingsChangeListeners = new Set<SettingsChangeCallback>()

/**
 * Subscribe to settings changes
 * Returns an unsubscribe function
 */
export function onSettingsChange(callback: SettingsChangeCallback): () => void {
  settingsChangeListeners.add(callback)
  return () => settingsChangeListeners.delete(callback)
}

/**
 * Notify all listeners that settings have changed
 * Called internally when settings are updated
 */
export function notifySettingsChanged(): void {
  settingsChangeListeners.forEach(callback => {
    try {
      callback()
    } catch (error) {
      console.error('Error in settings change listener:', error)
    }
  })
}
