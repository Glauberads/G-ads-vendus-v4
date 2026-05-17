# Checklist de Produção (Vendus V3)

Siga este checklist rigorosamente antes e durante o lançamento da aplicação em ambiente de produção (Vercel ou similar).

## 1. Variáveis de Ambiente (Environment Variables)

Configure as seguintes variáveis na plataforma de hospedagem (ex: Vercel, Netlify):

### **Obrigatórias (Frontend & Backend Supabase)**
- `VITE_SUPABASE_URL`: A URL do projeto Supabase (ex: `https://nmlgttqvnicfdpsypzpl.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: A chave pública (anon key) fornecida pelo Supabase.

### **Opcionais (Recomendado para Produção)**
- **Resend (Envio de E-mails):**
  - `RESEND_API_KEY`: Chave da API do Resend para envios transacionais (ex: invites).
  - `VITE_DEFAULT_FROM_EMAIL`: E-mail de remetente aprovado (ex: `no-reply@vendus.com.br`).
- **Webhooks & Integrações Externas:**
  - `WEBHOOK_SECRET_KEY`: Chave secreta para assinar as requisições de webhooks disparados.
  - `STRIPE_SECRET_KEY` ou Gateway equivalente (caso haja cobrança de assinatura).
  - `VITE_APP_URL`: URL oficial da aplicação de produção (para links absolutos).

---

## 2. Comandos de Build e Deploy

- **Testar Localmente:** 
  ```bash
  npm run build
  ```
- **Deploy via Vercel CLI (Manual):**
  ```bash
  vercel --prod
  ```
  *(Ou conecte diretamente o repositório do GitHub à Vercel para deploys automáticos em cada `push` na branch `main`)*.

---

## 3. Comandos de Banco de Dados e Rollback

Para manter a integridade do schema sem depender do Frontend:

- **Sincronizar Schema (Deploy de Novas Funcionalidades):**
  ```bash
  supabase db push --db-url "postgresql://postgres:[SENHA]@db.[PROJECT-REF].supabase.co:5432/postgres"
  ```
- **Rollback de Banco (Em Caso de Falha Severa):**
  Acesse o Dashboard do Supabase > Database > Backups e restaure para o último *Point in Time* diário. Não faça rollbacks agressivos via CLI em Produção sem entender o *loss* de dados.

---

## 4. Como Criar o Primeiro Admin (Super Admin)

Em Produção, você não deve rodar scripts de Seed. O primeiro Super Admin deve ser provisionado com segurança:

1. Acesse a aplicação na Vercel recém-deployada.
2. Na tela de Login/Signup, **cadastre** um novo usuário (ex: `fundador@vendus.com.br`).
3. Vá ao **Painel do Supabase** > *SQL Editor*.
4. Rode a seguinte query para promover o usuário a Super Admin:
   ```sql
   UPDATE public.user_roles 
   SET role = 'super_admin' 
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'fundador@vendus.com.br');
   ```
5. Faça o Log out e Log in novamente no sistema. Agora você verá o painel de Super Admin e poderá criar as **Organizações** e convidar os primeiros clientes.

---

## 5. Como Migrar Dados Reais Futuramente

Quando estiver preparado para migrar os dados do "banco velho" para o novo Supabase:

1. **Extração:** Exporte as tabelas principais (organizations, profiles, leads, deals) do banco antigo em formato `.csv` ou `.sql`.
2. **Transformação:** Certifique-se de que as senhas em `auth.users` estão adequadamente migradas (usualmente requer contato com o suporte do Supabase ou scripts em pgAdmin usando a API de importação do GoTrue).
3. **Carga Segura:** 
   * Importe primeiro `organizations`.
   * Depois, os usuários via dashboard ou script `pgAdmin`.
   * Em seguida, importe o *core business* respeitando as restrições de chave estrangeira (`products` -> `squads` -> `leads` -> `deals`).
   * Desative as **Triggers de Webhooks/E-mails** temporariamente durante a importação (para não disparar 1000 e-mails "Seu lead foi movido" para os vendedores).
