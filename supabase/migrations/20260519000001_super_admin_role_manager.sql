-- Adiciona o valor 'support' ao enum app_role se não existir
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

-- Altera a tabela public.user_roles para adicionar a coluna organization_id e updated_at se não existirem
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Cria a RPC segura update_user_role_by_super_admin
CREATE OR REPLACE FUNCTION public.update_user_role_by_super_admin(
  p_user_id uuid,
  p_role text,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_super_admin boolean;
  v_new_role public.app_role;
  v_old_role text;
  v_old_organization_id uuid;
BEGIN
  -- 1. Obter auth.uid() do contexto
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- 2. Confirmar se o chamador tem a role 'super_admin'
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = v_caller_id AND role = 'super_admin'::public.app_role
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Super Admins podem gerenciar cargos');
  END IF;

  -- 3. Validar se a role informada é um valor válido do enum app_role
  BEGIN
    v_new_role := p_role::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cargo inválido');
  END;

  -- 4. Impedir que o usuário remova o seu próprio super_admin
  IF p_user_id = v_caller_id AND v_new_role != 'super_admin'::public.app_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não pode remover o seu próprio cargo de Super Admin');
  END IF;

  -- 5. Capturar dados antigos para auditoria
  SELECT 
    role::text, 
    organization_id 
  INTO 
    v_old_role, 
    v_old_organization_id
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1;

  -- 6. Atualizar user_roles (Deleta antiga e insere nova)
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  
  INSERT INTO public.user_roles (user_id, role, organization_id, updated_at)
  VALUES (p_user_id, v_new_role, p_organization_id, now());

  -- 7. Atualizar o organization_id em profiles (fonte primária de verdade)
  UPDATE public.profiles
  SET organization_id = p_organization_id, updated_at = now()
  WHERE id = p_user_id;

  -- 8. Gravar auditoria em platform_audit_logs se a tabela existir
  INSERT INTO public.platform_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_caller_id,
    'update_user_role',
    'user',
    p_user_id,
    jsonb_build_object(
      'old_role', v_old_role,
      'new_role', p_role,
      'old_organization_id', v_old_organization_id,
      'new_organization_id', p_organization_id,
      'changed_at', now()
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
