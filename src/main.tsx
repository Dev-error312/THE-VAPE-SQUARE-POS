import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ─── Suppress Chrome Extension Noise ───────────────────────────────────────
// Prevent console spam from browser extensions that don't properly clean up
// async message listeners (React DevTools, Grammarly, LastPass, ad blockers, etc)
const isExtensionError = (error: any) => {
  const message = error?.message || String(error)
  return (
    message.includes('message channel closed') ||
    message.includes('listener indicated an asynchronous response') ||
    message.includes('Extension context invalidated') ||
    message.includes('The message port closed before a response was received')
  )
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
  if (isExtensionError(event.reason)) {
    event.preventDefault() // silently suppress — not an app error
  }
})

window.addEventListener('error', (event) => {
  if (isExtensionError(event.error)) {
    event.preventDefault() // silently suppress — not an app error
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
