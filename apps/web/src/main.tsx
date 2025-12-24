/**
 * Client entry point for Babylon Web
 *
 * Main entry point for the static build with Bun.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// CSS is built separately with Tailwind CLI and injected via index.html

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
