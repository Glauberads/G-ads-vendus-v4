-- ==================================================================================
-- Criação do Bucket "company-assets" no Supabase Storage
-- ==================================================================================

-- 1. Cria o Bucket público, restrito a 2MB e focado em imagens.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true,
  2097152, -- 2MB em bytes
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET public = EXCLUDED.public, 
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. (RLS já vem ativado por padrão na tabela storage.objects do Supabase)

-- 3. Define Políticas de Segurança

-- SELECT: Logo deve ser visível publicamente
DROP POLICY IF EXISTS "Logos da empresa são públicas" ON storage.objects;
CREATE POLICY "Logos da empresa são públicas" 
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

-- INSERT: Apenas usuários logados podem subir arquivos
DROP POLICY IF EXISTS "Apenas usuários autenticados podem enviar logos" ON storage.objects;
CREATE POLICY "Apenas usuários autenticados podem enviar logos" 
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' 
  AND auth.uid() IS NOT NULL
);

-- UPDATE: Apenas usuários logados podem atualizar
DROP POLICY IF EXISTS "Apenas usuários autenticados podem atualizar logos" ON storage.objects;
CREATE POLICY "Apenas usuários autenticados podem atualizar logos" 
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND auth.uid() IS NOT NULL
);

-- DELETE: Apenas usuários logados podem deletar
DROP POLICY IF EXISTS "Apenas usuários autenticados podem deletar logos" ON storage.objects;
CREATE POLICY "Apenas usuários autenticados podem deletar logos" 
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND auth.uid() IS NOT NULL
);
