import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ─── Suppress Chrome Extension Noise ───────────────────────────────────────
// Prevent console spam from browser extensions that don't properly clean up
// async message listeners (React DevTools, Grammarly, LastPass, ad blockers, etc)
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('message channel closed') ||
    event.reason?.message?.includes('listener indicated an asynchronous response')
  ) {
    event.preventDefault() // silently suppress — not an app error
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
