import { describe, expect, it } from 'bun:test';
import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  deriveDeterministicAgentSolanaAsset,
  signAgentSolanaRegistrationTransaction,
} from './sdk';

describe('solana-registry sdk', () => {
  it('replaces the recent blockhash and re-signs the deterministic asset', () => {
    const agentUserId = 'agent-1';
    const asset = deriveDeterministicAgentSolanaAsset(agentUserId);
    const owner = Keypair.generate();
    const originalBlockhash = '11111111111111111111111111111111';
    const freshBlockhash = '3xQ8SWv2mZ7W7yhJvM4C9iM5hP4xM3KgJGdwNwpHd3EG';

    const unsigned = new Transaction({
      feePayer: owner.publicKey,
      recentBlockhash: originalBlockhash,
    }).add(
      new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: asset.publicKey, isSigner: true, isWritable: true },
          { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.alloc(0),
      })
    );

    const transaction = unsigned.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const signed = signAgentSolanaRegistrationTransaction({
      agentUserId,
      transaction: transaction.toString('base64'),
      recentBlockhash: freshBlockhash,
    });

    const decoded = Transaction.from(Buffer.from(signed, 'base64'));
    const assetSignature = decoded.signatures.find(({ publicKey }) =>
      publicKey.equals(asset.publicKey)
    );
    const ownerSignature = decoded.signatures.find(({ publicKey }) =>
      publicKey.equals(owner.publicKey)
    );

    expect(decoded.recentBlockhash).toBe(freshBlockhash);
    expect(assetSignature?.signature).not.toBeNull();
    expect(ownerSignature?.signature).toBeNull();
    expect(decoded.verifySignatures(false)).toBe(true);
  });
});
