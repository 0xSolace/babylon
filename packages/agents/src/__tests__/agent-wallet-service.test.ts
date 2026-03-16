import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockProvisionAgentPrivyWallet = mock();
const mockSignPrivyEvmTransaction = mock();

let selectedRows: unknown[] = [];
let lastUpdateData: Record<string, unknown> | null = null;
let lastInsertedLog: Record<string, unknown> | null = null;

const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(async () => selectedRows),
      })),
    })),
  })),
  update: mock(() => ({
    set: mock((data: Record<string, unknown>) => {
      lastUpdateData = data;
      return {
        where: mock(async () => []),
      };
    }),
  })),
  insert: mock(() => ({
    values: mock(async (data: Record<string, unknown>) => {
      lastInsertedLog = data;
      return [];
    }),
  })),
};

mock.module('@babylon/api', () => ({
  provisionAgentPrivyWallet: mockProvisionAgentPrivyWallet,
  signPrivyEvmTransaction: mockSignPrivyEvmTransaction,
}));

mock.module('@babylon/db', () => ({
  agentLogs: { id: 'id' },
  db: mockDb,
  eq: (field: unknown, value: unknown) => ({ field, value }),
  users: {
    id: 'id',
    isAgent: 'isAgent',
    walletAddress: 'walletAddress',
    privyId: 'privyId',
    privyWalletId: 'privyWalletId',
    offlineWalletReady: 'offlineWalletReady',
  },
}));

mock.module('../agent0/sdk-instance', () => ({
  getAgent0SDK: () => ({
    createAgent: () => {
      throw new Error('not expected in these tests');
    },
    getAgent: async () => null,
  }),
}));

mock.module('../shared/agent-config', () => ({
  getAgentConfig: async () => null,
  isAutonomousTradingEnabled: () => false,
}));

mock.module('../shared/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

mock.module('uuid', () => ({
  v4: () => 'test-uuid',
}));

const { AgentWalletService } = await import('../identity/AgentWalletService');

describe('AgentWalletService', () => {
  let service: InstanceType<typeof AgentWalletService>;

  beforeEach(() => {
    service = new AgentWalletService();
    selectedRows = [];
    lastUpdateData = null;
    lastInsertedLog = null;
    mockProvisionAgentPrivyWallet.mockReset();
    mockSignPrivyEvmTransaction.mockReset();
    mockDb.select.mockClear();
    mockDb.update.mockClear();
    mockDb.insert.mockClear();
  });

  it('returns the persisted wallet when the agent is already ready', async () => {
    selectedRows = [
      {
        id: 'agent-1',
        isAgent: true,
        walletAddress: '0x0000000000000000000000000000000000000001',
        privyId: 'did:privy:agent-1',
        privyWalletId: 'wallet-1',
        offlineWalletReady: true,
      },
    ];

    const result = await service.createAgentEmbeddedWallet('agent-1');

    expect(result).toEqual({
      walletAddress: '0x0000000000000000000000000000000000000001',
      privyUserId: 'did:privy:agent-1',
      privyWalletId: 'wallet-1',
    });
    expect(mockProvisionAgentPrivyWallet).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('provisions and persists a new offline-ready wallet from scratch', async () => {
    selectedRows = [
      {
        id: 'agent-2',
        isAgent: true,
        walletAddress: null,
        privyId: null,
        privyWalletId: null,
        offlineWalletReady: false,
      },
    ];
    mockProvisionAgentPrivyWallet.mockResolvedValue({
      privyId: 'did:privy:agent-2',
      privyWalletId: 'wallet-2',
      walletAddress: '0x0000000000000000000000000000000000000002',
      offlineWalletReady: true,
      createdPrivyUser: true,
      createdWallet: false,
      updatedSigner: false,
    });

    const result = await service.createAgentEmbeddedWallet('agent-2');

    expect(mockProvisionAgentPrivyWallet).toHaveBeenCalledWith({
      agentUserId: 'agent-2',
      existingPrivyId: null,
    });
    expect(lastUpdateData).toMatchObject({
      walletAddress: '0x0000000000000000000000000000000000000002',
      privyId: 'did:privy:agent-2',
      privyWalletId: 'wallet-2',
      offlineWalletReady: true,
      offlineWalletReadyAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(lastInsertedLog).toMatchObject({
      agentUserId: 'agent-2',
      type: 'system',
      level: 'info',
      message:
        'Agent wallet provisioned: 0x0000000000000000000000000000000000000002',
    });
    expect(result).toEqual({
      walletAddress: '0x0000000000000000000000000000000000000002',
      privyUserId: 'did:privy:agent-2',
      privyWalletId: 'wallet-2',
    });
  });

  it('reuses an existing Privy user when only wallet readiness is missing', async () => {
    selectedRows = [
      {
        id: 'agent-3',
        isAgent: true,
        walletAddress: null,
        privyId: 'did:privy:agent-3',
        privyWalletId: null,
        offlineWalletReady: false,
      },
    ];
    mockProvisionAgentPrivyWallet.mockResolvedValue({
      privyId: 'did:privy:agent-3',
      privyWalletId: 'wallet-3',
      walletAddress: '0x0000000000000000000000000000000000000003',
      offlineWalletReady: true,
      createdPrivyUser: false,
      createdWallet: true,
      updatedSigner: false,
    });

    await service.createAgentEmbeddedWallet('agent-3');

    expect(mockProvisionAgentPrivyWallet).toHaveBeenCalledWith({
      agentUserId: 'agent-3',
      existingPrivyId: 'did:privy:agent-3',
    });
  });

  it('rejects inconsistent partial wallet state instead of masking it', async () => {
    selectedRows = [
      {
        id: 'agent-4',
        isAgent: true,
        walletAddress: '0x0000000000000000000000000000000000000004',
        privyId: null,
        privyWalletId: null,
        offlineWalletReady: false,
      },
    ];

    await expect(service.createAgentEmbeddedWallet('agent-4')).rejects.toThrow(
      'Agent wallet state is inconsistent; manual remediation required'
    );

    expect(mockProvisionAgentPrivyWallet).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('signs transactions with the persisted Privy wallet id', async () => {
    selectedRows = [
      {
        id: 'agent-5',
        isAgent: true,
        privyId: 'did:privy:agent-5',
        privyWalletId: 'wallet-5',
        walletAddress: '0x0000000000000000000000000000000000000005',
        offlineWalletReady: true,
      },
    ];
    mockSignPrivyEvmTransaction.mockResolvedValue('0xsigned');

    const result = await service.signTransaction('agent-5', {
      to: '0x0000000000000000000000000000000000000005',
      value: '42',
      data: '0xdeadbeef',
    });

    expect(result).toBe('0xsigned');
    expect(mockSignPrivyEvmTransaction).toHaveBeenCalledWith({
      walletId: 'wallet-5',
      to: '0x0000000000000000000000000000000000000005',
      data: '0xdeadbeef',
      valueWei: 42n,
    });
  });

  it('blocks signing when the wallet is not offline-ready', async () => {
    selectedRows = [
      {
        id: 'agent-6',
        isAgent: true,
        privyWalletId: null,
        offlineWalletReady: false,
      },
    ];

    await expect(
      service.signTransaction('agent-6', {
        to: '0x0000000000000000000000000000000000000006',
        value: '0',
        data: '0x',
      })
    ).rejects.toThrow('Agent wallet is not offline-ready');

    expect(mockSignPrivyEvmTransaction).not.toHaveBeenCalled();
  });

  it('blocks signing when the persisted wallet state is partial', async () => {
    selectedRows = [
      {
        id: 'agent-7',
        isAgent: true,
        privyId: null,
        privyWalletId: 'wallet-7',
        walletAddress: null,
        offlineWalletReady: true,
      },
    ];

    await expect(
      service.signTransaction('agent-7', {
        to: '0x0000000000000000000000000000000000000007',
        value: '0',
        data: '0x',
      })
    ).rejects.toThrow('Agent wallet is not offline-ready');

    expect(mockSignPrivyEvmTransaction).not.toHaveBeenCalled();
  });
});
