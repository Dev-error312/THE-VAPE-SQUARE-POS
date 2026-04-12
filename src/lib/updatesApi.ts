import { supabase } from './supabase'
import { useAuthStore } from '../store/authStore'

/**
 * Universal Update - Same for all users/businesses
 * Works like iOS/Android/Windows app updates
 */
export interface Update {
  id: string
  title: string
  description: string
  version: string
  release_date: string
  is_published: boolean
  type?: string
  business_id?: string
  created_at: string
  updated_at: string
}

export interface BusinessSetting {
  id: string
  business_id: string
  setting_key: string
  setting_value: Record<string, any> | null
  description?: string
  created_at: string
  updated_at: string
}

function getBusinessId(): string {
  const store = useAuthStore.getState()
  if (!store.user?.business_id) throw new Error('Not authenticated — no business_id')
  return store.user.business_id
}

// ─── Updates (What's New) ──────────────────────────────────────────────────
/**
 * Universal API for managing app-wide updates.
 * All updates are visible to all users/businesses (like iOS/Android app updates).
 */
export const updatesApi = {
  /**
   * Get all published updates as a flat list (newest first)
   * @returns Promise<Update[]> - All updates visible to all users
   */
  async getAll(): Promise<Update[]> {
    const { data, error } = await supabase
      .from('updates')
      .select('*')
      .eq('is_published', true)
      .order('release_date', { ascending: false })
    if (error) throw new Error(`Failed to fetch updates: ${error.message}`)
    return data || []
  },

  /**
   * Get the next semantic version by looking at the latest update.
   * If latest version is 1.0.0, next will be 1.0.1
   * If no updates exist, returns 1.0.0
   * @returns Promise<string> - Next version (e.g., "1.0.1")
   */
  async getNextVersion(): Promise<string> {
    const { data, error } = await supabase
      .from('updates')
      .select('version')
      .eq('is_published', true)
      .order('release_date', { ascending: false })
      .limit(1)

    if (error) throw new Error(`Failed to fetch latest version: ${error.message}`)

    if (!data || data.length === 0) {
      return '1.0.0'
    }

    const latestVersion = data[0].version
    const parts = latestVersion.split('.')
    const patch = parseInt(parts[2] || '0', 10) + 1
    return `${parts[0]}.${parts[1] || '0'}.${patch}`
  },

  /**
   * Create a new update (admin only).
   * @param update - { title, description, release_date, version (optional), type (optional) }
   * @returns Promise<Update> - Created update with version
   */
  async create(update: {
    title: string
    description: string
    release_date: string
    version?: string
    is_published?: boolean
    type?: string
  }): Promise<Update> {
    // If no version provided, auto-increment it
    const version = update.version || (await this.getNextVersion())
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('updates')
      .insert({
        business_id: businessId,
        title: update.title,
        description: update.description,
        version,
        release_date: update.release_date,
        is_published: update.is_published ?? true,
        type: update.type ?? 'feature',
      })
      .select()
      .single()
    if (error) throw new Error(`Failed to create update: ${error.message}`)
    return data
  },

  /**
   * Check if the current user has unseen updates.
   * @returns Promise<boolean> - True if user hasn't seen the latest update
   */
  async hasUnseenUpdates(): Promise<boolean> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) return false

      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('last_seen_update_id')
        .eq('auth_user_id', user.id)
        .single()

      if (userError && userError.code !== 'PGRST116') return false

      // If no last seen update, check if any updates exist
      if (!userData?.last_seen_update_id) {
        const allUpdates = await this.getAll()
        return allUpdates.length > 0
      }

      // Check if there are newer updates than the last seen
      const { data: lastSeenUpdate, error: lastSeenError } = await supabase
        .from('updates')
        .select('release_date')
        .eq('id', userData.last_seen_update_id)
        .single()

      if (lastSeenError || !lastSeenUpdate) {
        const allUpdates = await this.getAll()
        return allUpdates.length > 0
      }

      const { data: newerUpdates, error: newerError } = await supabase
        .from('updates')
        .select('id')
        .eq('is_published', true)
        .gt('release_date', lastSeenUpdate.release_date)
        .limit(1)

      if (newerError) return false
      return (newerUpdates?.length ?? 0) > 0
    } catch {
      return false
    }
  },

  /**
   * Mark all current updates as seen by the user.
   */
  async markAsSeen(): Promise<void> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) return

      const { data: mostRecent, error: fetchError } = await supabase
        .from('updates')
        .select('id')
        .eq('is_published', true)
        .order('release_date', { ascending: false })
        .limit(1)
        .single()

      if (fetchError || !mostRecent) return

      await supabase
        .from('user_profiles')
        .update({ last_seen_update_id: mostRecent.id })
        .eq('auth_user_id', user.id)
    } catch {
      console.warn('Could not mark updates as seen')
    }
  },

  /**
   * Delete an update by ID (admin only).
   * @param updateId - The ID of the update to delete
   * @returns Promise<void>
   */
  async delete(updateId: string): Promise<void> {
    const { error } = await supabase
      .from('updates')
      .delete()
      .eq('id', updateId)
    if (error) throw new Error(`Failed to delete update: ${error.message}`)
  },
}

// ─── Business Settings ────────────────────────────────────────────────────
export const settingsApi = {
  async get(settingKey: string): Promise<BusinessSetting | null> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('business_id', businessId)
      .eq('setting_key', settingKey)
      .single()
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch setting: ${error.message}`)
    }
    return data || null
  },

  async getAll(): Promise<BusinessSetting[]> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('business_id', businessId)
    if (error) throw new Error(`Failed to fetch settings: ${error.message}`)
    return data || []
  },

  async set(
    settingKey: string,
    settingValue: Record<string, any>,
    description?: string
  ): Promise<BusinessSetting> {
    const businessId = getBusinessId()
    const { data, error } = await supabase
      .from('business_settings')
      .upsert(
        {
          business_id: businessId,
          setting_key: settingKey,
          setting_value: settingValue,
          description,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id,setting_key' }
      )
      .select()
      .single()
    if (error) throw new Error(`Failed to save setting: ${error.message}`)
    return data
  },

  async getBoolean(settingKey: string, defaultValue = false): Promise<boolean> {
    try {
      const setting = await this.get(settingKey)
      return setting?.setting_value?.enabled ?? defaultValue
    } catch {
      return defaultValue
    }
  },

  async setBoolean(settingKey: string, enabled: boolean): Promise<void> {
    await this.set(settingKey, { enabled })
  },
}
