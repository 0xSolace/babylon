import { beforeEach, describe, expect, mock, test } from 'bun:test';

const actualReact = await import('react');
const reactMock = {
  ...actualReact,
  useCallback: (fn: Function) => fn,
};

mock.module('react', () => ({
  ...reactMock,
  default: actualReact.default ?? reactMock,
}));

const authState = {
  embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
  embeddedWalletReady: true,
  getAccessToken: mock(async () => 'fresh-jwt'),
};

const sendSponsoredEthTransferAction = mock(async () => ({
  txHash: '0xabc123',
}));

mock.module('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

mock.module('@/app/_actions/onchain', () => ({
  sendSponsoredEthTransferAction,
}));

const { WALLET_ERROR_MESSAGES } = await import('@babylon/shared');
const { useBuyPointsTx } = await import('./useBuyPointsTx');

beforeEach(() => {
  authState.embeddedWalletAddress = '0x1111111111111111111111111111111111111111';
  authState.embeddedWalletReady = true;
  authState.getAccessToken.mockReset();
  authState.getAccessToken.mockImplementation(async () => 'fresh-jwt');
  sendSponsoredEthTransferAction.mockReset();
  sendSponsoredEthTransferAction.mockImplementation(async () => ({
    txHash: '0xabc123',
  }));
});

describe('useBuyPointsTx', () => {
  test('throws when the embedded wallet is not ready', async () => {
    authState.embeddedWalletReady = false;

    const { sendPointsPayment } = useBuyPointsTx();

    await expect(
      sendPointsPayment({
        to: '0x2222222222222222222222222222222222222222',
        amountWei: 123n,
      })
    ).rejects.toThrow(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);

    expect(authState.getAccessToken).not.toHaveBeenCalled();
    expect(sendSponsoredEthTransferAction).not.toHaveBeenCalled();
  });

  test('throws when authentication is unavailable', async () => {
    authState.getAccessToken.mockImplementation(async () => null);

    const { sendPointsPayment } = useBuyPointsTx();

    await expect(
      sendPointsPayment({
        to: '0x2222222222222222222222222222222222222222',
        amountWei: 123n,
      })
    ).rejects.toThrow('Authentication required');

    expect(sendSponsoredEthTransferAction).not.toHaveBeenCalled();
  });

  test('uses the server-side sponsored transfer action for point payments', async () => {
    const { sendPointsPayment } = useBuyPointsTx();

    await expect(
      sendPointsPayment({
        to: '0x2222222222222222222222222222222222222222',
        amountWei: 123n,
      })
    ).resolves.toBe('0xabc123');

    expect(authState.getAccessToken).toHaveBeenCalledTimes(1);
    expect(sendSponsoredEthTransferAction).toHaveBeenCalledWith({
      to: '0x2222222222222222222222222222222222222222',
      amountWei: '123',
      userJwt: 'fresh-jwt',
    });
  });
});
