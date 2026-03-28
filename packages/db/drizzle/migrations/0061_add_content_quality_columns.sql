-- Add quality score columns for content integrity tracking.
-- Used by ContentQualityGate to persist validation results and by
-- WorldFactsService/ParodyHeadlineGenerator to filter low-quality records
-- out of generation context.
--
-- Nullable: pre-migration records are treated as presumed-OK in queries
-- (WHERE qualityScore IS NULL OR qualityScore >= threshold).

ALTER TABLE "WorldFact" ADD COLUMN "qualityScore" double precision;

ALTER TABLE "ParodyHeadline" ADD COLUMN "qualityScore" double precision;
ALTER TABLE "ParodyHeadline" ADD COLUMN "qualityReasons" jsonb;
