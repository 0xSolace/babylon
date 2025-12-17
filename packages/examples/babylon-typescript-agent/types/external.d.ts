// Type declarations for external modules with broken symlinks

declare module '@ai-sdk/anthropic' {
  export function anthropic(model: string): unknown;
  export function createAnthropic(config?: unknown): {
    (model: string): unknown;
  };
}

declare module '@ai-sdk/groq' {
  export function groq(model: string): unknown;
  export function createGroq(config?: unknown): {
    (model: string): unknown;
  };
}

declare module 'agent0-sdk' {
  export interface SDKConfig {
    chainId: number;
    rpcUrl: string;
    signer: string;
    ipfs?: string;
    subgraphUrl?: string;
    [key: string]: unknown;
  }

  export interface RegistrationResult {
    tokenId: number;
    txHash: string;
    metadataCID: string;
    agentId: string;
    agentURI: string;
  }

  export interface Agent {
    register(): Promise<RegistrationResult>;
    registerIPFS(): Promise<RegistrationResult>;
    setMetadata(metadata: Record<string, unknown>): Agent;
    setActive(active: boolean): Agent;
    setA2A(url: string, version: string, isSecure: boolean): Promise<Agent>;
  }

  export class SDK {
    constructor(config: SDKConfig);
    createAgent(name: string, description: string, imageUrl?: string): Agent;
    [key: string]: unknown;
  }
}
