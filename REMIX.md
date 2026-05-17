# 🚀 Remix do Vendus — Primeiros Passos

Bem-vindo! Este projeto já vem com um **Super Admin pré-criado** e toda a base configurada. Você consegue entrar e usar imediatamente após o remix.

---

## 🔑 Credenciais iniciais

| Campo | Valor |
|---|---|
| **E-mail** | `superadmin@vendus.com.br` |
| **Senha** | `@Mudarsenha#123` |
| **Papéis** | `super_admin` + `admin` |

> 🔴 **TROQUE A SENHA NO PRIMEIRO ACESSO.** O sistema detecta automaticamente quando a senha padrão é alterada e remove o alerta vermelho do Dashboard.

Acesse `/login`, faça login e vá em **Perfil → Trocar senha**.

---

## ✅ O que já vem pronto

- Super Admin com profile completo (auth + profiles + user_roles)
- Trigger automático que cria `profiles` para qualquer novo usuário (corrige todos os erros de FK em `team_invitations`, `platform_audit_logs`, etc.)
- Estrutura completa do banco (tabelas, RLS, funções, triggers)
- Edge functions deployadas automaticamente

## ⚠️ O que você precisa configurar manualmente

São coisas específicas de cada workspace e não dá para automatizar:

1. **Trocar a senha padrão** (🔴 crítico)
2. **Identidade visual** — `/super-admin` → Identidade Visual (logo, cores, nome da plataforma)
3. **Domínio de e-mail** — Lovable Cloud → Emails
4. **Servidor Evolution Go** — se for usar WhatsApp (`/super-admin` → WhatsApp)
5. **Login com Google** — opcional, em Lovable Cloud → Auth
6. **Pagamentos** — Stripe / Cakto / Hotmart, se aplicável

---

## 🔐 Garantias técnicas

- **Migrations idempotentes**: rodam 1x por banco (controle nativo Supabase + guardas `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- **Seed do Super Admin**: só executa se NÃO existir nenhum `super_admin` no banco. Remixes que já promoveram outra conta ficam intocados.
- **Trigger `on_auth_user_created`**: todo novo usuário ganha profile automaticamente, eliminando erros de chave estrangeira.

---

Qualquer dúvida, consulte a Central de Ajuda dentro do app.
