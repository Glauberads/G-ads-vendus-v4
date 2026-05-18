-- Migration: Adicionar suporte para Stripe e Pagar.me
-- Data: 2026-05-18

-- 1. Atualizar o tipo ENUM payment_gateway de forma segura
ALTER TYPE public.payment_gateway ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE public.payment_gateway ADD VALUE IF NOT EXISTS 'pagarme';

-- 2. Adicionar colunas de chaves confidenciais e switches de controle na tabela payment_settings
ALTER TABLE public.payment_settings 
  ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagarme_api_key TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_encryption_key TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_enabled BOOLEAN DEFAULT false;
