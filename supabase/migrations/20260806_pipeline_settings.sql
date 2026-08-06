-- Migration: add settings column to pipelines
-- Purpose: store per-pipeline seller pool and routing config
-- Fields in settings JSONB:
--   seller_pool: string[]      — array of user_ids eligible for this pipeline
--   routing_method: string     — 'round_robin' | 'weighted' | 'none'
--   last_assigned_user_id: string — for round robin tracking
--   routing_weights: {[userId]: number} — for weighted routing

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
