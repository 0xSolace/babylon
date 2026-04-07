'use server';

import {
  getAuthedUserContextFromPrivyTokenBundle,
  sendSponsoredEvmTransaction,
} from '@babylon/api';
import {
  CAPABILITIES_HASH,
  CHAIN,
  getIdentityRegistryAddress,
  identityRegistryAbi,
  WALLET_ERROR_MESSAGES,
} from '@babylon/shared';
import { type Address, encodeFunctionData, type Hex, isAddress } from 'viem';
import type { AgentProfileMetadata } from '@/hooks/useUpdateAgentProfileTx';
import { wrapServerActionWithSentry } from '@/lib/sentry/server-actions';

import { requirePrivyTokenBundle } from './utils';

async function sendSponsoredEthTransferActionImpl(input: {
  to: string;
  amountWei: string;
  userJwt?: string;
}): Promise<{ txHash: Hex }> {
  const bundle = await requirePrivyTokenBundle(input.userJwt);
  const ctx = await getAuthedUserContextFromPrivyTokenBundle(bundle);

  if (!isAddress(input.to)) {
    throw new Error('Invalid recipient address');
  }
  const valueWei = BigInt(input.amountWei);

  const { hash } = await sendSponsoredEvmTransaction({
    walletId: ctx.privyWalletId,
    to: input.to.toLowerCase() as Address,
    valueWei,
    caip2: `eip155:${CHAIN.id}`,
    chainId: CHAIN.id,
  });

  return { txHash: hash };
}

export const sendSponsoredEthTransferAction = wrapServerActionWithSentry(
  'sendSponsoredEthTransferAction',
  sendSponsoredEthTransferActionImpl
);

async function updateAgentProfileOnchainActionImpl(input: {
  metadata: AgentProfileMetadata;
  endpoint?: string;
  userJwt?: string;
}): Promise<{ txHash: Hex }> {
  const bundle = await requirePrivyTokenBundle(input.userJwt);
  const ctx = await getAuthedUserContextFromPrivyTokenBundle(bundle);

  const registryAddress = getIdentityRegistryAddress();
  if (!registryAddress) {
    throw new Error('Identity registry not configured for this chain');
  }
  if (!ctx.walletAddress) {
    throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
  }

  const endpoint =
    input.endpoint ??
    `https://babylon.market/agent/${ctx.walletAddress.toLowerCase()}`;
  const metadataJson = JSON.stringify({
    ...input.metadata,
    type: input.metadata.type ?? 'user',
    updated: input.metadata.updated ?? new Date().toISOString(),
  });

  const data = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: 'updateAgent',
    args: [endpoint, CAPABILITIES_HASH, metadataJson],
  });

  const { hash } = await sendSponsoredEvmTransaction({
    walletId: ctx.privyWalletId,
    to: registryAddress,
    data,
    valueWei: 0n,
    caip2: `eip155:${CHAIN.id}`,
    chainId: CHAIN.id,
  });

  return { txHash: hash };
}

export const updateAgentProfileOnchainAction = wrapServerActionWithSentry(
  'updateAgentProfileOnchainAction',
  updateAgentProfileOnchainActionImpl
);
