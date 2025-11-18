/**
 * Shared Type Definitions for Tests
 *
 * Production-ready types to replace all 'any' and 'unknown' usage
 */

import type { TrainedModel, TrainingBatch, Trajectory } from '@prisma/client';

// ============================================================================
// Actors Data Types
// ============================================================================

// Note: ActorData, Organization, and ActorsDatabase are now exported from @/shared/types
// Import them from there instead of redefining:
// import type { ActorData, Organization, ActorsDatabase } from '@/shared/types';

// Legacy alias for backward compatibility in tests
export type {
  ActorData,
  ActorsDatabase as ActorsDataFile,
  Organization as OrganizationData,
} from '@/shared/types';

// ============================================================================
// Prisma Mock Types
// ============================================================================

export type MockPrismaTrajectory = {
  count: () => Promise<number>;
  groupBy: () => Promise<Array<{ scenarioId: string; _count: number }>>;
  findMany: () => Promise<Array<Pick<Trajectory, 'trajectoryId' | 'stepsJson'>>>;
  updateMany: () => Promise<{ count: number }>;
};

export type MockPrismaTrainingBatch = {
  create: () => Promise<TrainingBatch>;
  findUnique: (args: { where: { batchId: string } }) => Promise<TrainingBatch | null>;
  findFirst: () => Promise<TrainingBatch | null>;
  count: () => Promise<number>;
};

export type MockPrismaTrainedModel = {
  findFirst: () => Promise<TrainedModel | null>;
  create: () => Promise<TrainedModel>;
  count: () => Promise<number>;
};

export type MockPrismaUser = {
  count: () => Promise<number>;
};

export type MockPrismaClient = {
  trajectory: MockPrismaTrajectory;
  trainingBatch: MockPrismaTrainingBatch;
  trainedModel: MockPrismaTrainedModel;
  user: MockPrismaUser;
  $queryRaw: () => Promise<Array<{ result: number }>>;
};

// ============================================================================
// Logger Mock Types
// ============================================================================

export type MockLogger = {
  info: () => void;
  warn: () => void;
  error: () => void;
};

// ============================================================================
// PostHog Types
// ============================================================================

export type PostHogEvent = {
  event: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
};

export type PostHogConfig = {
  respect_dnt?: boolean;
  capture_exceptions?: boolean;
};

export type PostHogInstance = {
  capture: (
    event: string,
    properties?: Record<string, string | number | boolean | null | undefined>
  ) => void;
  config?: PostHogConfig;
};

export interface WindowWithPostHog extends Window {
  __postHogEvents?: PostHogEvent[];
  posthog?: PostHogInstance;
}

// ============================================================================
// MetaMask Types (for Synpress)
// ============================================================================

export type MetaMask = {
  connectToDapp: () => Promise<void>;
  confirmSignature: () => Promise<void>;
};

// ============================================================================
// API Response Types
// ============================================================================

// Note: ApiResponse is now exported from src/types/common.ts
// Import it from there: import type { ApiResponse } from '@/types/common';

export type PerpetualsData = {
  positions: Array<{
    id: string;
    ticker?: string;
    side: string;
    unrealizedPnL: number;
  }>;
  stats: {
    totalPositions: number;
    totalPnL: number;
    totalFunding: number;
  };
};

export type PredictionsData = {
  positions: Array<{
    id: string;
    side: string;
    unrealizedPnL: number;
  }>;
  stats: {
    totalPositions: number;
  };
};

export type PositionsResponse = {
  perpetuals: PerpetualsData;
  predictions: PredictionsData;
};

export type PartialPositionsResponse = {
  perpetuals?: PerpetualsData | null;
  predictions?: PredictionsData | undefined;
};
