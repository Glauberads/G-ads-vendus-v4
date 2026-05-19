# 🎨 Scale — Plataforma de Vendas com Agentes de IA (White Label)

[![React 18](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-green.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green.svg)](https://supabase.com/)
[![Deploy: Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)

O **Scale** (anteriormente *Vendus v3*) é uma plataforma SaaS *All-in-One* ultra-premium projetada para automação de vendas, gestão de leads (CRM), atendimento omnichannel e agentes autônomos de Inteligência Artificial. Totalmente **White Label**, ela permite que empreendedores hospedem a plataforma sob seu próprio domínio, customizem a identidade visual completa e revendam o acesso como seu próprio produto recorrente.

---

## 🚀 Principais Funcionalidades

### 1. 💼 CRM & Funil Kanban Visual
- Gestão ágil de leads com interface drag-and-drop.
- Definição de temperatura do lead, deal value e dados de contato.
- Histórico completo da jornada do lead e anotações.

### 2. 💬 Inbox Omnichannel
- Chat unificado integrando **WhatsApp** (via Evolution API), **Instagram**, **Facebook** e **WebChat**.
- Distribuição automática de leads (*Round Robin*, menor carga e status).
- Histórico compartilhado e sistema deSquards/setores.

### 3. 🤖 Agentes de IA Autônomos & Copiloto
- Agentes de IA que operam proativamente por texto e voz (ElevenLabs + Twilio).
- Cérebro do produto customizável (treinamento por PDFs, sites, FAQs, canais do YouTube).
- Copiloto interno no CRM para guiar os vendedores e sugerir os próximos passos.

### 4. 📅 Booking System & Calendário
- Página pública de agendamentos online para clientes.
- Integração bidirecional com Google Calendar OAuth.
- Disparos de lembretes e confirmações automáticas de agendamento por e-mail e WhatsApp.

### 5. 💰 Gestão Financeira & Comissões
- Acompanhamento de metas de vendas.
- Cálculo de comissões por regras configuráveis por squad e produto.
- Previsão de receita de forma integrada.

### 6. 🏷️ White Label Total
- Personalização de logotipo (light/dark), favicon, título do navegador, manifest PWA e cores do sistema.
- Painel Super Admin para controle absoluto de planos, organizações e revendas.

### 7. 💳 Scale Pay — Gateways de Pagamento Integrados (Multi-Tenant)
- **Stripe**: Checkout Session seguro de cartão e boleto com redirecionamento externo.
- **Pagar.me (V5)**: Pix Direct nativo com modal interno e estrutura preparada para Cartão Transparente.
- **Mercado Pago & Asaas**: Pagamentos de Pix Direct com temporizador regressivo e auto-abandono.
- **Webhook Securizado**: Edge Functions dedicadas a receber e validar assinaturas e notificações de pagamento (Stripe raw body verificado via Web Crypto HMAC-SHA256).

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui.
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, RPCs baseados em segurança robusta).
- **Serviços Serverless**: +85 Edge Functions baseadas em Deno no Supabase.
- **Hospedagem**: Vercel (com fallback SPA integrado via `vercel.json`).
- **Autenticação**: Supabase Auth nativo com suporte a e-mail/senha e login social (Google OAuth).

---

## 📦 Estrutura do Repositório

```
├── .lovable/                 # Configurações do Lovable
├── docs/                     # Documentação de referência técnica
├── public/                   # Arquivos estáticos públicos e favicon
├── src/                      # Código-fonte do Frontend
│   ├── assets/               # Imagens, logotipos Scale oficiais e estilos
│   ├── components/           # Componentes de interface reutilizáveis (UI/Dashboard)
│   │   └── admin/payments/   # Formulários de gateways e modal de checkout
│   ├── hooks/                # Custom React hooks (usePaymentGateways)
│   ├── pages/                # Páginas da aplicação (Login, CRM, SuperAdmin, WhiteLabel)
│   ├── types/                # Definições de tipos TypeScript
│   └── utils/                # Funções utilitárias e clientes de API
├── supabase/                 # Estrutura do Backend
│   ├── config.toml           # Configurações de Edge Functions e JWT
│   ├── functions/            # Código-fonte das Edge Functions (Deno)
│   │   ├── generate-stripe-checkout/   # Criação de Checkout Session Stripe
│   │   ├── stripe-webhook/             # Webhook Stripe com raw body e HMAC
│   │   ├── generate-pagarme-checkout/  # Pix Direct Pagar.me V5
│   │   └── pagarme-webhook/            # Webhook Pagar.me V5
│   └── migrations/           # Migrações SQL versionadas (Adição de Stripe e Pagar.me)
├── vercel.json               # Regras de roteamento SPA da Vercel
└── vite.config.ts            # Configurações de build do Vite
```

---

## ⚡ Começando no Desenvolvimento Local

### Pré-requisitos
- Node.js (v18+) instalado
- npm ou bun instalado

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/Glauberads/G-ads-vendus-v4.git
cd G-ads-vendus-v4
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com as chaves do seu projeto Supabase:
```env
VITE_SUPABASE_URL=https://nmlgttqvnicfdpsypzpl.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

### 3. Rodar o Servidor de Desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:5173` no seu navegador.

---

## 🌐 Deploy em Produção

### 📦 Hospedagem do Frontend (Vercel)
A aplicação está configurada para deploy automático na **Vercel** ao efetuar push na branch `main`.

> [!IMPORTANT]
> Assegure-se de que o arquivo `vercel.json` está na raiz com as regras de **rewrites** para evitar erros `404 NOT_FOUND` ao atualizar rotas internas (SPA):
> ```json
> {
>   "rewrites": [
>     {
>       "source": "/(.*)",
>       "destination": "/index.html"
>     }
>   ]
> }
> ```

### 🗄️ Backend (Supabase)
As migrações SQL no diretório `supabase/migrations/` fornecem 100% de consistência estrutural. 
Para aplicar modificações estruturais de forma segura (como RLS e RPCs do Super Admin), crie migrações versionadas e aplique-as via CLI oficial do Supabase:
```bash
supabase db push
```

---

## 📝 Documentação Completa
Para um mergulho profundo no funcionamento interno do banco de dados, RLS, Edge Functions, OAuth, fluxos de login e primeiro acesso do Super Admin, leia o arquivo central:
👉 **[documentação.md](file:///c:/Users/Usúario x/Downloads/Nova pasta (2)/vendus-v3-main/documentação.md)**

---

## ⚖️ Licença
© 2026 **Scale**. Todos os direitos reservados.
Este código-fonte é proprietário e licenciado exclusivamente para uso comercial na modalidade *White Label*.
