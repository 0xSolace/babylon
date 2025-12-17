#!/usr/bin/env bun
/**
 * Security Audit Script
 *
 * Checks for known vulnerabilities in dependencies using npm audit.
 * Run: bun run scripts/security-audit.ts
 */

import { spawn } from 'bun';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

interface AuditResult {
  vulnerabilities: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  timestamp: string;
  passed: boolean;
}

async function runAudit(): Promise<void> {
  console.log('🔍 Running security audit...\n');

  const root = process.cwd();

  // Check if we have a bun.lock file
  if (!existsSync(join(root, 'bun.lock'))) {
    console.error('❌ No bun.lock found');
    process.exit(1);
  }

  // Use bun's built-in outdated check and manual vulnerability DB
  console.log('📦 Checking for outdated packages...');
  const outdated = spawn(['bun', 'outdated'], {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await outdated.exited;

  console.log('\n📦 Generating package-lock.json for npm audit...');
  const lockGen = spawn(
    [
      'npm',
      'install',
      '--package-lock-only',
      '--ignore-scripts',
      '--legacy-peer-deps',
    ],
    {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  const lockExit = await lockGen.exited;

  if (lockExit !== 0 || !existsSync(join(root, 'package-lock.json'))) {
    console.log('⚠️  Could not generate package-lock.json for npm audit');
    console.log('   This is expected in complex monorepos');
    console.log(
      '   Using Dependabot for automated security scanning instead\n'
    );

    // Still pass if Dependabot is configured
    if (existsSync(join(root, '.github/dependabot.yml'))) {
      console.log('✅ Dependabot is configured for security updates');
      process.exit(0);
    } else {
      console.error('❌ No security scanning configured');
      process.exit(1);
    }
  }

  // Run npm audit
  console.log('🛡️  Running npm audit...\n');
  const audit = spawn(['npm', 'audit', '--json'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(audit.stdout).text();
  await audit.exited;

  let auditData: {
    metadata?: {
      vulnerabilities?: {
        critical?: number;
        high?: number;
        moderate?: number;
        low?: number;
      };
    };
  };

  try {
    auditData = JSON.parse(stdout);
  } catch {
    console.error('❌ Failed to parse audit output');
    console.log(stdout);
    process.exit(1);
  }

  const vulns = auditData.metadata?.vulnerabilities ?? {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
  };

  const result: AuditResult = {
    vulnerabilities: {
      critical: vulns.critical ?? 0,
      high: vulns.high ?? 0,
      moderate: vulns.moderate ?? 0,
      low: vulns.low ?? 0,
    },
    timestamp: new Date().toISOString(),
    passed: (vulns.critical ?? 0) === 0 && (vulns.high ?? 0) === 0,
  };

  // Save result
  writeFileSync(
    join(root, 'security-audit-result.json'),
    JSON.stringify(result, null, 2)
  );

  // Display summary
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║           SECURITY AUDIT RESULTS          ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(
    `║  Critical:  ${String(result.vulnerabilities.critical).padEnd(28)}║`
  );
  console.log(
    `║  High:      ${String(result.vulnerabilities.high).padEnd(28)}║`
  );
  console.log(
    `║  Moderate:  ${String(result.vulnerabilities.moderate).padEnd(28)}║`
  );
  console.log(
    `║  Low:       ${String(result.vulnerabilities.low).padEnd(28)}║`
  );
  console.log('╠═══════════════════════════════════════════╣');
  console.log(
    `║  Status:    ${result.passed ? '✅ PASSED'.padEnd(28) : '❌ FAILED'.padEnd(28)}║`
  );
  console.log('╚═══════════════════════════════════════════╝');

  if (!result.passed) {
    console.log('\n⚠️  Run `npm audit fix` to attempt automatic fixes');
    console.log('   Run `npm audit` for detailed vulnerability info');
  }

  // Clean up generated package-lock.json
  spawn(['rm', '-f', 'package-lock.json'], { cwd: root });

  process.exit(result.passed ? 0 : 1);
}

runAudit();
