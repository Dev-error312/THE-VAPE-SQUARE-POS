/**
 * Global refresh store — single source of truth for cross-page data invalidation.
 * When any page mutates shared data (delete sale, add expense, etc.) it calls
 * refreshStore.trigger(). Every page that depends on that data listens via
 * useRefreshStore and re-fetches when the counter changes.
 */
import { create } from 'zustand'

interface RefreshState {
  salesVersion: number    // increment to trigger sales/dashboard/analytics reload
  triggerSales: () => void
}

export const useRefreshStore = create<RefreshState>((set) => ({
  salesVersion: 0,
  triggerSales: () => set(s => ({ salesVersion: s.salesVersion + 1 })),
}))
