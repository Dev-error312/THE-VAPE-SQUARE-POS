import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ─── Suppress Chrome Extension Noise ───────────────────────────────────────
// Prevent console spam from browser extensions that don't properly clean up
// async message listeners (React DevTools, Grammarly, LastPass, ad blockers, etc)
const isExtensionError = (error: any) => {
  const message = (error?.message || String(error)).toLowerCase()
  const extensionKeywords = [
    'message channel closed',
    'listener indicated an asynchronous response',
    'extension context invalidated',
    'message port closed before a response was received',
    'the message port closed',
    'asynchronous response by returning true',
  ]
  return extensionKeywords.some(keyword => message.includes(keyword))
}

// Suppress in console.error to prevent logging
const originalError = console.error
console.error = function(...args: any[]) {
  const message = args[0]?.message || String(args[0])
  if (!isExtensionError(message)) {
    originalError.apply(console, args)
  }
}

window.addEventListener('unhandledrejection', (event) => {
  // Extract error message from various sources
  const reason = event.reason
  const message = reason?.message || String(reason)
  
  if (isExtensionError(reason) || isExtensionError(message)) {
    event.preventDefault() // silently suppress — not an app error
  }
})

window.addEventListener('error', (event) => {
  if (isExtensionError(event.error) || isExtensionError(event.message)) {
    event.preventDefault() // silently suppress — not an app error
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
