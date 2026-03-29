import { useAuthStore } from '../store/authStore'

/** Returns true only when the logged-in user has the admin role. */
export function useIsAdmin(): boolean {
  const user = useAuthStore(s => s.user)
  return user?.role === 'admin'
}

/** Returns the current user's role safely */
export function useRole(): 'admin' | 'cashier' | null {
  const user = useAuthStore(s => s.user)

  if (!user) return null
  if (user.role === 'admin' || user.role === 'cashier') {
    return user.role
  }

  return null 
}