import { useEffect, useRef } from 'react'

interface UseBarcodeScannnerOptions {
  enabled?: boolean
  onScan: (barcode: string) => void
  minLength?: number
  scanDelay?: number
}

/**
 * Hook that listens for barcode scanner input.
 * 
 * Barcode scanners send their output as rapid keystrokes followed by Enter.
 * This hook buffers characters that arrive within scanDelay (default 50ms) of each other,
 * and fires onScan when Enter is pressed (if buffer length >= minLength).
 * 
 * Does NOT intercept if focus is on an INPUT or TEXTAREA element — manual typing is never blocked.
 */
export function useBarcodeScanner({
  enabled = true,
  onScan,
  minLength = 3,
  scanDelay = 50,
}: UseBarcodeScannnerOptions) {
  const bufferRef = useRef<string>('')
  const lastKeystrokeRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement
      const isFocusedInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'

      // Don't intercept if user is typing in a form field
      if (isFocusedInput) return

      const now = Date.now()
      const timeSinceLastKeystroke = now - lastKeystrokeRef.current

      // If gap is too large (> scanDelay), reset buffer — human typing, not scanner
      if (timeSinceLastKeystroke > scanDelay && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      lastKeystrokeRef.current = now

      if (e.key === 'Enter') {
        // End of barcode input
        if (bufferRef.current.length >= minLength) {
          onScan(bufferRef.current)
        }
        bufferRef.current = ''
        e.preventDefault()
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Regular keystroke — add to buffer
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onScan, minLength, scanDelay])
}
