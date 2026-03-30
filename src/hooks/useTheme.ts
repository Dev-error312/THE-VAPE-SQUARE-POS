import { useState, useEffect, useCallback } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'theme'

/** Read what the OS prefers right now. */
function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Apply or remove the `dark` class on <html>. */
function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', isDark)
}

/**
 * useTheme — single source of truth for the app's colour scheme.
 *
 * Returns:
 *   theme    — current stored preference ('dark' | 'light' | 'system')
 *   setTheme — update preference (persists to localStorage and applies immediately)
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      return stored && ['dark', 'light', 'system'].includes(stored) ? stored : 'dark'
    } catch {
      return 'dark'
    }
  })

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* quota exceeded */ }
  }, [theme])

  // Track OS preference when mode is 'system'
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}

/**
 * Inline script for index.html <head>.
 * Reads localStorage and applies the correct class BEFORE React hydrates —
 * this eliminates the flash-of-wrong-theme (FOWT).
 *
 * Paste this verbatim inside a <script> tag in index.html:
 *
 *   (function(){
 *     var t=localStorage.getItem('theme')||'dark';
 *     var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
 *     if(d) document.documentElement.classList.add('dark');
 *   })();
 */
export const ANTI_FLICKER_SCRIPT = `(function(){var t=localStorage.getItem('theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');})();`
