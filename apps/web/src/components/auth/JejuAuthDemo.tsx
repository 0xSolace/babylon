/**
 * JejuAuth Demo Component
 *
 * Demonstrates how to use the decentralized auth system.
 * This can be used as a reference or directly included in pages.
 */

'use client';

import {
  JejuAuthProvider,
  LoginButton,
  useJejuAuth,
  useJejuWallet,
} from '@babylon/auth/client';

interface DemoContentProps {
  onLogout?: () => void;
}

/**
 * Demo content that uses the auth hooks
 */
function DemoContent({ onLogout }: DemoContentProps) {
  const {
    authenticated,
    loading,
    userId,
    walletAddress,
    linkedAccounts,
    logout,
  } = useJejuAuth();

  const { signMessage, hasGas, requestGas, signing } = useJejuWallet();

  const handleSignMessage = async () => {
    const signature = await signMessage('Hello from Babylon!');
    console.log('Signature:', signature);
    alert(`Message signed! Signature: ${signature.slice(0, 20)}...`);
  };

  const handleCheckGas = async () => {
    const hasUserGas = await hasGas();
    alert(hasUserGas ? 'You have gas!' : 'No gas - request some from treasury');
  };

  const handleRequestGas = async () => {
    await requestGas();
    alert('Gas requested from treasury!');
  };

  const handleLogout = async () => {
    await logout();
    onLogout?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="ml-3">Loading...</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="rounded-lg bg-gray-50 p-8 text-center">
        <h2 className="mb-4 font-semibold text-xl">Not Logged In</h2>
        <p className="mb-6 text-gray-600">
          Sign in with wallet, email, or social accounts.
        </p>
        <LoginButton
          variant="default"
          size="lg"
          onSuccess={() => console.log('Login successful!')}
          onError={(err) => console.error('Login error:', err)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
      <div className="border-b pb-4">
        <h2 className="font-semibold text-xl">Authenticated User</h2>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="font-medium text-gray-600 text-sm">DID</label>
          <p className="mt-1 truncate font-mono text-sm">{userId}</p>
        </div>

        <div>
          <label className="font-medium text-gray-600 text-sm">
            Wallet Address
          </label>
          <p className="mt-1 font-mono text-sm">{walletAddress}</p>
        </div>

        <div>
          <label className="font-medium text-gray-600 text-sm">
            Linked Accounts ({linkedAccounts.length})
          </label>
          <ul className="mt-1 space-y-1">
            {linkedAccounts.map((account, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium capitalize">{account.type}:</span>{' '}
                {account.identifier}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t pt-4">
        <button
          onClick={handleSignMessage}
          disabled={signing}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {signing ? 'Signing...' : 'Sign Message'}
        </button>

        <button
          onClick={handleCheckGas}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
        >
          Check Gas
        </button>

        <button
          onClick={handleRequestGas}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
        >
          Request Gas
        </button>

        <button
          onClick={handleLogout}
          className="rounded-lg border border-red-600 px-4 py-2 text-red-600 text-sm hover:bg-red-50"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

/**
 * JejuAuth Demo with Provider
 *
 * This wraps the demo content with the auth provider.
 */
export function JejuAuthDemo() {
  return (
    <JejuAuthProvider
      config={{
        network: 'localnet',
        mpcEndpoints: ['http://localhost:4010'],
        oauth: {
          // These would be real client IDs in production
          twitter: process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID,
          discord: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
        },
        redirectUri:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:8545',
        chainId: 31337,
      }}
    >
      <DemoContent />
    </JejuAuthProvider>
  );
}

/**
 * Minimal Login Button Only
 *
 * For use in headers/navbars where full demo isn't needed.
 */
export function JejuAuthButton() {
  return (
    <JejuAuthProvider
      config={{
        network:
          (process.env.NEXT_PUBLIC_NETWORK as
            | 'mainnet'
            | 'testnet'
            | 'localnet') ?? 'localnet',
      }}
    >
      <LoginButton variant="default" size="md" />
    </JejuAuthProvider>
  );
}
