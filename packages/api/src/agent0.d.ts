declare module '@babylon/agents/agent0' {
  import type { SDK } from 'agent0-sdk';

  export function getAgent0SDK(): SDK;

  export function syncAfterAgent0Registration(
    userId: string,
    agent0TokenId: number
  ): Promise<void>;
}
