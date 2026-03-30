import { beforeAll, describe, expect, test } from 'bun:test';
import { isContractDeployed } from '@babylon/contracts';
import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import { OnchainPerpService } from '@babylon/engine';
import {
  configureLocalChainEnvironment,
  ensureContractsReady,
  getLocalRpcUrl,
} from '../helpers/contract-setup';

describe('Localnet deployment bootstrap', () => {
  let service: OnchainPerpService;
  let deployment: NonNullable<
    Awaited<ReturnType<typeof loadDeploymentFromDisk>>
  >;

  beforeAll(async () => {
    configureLocalChainEnvironment();
    expect(await ensureContractsReady()).toBe(true);

    const loadedDeployment = await loadDeploymentFromDisk('localnet');
    expect(loadedDeployment).not.toBeNull();
    if (!loadedDeployment) {
      throw new Error('Localnet deployment metadata is missing');
    }

    deployment = loadedDeployment;
    service = new OnchainPerpService({ rpcUrl: getLocalRpcUrl() });
  });

  test('publishes live contract code at canonical deployment addresses', async () => {
    const contractAddresses = [
      deployment.contracts.diamond,
      deployment.contracts.babylonOracle,
      deployment.contracts.identityRegistry,
      deployment.contracts.reputationSystem,
      deployment.contracts.mockUsdc,
    ];

    for (const address of contractAddresses) {
      expect(await isContractDeployed(getLocalRpcUrl(), address)).toBe(true);
    }
  });

  test('bootstraps the onchain perp engine with collateral config and markets', async () => {
    const engineConfig = await service.getEngineConfig();

    expect(engineConfig.collateralToken.toLowerCase()).toBe(
      deployment.contracts.mockUsdc.toLowerCase()
    );
    expect(engineConfig.collateralDecimals).toBe(6);
    expect(engineConfig.oracleUpdater.toLowerCase()).toBe(
      deployment.deployer.toLowerCase()
    );
    expect(engineConfig.maxOracleDelay).toBeGreaterThan(0);

    const markets = await service.getMarkets();
    expect(markets.length).toBeGreaterThan(0);
    expect(markets.some((market) => market.symbol === 'ETH')).toBe(true);
    expect(markets.some((market) => market.symbol === 'MSFT')).toBe(true);

    for (const market of markets) {
      expect(market.active).toBe(true);
      expect(market.latestVersion).toBeGreaterThan(0n);
      expect(market.vaultBalance).toBeGreaterThan(0n);

      const latestVersion = await service.getLatestOracleVersion(
        market.id,
        market.latestVersion
      );
      expect(latestVersion.version).toBe(market.latestVersion);
      expect(latestVersion.timestamp).toBeGreaterThan(0);
      expect(latestVersion.price).toBeGreaterThan(0n);
    }
  });

  test('derives market snapshots from published oracle state', async () => {
    const snapshots = await service.getMarketSnapshots();

    expect(snapshots.length).toBeGreaterThan(0);

    for (const snapshot of snapshots) {
      expect(snapshot.currentPrice).toBeGreaterThan(0);
      expect(snapshot.indexPrice).toBeGreaterThan(0);
      expect(snapshot.markPrice).toBeGreaterThan(0);
      expect(snapshot.maxLeverage).toBeGreaterThan(0);
      expect(snapshot.minOrderSize).toBeGreaterThan(0);
    }
  });
});
