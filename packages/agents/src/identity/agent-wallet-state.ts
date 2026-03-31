export type AgentWalletStateSnapshot = {
  walletAddress: string | null;
  privyId: string | null;
  privyWalletId: string | null;
  offlineWalletReady: boolean;
};

export type AgentWalletStateClassification =
  | 'ready'
  | 'empty'
  | 'recover_with_existing_privy_user'
  | 'offline_signer_missing'
  | 'recreate_privy_user'
  | 'inconsistent_partial_state';

export type AgentWalletRemediationAction =
  | 'none'
  | 'provision_with_existing_privy_user'
  | 'provision_with_new_privy_user'
  | 'manual_review';

export type AgentWalletStateAssessment = {
  classification: AgentWalletStateClassification;
  remediationAction: AgentWalletRemediationAction;
  reasons: string[];
  hasSyntheticPrivyId: boolean;
  hasSyntheticPrivyWalletId: boolean;
  isReady: boolean;
};

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isSyntheticAgentPrivyId(
  privyId: string | null | undefined
): boolean {
  return hasValue(privyId) && privyId!.startsWith('dev_');
}

export function isSyntheticAgentPrivyWalletId(
  privyWalletId: string | null | undefined
): boolean {
  return hasValue(privyWalletId) && privyWalletId!.startsWith('dev_wallet_');
}

export function isAgentWalletReady(state: AgentWalletStateSnapshot): boolean {
  return Boolean(
    hasValue(state.privyId) &&
      hasValue(state.privyWalletId) &&
      hasValue(state.walletAddress) &&
      state.offlineWalletReady
  );
}

export function canProvisionAgentWalletFromScratch(
  state: AgentWalletStateSnapshot
): boolean {
  return (
    !hasValue(state.privyId) &&
    !hasValue(state.privyWalletId) &&
    !hasValue(state.walletAddress) &&
    !state.offlineWalletReady
  );
}

export function canProvisionAgentWalletFromExistingPrivyUser(
  state: AgentWalletStateSnapshot
): boolean {
  return (
    hasValue(state.privyId) &&
    !isSyntheticAgentPrivyId(state.privyId) &&
    !hasValue(state.privyWalletId) &&
    !hasValue(state.walletAddress) &&
    !state.offlineWalletReady
  );
}

export function assessAgentWalletState(
  state: AgentWalletStateSnapshot
): AgentWalletStateAssessment {
  const hasPrivyId = hasValue(state.privyId);
  const hasPrivyWalletId = hasValue(state.privyWalletId);
  const hasWalletAddress = hasValue(state.walletAddress);
  const hasSyntheticPrivyId = isSyntheticAgentPrivyId(state.privyId);
  const hasSyntheticPrivyWalletId = isSyntheticAgentPrivyWalletId(
    state.privyWalletId
  );

  if (isAgentWalletReady(state)) {
    return {
      classification: 'ready',
      remediationAction: 'none',
      reasons: ['agent wallet is fully provisioned and offline-ready'],
      hasSyntheticPrivyId,
      hasSyntheticPrivyWalletId,
      isReady: true,
    };
  }

  if (canProvisionAgentWalletFromScratch(state)) {
    return {
      classification: 'empty',
      remediationAction: 'provision_with_new_privy_user',
      reasons: ['agent has no persisted Privy wallet state'],
      hasSyntheticPrivyId,
      hasSyntheticPrivyWalletId,
      isReady: false,
    };
  }

  if (canProvisionAgentWalletFromExistingPrivyUser(state)) {
    return {
      classification: 'recover_with_existing_privy_user',
      remediationAction: 'provision_with_existing_privy_user',
      reasons: ['agent has a reusable Privy user id but no wallet-ready state'],
      hasSyntheticPrivyId,
      hasSyntheticPrivyWalletId,
      isReady: false,
    };
  }

  if (hasSyntheticPrivyId || hasSyntheticPrivyWalletId) {
    const reasons = ['agent uses synthetic legacy Privy identifiers'];
    if (hasWalletAddress) {
      reasons.push(
        'stored wallet address is not trusted as a real custody source'
      );
    }

    return {
      classification: 'recreate_privy_user',
      remediationAction: 'provision_with_new_privy_user',
      reasons,
      hasSyntheticPrivyId,
      hasSyntheticPrivyWalletId,
      isReady: false,
    };
  }

  if (!hasPrivyId && !hasPrivyWalletId && hasWalletAddress) {
    return {
      classification: 'recreate_privy_user',
      remediationAction: 'provision_with_new_privy_user',
      reasons: [
        'agent has only a wallet address with no trustworthy Privy ownership metadata',
      ],
      hasSyntheticPrivyId,
      hasSyntheticPrivyWalletId,
      isReady: false,
    };
  }

  if (
    hasPrivyId &&
    !isSyntheticAgentPrivyId(state.privyId) &&
    (hasPrivyWalletId || hasWalletAddress) &&
    !state.offlineWalletReady
  ) {
    return {
      classification: 'offline_signer_missing',
      remediationAction: 'provision_with_existing_privy_user',
      reasons: [
        'agent has real Privy identity and partial wallet state but offline signer is not configured',
      ],
      hasSyntheticPrivyId,
      hasSyntheticPrivyWalletId,
      isReady: false,
    };
  }

  if (hasPrivyId && !isSyntheticAgentPrivyId(state.privyId)) {
    return {
      classification: 'recover_with_existing_privy_user',
      remediationAction: 'provision_with_existing_privy_user',
      reasons: [
        'agent has a real Privy user id but the persisted wallet state is incomplete',
      ],
      hasSyntheticPrivyId,
      hasSyntheticPrivyWalletId,
      isReady: false,
    };
  }

  return {
    classification: 'inconsistent_partial_state',
    remediationAction: 'manual_review',
    reasons: [
      'agent wallet state is inconsistent and cannot be repaired safely',
    ],
    hasSyntheticPrivyId,
    hasSyntheticPrivyWalletId,
    isReady: false,
  };
}
