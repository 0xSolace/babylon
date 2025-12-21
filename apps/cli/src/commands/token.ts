/**
 * Token CLI Commands
 *
 * Commands for BBLN token management:
 * - NPC funding from treasury
 * - Airdrop snapshot and bonus calculation
 * - Risk monitoring
 *
 * @packageDocumentation
 */

import { getNPCIdentityService } from '@babylon/agents/identity/NPCIdentityService';
import { initializeNPCTokenWalletService } from '@babylon/agents/identity/NPCTokenWalletService';
import { getAirdropBonusService } from '@babylon/api';
import {
  getNPCRiskManagementService,
  StaticDataRegistry,
} from '@babylon/engine';
import { Command } from 'commander';
import type { Hex } from 'viem';
import { formatUnits } from 'viem';

export const tokenCommand = new Command('token').description(
  'BBLN token management commands'
);

// =============================================================================
// NPC FUNDING
// =============================================================================

tokenCommand
  .command('fund-npcs')
  .description('Fund all NPCs from treasury with initial BBLN allocations')
  .requiredOption('-k, --key <privateKey>', 'Treasury private key (hex)')
  .option('--dry-run', 'Preview funding without executing', false)
  .action(async (options: { key: string; dryRun: boolean }) => {
    console.log('🏦 NPC Funding from Treasury\n');

    if (options.dryRun) {
      console.log('DRY RUN MODE - No transactions will be executed\n');
    }

    // Initialize services
    const walletService = await initializeNPCTokenWalletService();
    const identityService = getNPCIdentityService();
    const actors = StaticDataRegistry.getAllActors();

    console.log(`Found ${actors.length} NPCs to fund\n`);

    const results = {
      funded: 0,
      skipped: 0,
      failed: 0,
      totalAmount: 0n,
    };

    for (const actor of actors) {
      try {
        const identity = await identityService.getNPCIdentity(actor.id);
        if (!identity?.walletAddress) {
          console.log(`⚠️  ${actor.name}: No wallet - initializing...`);
          await identityService.initializeNPCIdentity(actor.id);
        }

        if (options.dryRun) {
          const balance = await walletService.getBalance(actor.id);
          console.log(
            `📊 ${actor.name}: Current balance ${formatUnits(balance.totalValue, 18)} BBLN`
          );
          continue;
        }

        const { txHash, amount } = await walletService.fundNPCFromTreasury(
          actor.id,
          options.key as Hex
        );

        if (amount > 0n) {
          console.log(
            `✅ ${actor.name}: Funded ${formatUnits(amount, 18)} BBLN (tx: ${txHash})`
          );
          results.funded++;
          results.totalAmount += amount;
        } else {
          console.log(`⏭️  ${actor.name}: Already funded`);
          results.skipped++;
        }
      } catch (error) {
        console.log(
          `❌ ${actor.name}: ${error instanceof Error ? error.message : String(error)}`
        );
        results.failed++;
      }
    }

    console.log('\n📊 Summary');
    console.log('─'.repeat(40));
    console.log(`Funded: ${results.funded}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total Amount: ${formatUnits(results.totalAmount, 18)} BBLN`);
  });

tokenCommand
  .command('npc-balances')
  .description('Show current BBLN balances for all NPCs')
  .action(async () => {
    console.log('📊 NPC Token Balances\n');

    const walletService = await initializeNPCTokenWalletService();
    const actors = StaticDataRegistry.getAllActors();

    let totalBalance = 0n;
    const balances: Array<{ name: string; tier: string; balance: bigint }> = [];

    for (const actor of actors) {
      const balance = await walletService.getBalance(actor.id);
      balances.push({
        name: actor.name,
        tier: actor.tier ?? 'C_TIER',
        balance: balance.totalValue,
      });
      totalBalance += balance.totalValue;
    }

    // Sort by balance descending
    balances.sort((a, b) => (b.balance > a.balance ? 1 : -1));

    console.log('Name                         Tier      Balance');
    console.log('─'.repeat(54));

    for (const { name, tier, balance } of balances) {
      const balanceStr = formatUnits(balance, 18);
      console.log(`${name.padEnd(28)} ${tier.padEnd(8)} ${balanceStr} BBLN`);
    }

    console.log('─'.repeat(50));
    console.log(`Total: ${formatUnits(totalBalance, 18)} BBLN`);
  });

// =============================================================================
// AIRDROP MANAGEMENT
// =============================================================================

tokenCommand
  .command('airdrop-snapshot')
  .description('Take snapshot of user points for airdrop allocation')
  .action(async () => {
    console.log('📸 Taking Airdrop Points Snapshot\n');

    const bonusService = getAirdropBonusService();
    const result = await bonusService.takePointsSnapshot();

    console.log(`✅ Snapshot complete`);
    console.log(`   Users processed: ${result.usersProcessed}`);
    console.log(`   Total points: ${result.totalPoints.toLocaleString()}`);
  });

tokenCommand
  .command('airdrop-init')
  .description('Initialize the 90-day bonus period')
  .option(
    '--launch-date <date>',
    'Launch date (ISO format)',
    new Date().toISOString()
  )
  .action(async (options: { launchDate: string }) => {
    console.log('🚀 Initializing Airdrop Bonus Period\n');

    const bonusService = getAirdropBonusService();
    const launchDate = new Date(options.launchDate);
    const config = await bonusService.initializeBonusPeriod(launchDate);

    console.log(`✅ Bonus period initialized`);
    console.log(`   Launch date: ${config.launchDate.toISOString()}`);
    console.log(`   Bonus period ends: ${config.bonusPeriodEnd.toISOString()}`);
    console.log(`   Active: ${config.isActive}`);
    console.log(`   Days remaining: ${config.daysRemaining}`);
  });

tokenCommand
  .command('airdrop-leaderboard')
  .description('Show current airdrop bonus leaderboard')
  .option('-l, --limit <number>', 'Number of entries to show', '20')
  .action(async (options: { limit: string }) => {
    console.log('🏆 Airdrop Bonus Leaderboard\n');

    const bonusService = getAirdropBonusService();
    const leaderboard = await bonusService.getLeaderboard(
      parseInt(options.limit)
    );

    console.log(
      'Rank  Username                     Points Earned    Est. Bonus'
    );
    console.log('─'.repeat(70));

    for (const entry of leaderboard) {
      const bonusNum = Number(entry.estimatedBonus) / 1e18;
      console.log(
        `${entry.rank.toString().padStart(4)}  ` +
          `${entry.username.padEnd(28)} ` +
          `${entry.pointsEarned.toString().padStart(12)} ` +
          `${bonusNum.toFixed(2).padStart(12)} BBLN`
      );
    }
  });

tokenCommand
  .command('airdrop-calculate-bonuses')
  .description('Calculate final bonus allocations (run at end of bonus period)')
  .option('--dry-run', 'Preview calculations without saving', false)
  .action(async (options: { dryRun: boolean }) => {
    console.log('🧮 Calculating Final Airdrop Bonuses\n');

    if (options.dryRun) {
      console.log('DRY RUN MODE - No changes will be saved\n');
    }

    const bonusService = getAirdropBonusService();
    const result = await bonusService.calculateFinalBonuses();

    console.log(`✅ Bonus calculation complete`);
    console.log(`   Users processed: ${result.processed}`);
    console.log(
      `   Total bonus allocated: ${formatUnits(result.totalBonusAllocated, 18)} BBLN`
    );

    if (result.results.length > 0) {
      console.log('\nTop 10 Bonus Recipients:');
      console.log('─'.repeat(50));

      const top10 = result.results
        .sort((a, b) => (b.totalBonus > a.totalBonus ? 1 : -1))
        .slice(0, 10);

      for (const entry of top10) {
        const totalBonusNum = Number(entry.totalBonus) / 1e18;
        console.log(`${entry.userId}: ${totalBonusNum.toFixed(2)} BBLN`);
      }
    }
  });

// =============================================================================
// RISK MANAGEMENT
// =============================================================================

tokenCommand
  .command('npc-risk')
  .description('Check risk status for all NPCs')
  .action(async () => {
    console.log('⚠️  NPC Risk Assessment\n');

    const riskService = getNPCRiskManagementService();
    const statuses = await riskService.getAllNPCRiskStatus();

    console.log('Name                    Risk Score   Status          Alerts');
    console.log('─'.repeat(70));

    for (const status of statuses) {
      const actor = StaticDataRegistry.getActor(status.actorId);
      const name = actor?.name ?? status.actorId;
      const scoreBar =
        '█'.repeat(Math.floor(status.riskScore / 10)) +
        '░'.repeat(10 - Math.floor(status.riskScore / 10));

      let statusIcon = '✅';
      if (status.shouldStopTrading) {
        statusIcon = '🛑';
      } else if (status.isAtRisk) {
        statusIcon = '⚠️';
      }

      console.log(
        `${name.slice(0, 22).padEnd(22)} ` +
          `${scoreBar} ${status.riskScore.toString().padStart(3)}   ` +
          `${statusIcon}    ` +
          `${status.alerts.length} alerts`
      );
    }

    const atRisk = statuses.filter((s) => s.isAtRisk).length;
    const critical = statuses.filter((s) => s.shouldStopTrading).length;

    console.log('─'.repeat(70));
    console.log(
      `Total: ${statuses.length} NPCs | At Risk: ${atRisk} | Critical: ${critical}`
    );
  });

tokenCommand
  .command('start-risk-monitor')
  .description('Start automatic NPC risk monitoring')
  .action(async () => {
    console.log('🔍 Starting NPC Risk Monitor\n');

    const riskService = getNPCRiskManagementService();
    riskService.start();

    console.log('Risk monitoring active. Press Ctrl+C to stop.');

    // Keep process running
    await new Promise(() => {});
  });

// =============================================================================
// ELIZA HOLDER SNAPSHOT
// =============================================================================

tokenCommand
  .command('eliza-snapshot')
  .description('Snapshot ELIZA token holders and create BBLN allocations')
  .option('--wallets <file>', 'JSON file with wallet addresses', '')
  .option('--single <address>', 'Snapshot a single EVM address')
  .option('--solana <address>', 'Solana address (paired with --single)')
  .option('--dry-run', 'Preview without creating allocations', false)
  .action(
    async (options: {
      wallets: string;
      single: string;
      solana: string;
      dryRun: boolean;
    }) => {
      const { ElizaHolderAirdropService } = await import('@babylon/api');
      const service = new ElizaHolderAirdropService();

      console.log('📸 ELIZA Holder Snapshot\n');

      // Get total ELIZA supply for allocation calculation
      console.log('Fetching ELIZA total supply across chains...');
      const totalSupply = await service.getTotalElizaSupply();
      console.log(
        `Total ELIZA supply: ${formatUnits(totalSupply, 18)} ELIZA\n`
      );

      if (options.single) {
        // Snapshot single wallet
        const evmAddress = options.single as `0x${string}`;
        console.log(`Checking balance for ${evmAddress}...`);

        const { totalBalance, byChain } = await service.getFullElizaBalance(
          evmAddress,
          options.solana || undefined
        );

        console.log('\nBalances by chain:');
        for (const [chain, balance] of Object.entries(byChain)) {
          console.log(`  ${chain}: ${formatUnits(balance, 18)} ELIZA`);
        }
        console.log(`  TOTAL: ${formatUnits(totalBalance, 18)} ELIZA`);

        if (totalBalance === 0n) {
          console.log('\n⚠️  No ELIZA balance found');
          return;
        }

        const bblnAllocation = service.calculateAllocation(
          totalBalance,
          totalSupply
        );
        console.log(
          `\nBBLN Allocation: ${formatUnits(bblnAllocation, 18)} BBLN`
        );

        if (!options.dryRun) {
          console.log('\nCreating allocation record...');
          const result = await service.snapshotWallet(
            evmAddress,
            options.solana || undefined,
            totalSupply,
            new Date()
          );
          console.log(
            result.isNew ? '✅ New allocation created' : '✅ Allocation updated'
          );
        } else {
          console.log('\n[DRY RUN] Would create allocation record');
        }
        return;
      }

      if (options.wallets) {
        // Batch snapshot from file
        const fs = await import('fs');
        const walletData = JSON.parse(
          fs.readFileSync(options.wallets, 'utf-8')
        ) as Array<{ evmAddress: string; solanaAddress?: string }>;

        console.log(`Processing ${walletData.length} wallets...\n`);

        if (options.dryRun) {
          console.log('[DRY RUN] Would process the following wallets:');
          for (const w of walletData.slice(0, 10)) {
            console.log(
              `  - ${w.evmAddress}${w.solanaAddress ? ` (Solana: ${w.solanaAddress})` : ''}`
            );
          }
          if (walletData.length > 10) {
            console.log(`  ... and ${walletData.length - 10} more`);
          }
          return;
        }

        const result = await service.runFullSnapshot(
          walletData.map((w) => ({
            evmAddress: w.evmAddress as `0x${string}`,
            solanaAddress: w.solanaAddress,
          })),
          totalSupply
        );

        console.log('\n📊 Snapshot Results:');
        console.log(`  Processed: ${result.processed}`);
        console.log(`  New allocations: ${result.newAllocations}`);
        console.log(`  Updated allocations: ${result.updatedAllocations}`);
        console.log(
          `  Total BBLN allocated: ${formatUnits(result.totalBblnAllocated, 18)}`
        );
        console.log(`  Snapshot time: ${result.snapshotTime.toISOString()}`);
        return;
      }

      // Show current stats if no options provided
      console.log('Current snapshot statistics:\n');
      const stats = await service.getSnapshotStats();
      console.log(`  Total holders: ${stats.totalHolders}`);
      console.log(
        `  Total ELIZA snapshotted: ${formatUnits(stats.totalElizaSnapshotted, 18)}`
      );
      console.log(
        `  Total BBLN allocated: ${formatUnits(stats.totalBblnAllocated, 18)}`
      );
      console.log(`  Claims started: ${stats.claimsStarted}`);
      console.log(`  Fully claimed: ${stats.fullyClaimed}`);
      console.log(`  Expired: ${stats.expired}`);

      console.log('\nUsage:');
      console.log('  --single <address>     Snapshot a single wallet');
      console.log('  --wallets <file>       Batch snapshot from JSON file');
      console.log(
        '  --solana <address>     Include Solana balance (with --single)'
      );
      console.log('  --dry-run              Preview without creating records');
    }
  );

tokenCommand
  .command('eliza-allocations')
  .description('List all ELIZA holder BBLN allocations')
  .option('--limit <n>', 'Max records to show', '20')
  .action(async (options: { limit: string }) => {
    const { ElizaHolderAirdropService } = await import('@babylon/api');
    const service = new ElizaHolderAirdropService();

    console.log('📋 ELIZA Holder Allocations\n');

    const allocations = await service.getAllAllocations();
    const limit = parseInt(options.limit, 10);

    console.log(
      'Wallet'.padEnd(44) +
        'ELIZA Balance'.padStart(18) +
        'BBLN Allocation'.padStart(18) +
        'Drips'.padStart(8)
    );
    console.log('─'.repeat(88));

    for (const alloc of allocations.slice(0, limit)) {
      const elizaFmt = formatUnits(BigInt(alloc.elizaBalance), 18);
      const bblnFmt = formatUnits(BigInt(alloc.bblnAllocation), 18);
      console.log(
        alloc.walletAddress.padEnd(44) +
          elizaFmt.padStart(18) +
          bblnFmt.padStart(18) +
          `${alloc.dripsUnlocked}/46`.padStart(8)
      );
    }

    if (allocations.length > limit) {
      console.log(`\n... and ${allocations.length - limit} more`);
    }

    console.log(`\nTotal: ${allocations.length} allocations`);
  });

export default tokenCommand;
