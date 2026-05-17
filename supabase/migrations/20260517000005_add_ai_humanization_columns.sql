-- ============================================================================
-- Adiciona configurações de Inteligência Artificial e Humanização de Presença
-- Tabela: organizations
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ai_grouping_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_grouping_window_ms integer DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS ai_grouping_max_ms integer DEFAULT 8000,
  
  ADD COLUMN IF NOT EXISTS ai_typing_min_ms integer DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS ai_typing_max_ms integer DEFAULT 7000,
  
  ADD COLUMN IF NOT EXISTS ai_dedup_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_dedup_window_ms integer DEFAULT 120000,
  
  ADD COLUMN IF NOT EXISTS ai_single_processing_per_conversation boolean DEFAULT true,
  
  ADD COLUMN IF NOT EXISTS presence_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS presence_recording_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS presence_typing_chars_per_sec integer DEFAULT 28,
  ADD COLUMN IF NOT EXISTS presence_jitter_pct integer DEFAULT 15;

-- Adiciona a descrição no banco para facilitar a documentação
COMMENT ON COLUMN public.organizations.ai_grouping_enabled IS 'Se a IA deve agrupar mensagens antes de responder';
COMMENT ON COLUMN public.organizations.ai_dedup_window_ms IS 'Janela de tempo para evitar respostas repetidas (ms)';
COMMENT ON COLUMN public.organizations.presence_enabled IS 'Se a IA envia status de "digitando..." pelo Evolution API';
