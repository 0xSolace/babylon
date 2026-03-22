export type WalletTab = 'balance' | 'positions';

export const DEFAULT_WALLET_TAB: WalletTab = 'positions';

export function parseWalletTab(tab: string | null | undefined): WalletTab {
  return tab === 'balance' || tab === 'positions' ? tab : DEFAULT_WALLET_TAB;
}

export function getWalletTabHref(tab: WalletTab): string {
  return `/wallet?tab=${tab}`;
}
