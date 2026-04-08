import { PrivyClient } from '@privy-io/node';

let privyNodeClient: PrivyClient | null = null;

export function getPrivyNodeClient(): PrivyClient {
  if (privyNodeClient) return privyNodeClient;

  const appId =
    process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
  const appSecret = process.env.PRIVY_APP_SECRET ?? '';

  privyNodeClient = new PrivyClient({ appId, appSecret });
  return privyNodeClient;
}
