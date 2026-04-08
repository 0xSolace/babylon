/**
 * `OracleCommitment` persistence (commit–reveal salt storage).
 *
 * **Why here:** CRUD SQL only; encryption/decryption stays in engine (`CommitmentStore`).
 */

import { asc, eq } from 'drizzle-orm';
import { asSystem } from './db';
import type { OracleCommitment } from './tables/oracle-commitments';
import { oracleCommitments } from './tables/oracle-commitments';

export async function upsertOracleCommitmentRow(params: {
  newRowId: string;
  questionId: string;
  sessionId: string;
  saltEncrypted: string;
  commitment: string;
  createdAt: Date;
}): Promise<{ id: string; questionId: string; wasCreated: boolean }> {
  return asSystem(async (c) => {
    const existing = await c
      .select({ id: oracleCommitments.id })
      .from(oracleCommitments)
      .where(eq(oracleCommitments.questionId, params.questionId))
      .limit(1);

    if (existing.length > 0) {
      const updated = await c
        .update(oracleCommitments)
        .set({
          sessionId: params.sessionId,
          saltEncrypted: params.saltEncrypted,
          commitment: params.commitment,
        })
        .where(eq(oracleCommitments.questionId, params.questionId))
        .returning({
          id: oracleCommitments.id,
          questionId: oracleCommitments.questionId,
        });

      const updatedRecord = updated[0];
      if (!updatedRecord) {
        throw new Error(
          `Failed to update commitment for question ${params.questionId}`
        );
      }
      return { ...updatedRecord, wasCreated: false };
    }

    const created = await c
      .insert(oracleCommitments)
      .values({
        id: params.newRowId,
        questionId: params.questionId,
        sessionId: params.sessionId,
        saltEncrypted: params.saltEncrypted,
        commitment: params.commitment,
        createdAt: params.createdAt,
      })
      .returning({
        id: oracleCommitments.id,
        questionId: oracleCommitments.questionId,
      });

    const createdRecord = created[0];
    if (!createdRecord) {
      throw new Error(
        `Failed to create commitment for question ${params.questionId}`
      );
    }
    return { ...createdRecord, wasCreated: true };
  }, 'oracle-commitment-store-upsert');
}

export async function fetchOracleCommitmentRowByQuestionId(
  questionId: string
): Promise<OracleCommitment | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(oracleCommitments)
      .where(eq(oracleCommitments.questionId, questionId))
      .limit(1);
    return row ?? null;
  }, 'oracle-commitment-store-retrieve');
}

export async function deleteOracleCommitmentByQuestionId(
  questionId: string
): Promise<{ id: string }[]> {
  return asSystem(
    async (c) =>
      c
        .delete(oracleCommitments)
        .where(eq(oracleCommitments.questionId, questionId))
        .returning({ id: oracleCommitments.id }),
    'oracle-commitment-store-delete'
  );
}

export async function listOracleCommitmentRowsByCreatedAsc(): Promise<
  OracleCommitment[]
> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(oracleCommitments)
        .orderBy(asc(oracleCommitments.createdAt)),
    'oracle-commitment-store-list-pending'
  );
}
