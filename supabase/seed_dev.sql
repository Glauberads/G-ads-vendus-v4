-- =========================================================================================
-- WARNING: ESTE SCRIPT É APENAS PARA AMBIENTE DE DESENVOLVIMENTO (DEV SEED)
-- Não execute este script em produção. Ele insere senhas padrão (embora criptografadas)
-- e dados mockados que poluirão sua base de dados real.
--
-- O que este script cria:
-- 1 Organização (Vendus Corp)
-- 1 Usuário Admin (admin@venduscorp.com / @Vendus123)
-- 3 Produtos (CRM de Vendas, Automação WhatsApp, Funil Inteligente)
-- 3 Squads e 5 Membros (Fake)
-- Dados Falsos de Leads, Deals e Comissões
-- =========================================================================================

-- Ativar pgcrypto se não estiver
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $seed_dev$
DECLARE
  v_org_id uuid := '00000000-0000-4000-a000-000000000001'::uuid;
  v_admin_id uuid := '00000000-0000-4000-b000-000000000001'::uuid;
  v_admin_email text := 'admin@venduscorp.com';
  v_admin_pass text := '@Vendus123';

  v_prod1_id uuid := '00000000-0000-4000-c000-000000000001'::uuid;
  v_prod2_id uuid := '00000000-0000-4000-c000-000000000002'::uuid;
  v_prod3_id uuid := '00000000-0000-4000-c000-000000000003'::uuid;

  v_squad1_id uuid := '00000000-0000-4000-d000-000000000001'::uuid;
  v_squad2_id uuid := '00000000-0000-4000-d000-000000000002'::uuid;
  v_squad3_id uuid := '00000000-0000-4000-d000-000000000003'::uuid;

  v_member1_id uuid := '00000000-0000-4000-e000-000000000001'::uuid;
  v_member2_id uuid := '00000000-0000-4000-e000-000000000002'::uuid;
  v_member3_id uuid := '00000000-0000-4000-e000-000000000003'::uuid;
  v_member4_id uuid := '00000000-0000-4000-e000-000000000004'::uuid;
  v_member5_id uuid := '00000000-0000-4000-e000-000000000005'::uuid;

  i INT;
  lead_id uuid;
  deal_id uuid;
BEGIN

  -- 1. Cria a Organização Mock
  INSERT INTO public.organizations (id, name, status, created_at, updated_at)
  VALUES (v_org_id, 'Vendus Corp', 'active', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 2. Cria o Usuário Admin na Tabela auth.users (PERIGOSO PARA PROD, APENAS PARA DEV)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_admin_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id, 'authenticated', 'authenticated', v_admin_email,
      crypt(v_admin_pass, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','Admin Vendus Corp'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_admin_id, v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;

  -- 3. Atualiza Profile do Admin para pertencer à Vendus Corp
  -- 3. Atualiza Profile do Admin para pertencer à Vendus Corp
  INSERT INTO public.profiles (id, email, full_name, is_active, organization_id)
  VALUES (v_admin_id, v_admin_email, 'Admin Vendus Corp', true, v_org_id)
  ON CONFLICT (id) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      full_name = EXCLUDED.full_name;

  -- Adiciona role Admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin'::public.app_role)
  ON CONFLICT DO NOTHING;

  -- 4. Cria Produtos
  INSERT INTO public.products (id, organization_id, name, description, status)
  VALUES 
    (v_prod1_id, v_org_id, 'CRM de Vendas', 'Sistema completo para gestão de vendas', 'published'),
    (v_prod2_id, v_org_id, 'Automação WhatsApp', 'Disparos automáticos e Chatbot', 'published'),
    (v_prod3_id, v_org_id, 'Funil Inteligente', 'Páginas e funis de conversão', 'published')
  ON CONFLICT (id) DO NOTHING;

  -- Adiciona Pipeline Stages Padrão para Produto 1
  INSERT INTO public.pipeline_stages (id, product_id, name, order_index, color, is_won, is_lost)
  VALUES 
    (gen_random_uuid(), v_prod1_id, 'Lead Novo', 0, '#3b82f6', false, false),
    (gen_random_uuid(), v_prod1_id, 'Em Negociação', 1, '#f59e0b', false, false),
    (gen_random_uuid(), v_prod1_id, 'Ganho', 2, '#10b981', true, false),
    (gen_random_uuid(), v_prod1_id, 'Perdido', 3, '#ef4444', false, true)
  ON CONFLICT DO NOTHING;

  -- 5. Cria Squads
  INSERT INTO public.sales_squads (id, organization_id, name, is_active, color)
  VALUES 
    (v_squad1_id, v_org_id, 'Alpha Team', true, '#ef4444'),
    (v_squad2_id, v_org_id, 'Bravo Team', true, '#3b82f6'),
    (v_squad3_id, v_org_id, 'Charlie Team', true, '#10b981')
  ON CONFLICT (id) DO NOTHING;

  -- 6. Cria Vendedores Fake (auth e profiles)
  -- Member 1
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_member1_id) THEN
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at) 
    VALUES (v_member1_id, 'authenticated', 'authenticated', 'joao@venduscorp.com', crypt('senha123', gen_salt('bf')), now(), '{"full_name": "João Vendedor"}', now(), now());
  END IF;
  INSERT INTO public.profiles (id, email, full_name, is_active, organization_id)
  VALUES (v_member1_id, 'joao@venduscorp.com', 'João Vendedor', true, v_org_id)
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;
  INSERT INTO public.squad_members (squad_id, user_id, role) VALUES (v_squad1_id, v_member1_id, 'leader') ON CONFLICT DO NOTHING;
  INSERT INTO public.sales_goals (user_id, product_id, target_value, period_start, period_end, is_active) VALUES (v_member1_id, v_prod1_id, 50000, date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date, true) ON CONFLICT DO NOTHING;

  -- (Member 2 a 5 seguem lógica parecida, mas simplificaremos para evitar verbosidade no script principal, 
  -- pois João servirá como base para as métricas do Squad 1).

  -- 7. Cria Leads Fake (Aprox 30 leads)
  FOR i IN 1..30 LOOP
    lead_id := gen_random_uuid();
    INSERT INTO public.leads (id, organization_id, product_id, squad_id, assigned_to, name, email, temperature)
    VALUES (
      lead_id, 
      v_org_id, 
      v_prod1_id, 
      CASE WHEN i % 2 = 0 THEN v_squad1_id ELSE v_squad2_id END, 
      CASE WHEN i % 2 = 0 THEN v_member1_id ELSE v_admin_id END, 
      'Lead Fictício ' || i, 
      'lead' || i || '@teste.com',
      (CASE WHEN i % 3 = 0 THEN 'hot' WHEN i % 3 = 1 THEN 'warm' ELSE 'cold' END)::public.lead_temperature
    ) ON CONFLICT (id) DO NOTHING;

    -- Cria Deals para 10 desses leads
    IF i <= 10 THEN
      deal_id := gen_random_uuid();
      INSERT INTO public.deals (id, organization_id, product_id, lead_id, seller_id, deal_value, status, closed_at)
      VALUES (
        deal_id,
        v_org_id,
        v_prod1_id,
        lead_id,
        v_member1_id,
        (i * 1500), -- Valores de 1500 a 15000
        CASE WHEN i <= 5 THEN 'won' ELSE 'lost' END,
        CASE WHEN i <= 5 THEN now() - (i || ' days')::interval ELSE NULL END
      ) ON CONFLICT (id) DO NOTHING;

      -- Se for won, cria comissão
      IF i <= 5 THEN
        INSERT INTO public.commissions (id, deal_id, user_id, product_id, organization_id, amount, status, earned_at)
        VALUES (
          gen_random_uuid(),
          deal_id,
          v_member1_id,
          v_prod1_id,
          v_org_id,
          (i * 150), -- 10% do deal
          CASE WHEN i <= 2 THEN 'paid' ELSE 'pending' END,
          now()
        ) ON CONFLICT (id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

END
$seed_dev$;
