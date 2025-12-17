/**
 * IPFS/IPNS/JNS Frontend Deployer
 */

import { logger } from '@babylon/shared';
import {
  getJejuStorageClient,
  type JejuStorageClient,
} from '../storage/jeju-storage';

export interface IPFSDeploymentConfig {
  jnsDomain: string;
  ipnsKeyName: string;
  buildDir: string;
  metadata?: { version?: string; commitHash?: string; deployedAt?: Date };
}

export interface DeploymentResult {
  cid: string;
  ipnsKey: string;
  ipnsName: string;
  gatewayUrl: string;
  jnsUrl: string;
  fileCount: number;
  totalSize: number;
  deployedAt: Date;
}

export interface IPNSKeyInfo {
  id: string;
  name: string;
  created: Date;
}

export class IPFSDeployer {
  private storage: JejuStorageClient;
  private config: IPFSDeploymentConfig;

  constructor(config: IPFSDeploymentConfig) {
    this.config = config;
    this.storage = getJejuStorageClient();
  }

  async deploy(): Promise<DeploymentResult> {
    logger.info('[IPFSDeployer] Starting', {
      jnsDomain: this.config.jnsDomain,
    });

    await this.buildStaticExport();
    const { cid, fileCount, totalSize } = await this.uploadDirectory(
      this.config.buildDir
    );
    logger.info('[IPFSDeployer] Uploaded', { cid, fileCount, totalSize });

    const ipnsKey = await this.getOrCreateIPNSKey(this.config.ipnsKeyName);
    const ipnsName = await this.publishToIPNS(ipnsKey.id, cid);
    logger.info('[IPFSDeployer] Published IPNS', { ipnsName });

    await this.updateJNSRecord(this.config.jnsDomain, ipnsName);
    logger.info('[IPFSDeployer] Updated JNS', {
      domain: this.config.jnsDomain,
    });

    const deployedAt = new Date();
    await this.storeDeploymentMetadata(cid, {
      version: this.config.metadata?.version,
      commitHash: this.config.metadata?.commitHash,
      deployedAt,
      ipnsName,
      jnsDomain: this.config.jnsDomain,
      fileCount,
      totalSize,
    });

    return {
      cid,
      ipnsKey: ipnsKey.id,
      ipnsName,
      gatewayUrl: `https://ipfs.jeju.network/ipfs/${cid}`,
      jnsUrl: `https://${this.config.jnsDomain}`,
      fileCount,
      totalSize,
      deployedAt,
    };
  }

  private async buildStaticExport(): Promise<void> {
    const { spawn } = await import('child_process');
    return new Promise((resolve, reject) => {
      const build = spawn('bun', ['run', 'build:export'], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      build.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`Build failed: ${code}`))
      );
      build.on('error', reject);
    });
  }

  private async uploadDirectory(
    dir: string
  ): Promise<{ cid: string; fileCount: number; totalSize: number }> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const files: Array<{ path: string; content: Buffer }> = [];
    let totalSize = 0;

    async function collect(currentDir: string, basePath: string) {
      for (const entry of await fs.readdir(currentDir, {
        withFileTypes: true,
      })) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.join(basePath, entry.name);
        if (entry.isDirectory()) {
          await collect(fullPath, relativePath);
        } else {
          const content = await fs.readFile(fullPath);
          files.push({ path: relativePath, content });
          totalSize += content.length;
        }
      }
    }
    await collect(dir, '');

    const response = await fetch(
      `${this.getStorageEndpoint()}/api/v1/upload-directory`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          files: files.map((f) => ({
            path: f.path,
            content: f.content.toString('base64'),
          })),
        }),
        signal: AbortSignal.timeout(600000),
      }
    );
    if (!response.ok)
      throw new Error(
        `Upload failed: ${response.status} - ${await response.text()}`
      );
    return {
      cid: ((await response.json()) as { cid: string }).cid,
      fileCount: files.length,
      totalSize,
    };
  }

  private async getOrCreateIPNSKey(name: string): Promise<IPNSKeyInfo> {
    const listRes = await fetch(
      `${this.getStorageEndpoint()}/api/v1/ipns/keys`,
      {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!listRes.ok) throw new Error(`List keys failed: ${listRes.status}`);
    const { keys } = (await listRes.json()) as {
      keys: Array<{ id: string; name: string; created: string }>;
    };
    const existing = keys.find((k) => k.name === name);
    if (existing)
      return {
        id: existing.id,
        name: existing.name,
        created: new Date(existing.created),
      };

    const createRes = await fetch(
      `${this.getStorageEndpoint()}/api/v1/ipns/keys`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!createRes.ok)
      throw new Error(`Create key failed: ${createRes.status}`);
    const newKey = (await createRes.json()) as {
      id: string;
      name: string;
      created: string;
    };
    return {
      id: newKey.id,
      name: newKey.name,
      created: new Date(newKey.created),
    };
  }

  private async publishToIPNS(keyId: string, cid: string): Promise<string> {
    const response = await fetch(
      `${this.getStorageEndpoint()}/api/v1/ipns/publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ keyId, cid, ttl: '1h', sequence: Date.now() }),
        signal: AbortSignal.timeout(60000),
      }
    );
    if (!response.ok)
      throw new Error(`IPNS publish failed: ${response.status}`);
    return ((await response.json()) as { name: string }).name;
  }

  private async updateJNSRecord(
    domain: string,
    ipnsName: string
  ): Promise<void> {
    const response = await fetch(
      `${this.getJNSEndpoint()}/api/v1/records/${domain}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ contentHash: `/ipns/${ipnsName}`, ttl: 300 }),
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!response.ok) throw new Error(`JNS update failed: ${response.status}`);
  }

  private async storeDeploymentMetadata(
    cid: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.storage.uploadJSON(
      { cid, ...metadata },
      `deployment-${Date.now()}.json`,
      { folder: 'deployments' }
    );
  }

  async getDeploymentHistory() {
    const files = await this.storage.listFiles('deployments');
    const deployments = await Promise.all(
      files.map(async (f) => {
        const data = await this.storage.downloadJSON<{
          cid: string;
          version?: string;
          deployedAt: string;
          ipnsName: string;
        }>(f.cid);
        return {
          cid: data.cid,
          version: data.version,
          deployedAt: new Date(data.deployedAt),
          ipnsName: data.ipnsName,
        };
      })
    );
    return deployments.sort(
      (a, b) => b.deployedAt.getTime() - a.deployedAt.getTime()
    );
  }

  async resolveJNS(domain: string): Promise<string | null> {
    const response = await fetch(
      `${this.getJNSEndpoint()}/api/v1/resolve/${domain}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok)
      return response.status === 404
        ? null
        : (() => {
            throw new Error(`JNS resolve failed: ${response.status}`);
          })();
    return ((await response.json()) as { contentHash: string }).contentHash;
  }

  private getStorageEndpoint(): string {
    return (
      process.env.JEJU_STORAGE_ENDPOINT ??
      (process.env.JEJU_NETWORK === 'mainnet'
        ? 'https://storage.jeju.io'
        : 'https://storage.testnet.jeju.io')
    );
  }

  private getJNSEndpoint(): string {
    return (
      process.env.JNS_ENDPOINT ??
      (process.env.JEJU_NETWORK === 'mainnet'
        ? 'https://jns.jeju.network'
        : 'https://jns.testnet.jeju.network')
    );
  }

  private getAuthHeaders(): Record<string, string> {
    return process.env.JEJU_STORAGE_API_KEY
      ? { Authorization: `Bearer ${process.env.JEJU_STORAGE_API_KEY}` }
      : {};
  }
}

let deployer: IPFSDeployer | null = null;

export function getIPFSDeployer(
  config?: Partial<IPFSDeploymentConfig>
): IPFSDeployer {
  if (!deployer) {
    deployer = new IPFSDeployer({
      jnsDomain: config?.jnsDomain || process.env.JNS_DOMAIN || 'babylon.jeju',
      ipnsKeyName:
        config?.ipnsKeyName || process.env.IPNS_KEY_NAME || 'babylon-web',
      buildDir: config?.buildDir || 'out',
      metadata: config?.metadata,
    });
  }
  return deployer;
}

export async function deployToIPFS(
  config?: Partial<IPFSDeploymentConfig>
): Promise<DeploymentResult> {
  return getIPFSDeployer(config).deploy();
}
