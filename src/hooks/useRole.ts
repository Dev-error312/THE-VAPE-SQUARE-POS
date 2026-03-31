import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'

/** Returns true only when the logged-in user has the admin role */
export function useIsAdmin(): boolean {
  const user = useAuthStore(s => s.user)
  return user?.role === 'admin'
}

/** Returns the current user's role safely */
export function useRole(): UserRole | null {
  const user = useAuthStore(s => s.user)
  return user?.role ?? null
}

/** Returns the current user's business_id — throws if not authenticated */
export function useBusinessId(): string {
  const user = useAuthStore(s => s.user)
  if (!user?.business_id) {
    throw new Error('Not authenticated — no business_id in session')
  }
  return user.business_id
}

/** Returns the current user's business name */
export function useBusinessName(): string {
  const user = useAuthStore(s => s.user)
  return user?.business_name ?? 'Unknown Business'
}