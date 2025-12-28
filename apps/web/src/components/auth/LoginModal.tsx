import { useJejuAuth } from '@jejunetwork/auth'
import { useEffect, useRef } from 'react'

/**
 * Login modal component that triggers the Jeju auth login flow.
 *
 * Acts as a wrapper that triggers the authentication modal when
 * opened. Automatically closes when user successfully authenticates.
 * Supports custom title and message for context-specific login prompts.
 *
 * @param props - LoginModal component props
 * @returns null (delegates to auth modal)
 *
 * @example
 * ```tsx
 * <LoginModal
 *   isOpen={showLogin}
 *   onClose={() => setShowLogin(false)}
 *   title="Sign in to trade"
 *   message="You need to be signed in to place trades"
 * />
 * ```
 */
interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message?: string
}

export function LoginModal({
  isOpen,
  onClose,
  title,
  message,
}: LoginModalProps) {
  const { authenticated, ready, loginWithWallet } = useJejuAuth()
  const attemptedLoginRef = useRef(false)

  // Close modal when user logs in
  useEffect(() => {
    if (authenticated && isOpen) {
      onClose()
    }
  }, [authenticated, isOpen, onClose])

  // Trigger login modal when this component opens
  useEffect(() => {
    if (!isOpen || !ready || authenticated) {
      attemptedLoginRef.current = false
      return
    }

    if (!attemptedLoginRef.current) {
      attemptedLoginRef.current = true
      // Trigger wallet-based login (SIWE)
      loginWithWallet()
    }
  }, [isOpen, ready, authenticated, loginWithWallet])

  // title and message are used for context-specific login prompts
  // They can be displayed in the auth modal if needed
  void title
  void message

  // This component triggers the login flow, no custom UI needed
  return null
}
