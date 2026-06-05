-- Migration: add docx and txt source types
-- Run this in Supabase SQL Editor if you already ran the original schema

ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_source_type_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_source_type_check
  CHECK (source_type IN ('youtube', 'article', 'pdf', 'docx', 'txt', 'note'));
