-- Criar bucket para assets globais da plataforma (logos, favicons, etc)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Garantir que as policies antigas sejam limpas para evitar erros de duplicidade
DROP POLICY IF EXISTS "Logos da plataforma são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Apenas super admins podem inserir logos" ON storage.objects;
DROP POLICY IF EXISTS "Apenas super admins podem atualizar logos" ON storage.objects;
DROP POLICY IF EXISTS "Apenas super admins podem deletar logos" ON storage.objects;

-- Políticas de acesso para o bucket platform-assets

-- 1. SELECT: Leitura pública para que os logos/favicons possam ser exibidos em qualquer lugar
CREATE POLICY "Logos da plataforma são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'platform-assets');

-- 2. INSERT: Apenas super_admin autenticados podem inserir novos logos
CREATE POLICY "Apenas super admins podem inserir logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'platform-assets' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'::public.app_role
  )
);

-- 3. UPDATE: Apenas super_admin autenticados podem atualizar logos existentes
CREATE POLICY "Apenas super admins podem atualizar logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'platform-assets' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'::public.app_role
  )
)
WITH CHECK (
  bucket_id = 'platform-assets' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'::public.app_role
  )
);

-- 4. DELETE: Apenas super_admin autenticados podem deletar logos
CREATE POLICY "Apenas super admins podem deletar logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'platform-assets' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'::public.app_role
  )
);
