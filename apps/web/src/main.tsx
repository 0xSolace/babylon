/**
 * Client entry point for Babylon Web
 *
 * Main entry point for the static build with Bun.
 */

import {
  setDefaultEnvironment,
  setDefaultJejuNetwork,
  setDefaultJejuRpcUrl,
} from '@babylon/shared'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './app/globals.css'

// Configure environment based on build - MUST be done before any config reads
const network = (process.env.NETWORK || 'localnet') as
  | 'localnet'
  | 'testnet'
  | 'mainnet'

// Set the Babylon app environment (controls API URL, chain ID, etc.)
setDefaultEnvironment(network)

// Set Jeju network for compute/storage integration
setDefaultJejuNetwork(network)

// Use correct RPC port (6546 for Jeju localnet, not 6545)
if (network === 'localnet') {
  setDefaultJejuRpcUrl('http://localhost:6546')
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
