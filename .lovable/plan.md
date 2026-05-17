# Diagnóstico — webhooks Doppus chegam, mas mensagens não saem

Investiguei os logs e bati no banco. **A causa raiz não é código** — é estado da conexão WhatsApp da empresa dona do FlowSell. Mas existe um bug colateral no `manual-outreach` que amplifica o problema.

## O que está acontecendo (provas)

- Webhook Doppus chega normal: 28 eventos `compra_aprovada`/`pix_gerado` nas últimas 6h, 100 % processados pela engine pós-venda.
- A action `compra_aprovada` do FlowSell (`09925cbe-…`) executa `add_tags`, `remove_tags`, `move_stage` ✅ — só falha em `ai_agent_outreach` com `"WhatsApp send failed (sem instância conectada?)"`.
- Org dona do produto FlowSell = `fb0f9cb1-8535-4e79-8120-1b96ab72450a`.
- A **única** instância Evolution dessa org é `org-conexaodogui` (`4a1049d3-…`) e está com `status = 'qr_pending'` — ou seja, **WhatsApp desconectado, esperando leitura do QR**.
- A action está corretamente apontada pra essa instância (`evolution_instance_id = 4a1049d3-…`), mas:
  - `manual-outreach` chama `evolution-send` **sem repassar o `instance_id`** → `evolution-send` vai pelo fallback que filtra `status = 'connected'` → não encontra nada → retorna 404 → engine marca falha.
  - Mesmo se respeitasse o `instance_id`, a instância está `qr_pending` no Evolution Go, então o envio físico falharia também.

Confirmei que `evolution-send` está saudável: testei direto no número do Pablo (5548…) usando a instância da org `3c5c0168` (testedojoao, `connected`) e o envio retornou 200.

## Ação obrigatória (você, fora do código)

1. Entrar na empresa **Conexão do Gui** (`fb0f9cb1-…`).
2. Ir em **Conexões / WhatsApp**, abrir a instância `org-conexaodogui` e **escanear o QR code** até o status ficar `connected`.
3. Sem esse passo, nenhuma mensagem de pós-venda do FlowSell vai sair, independente do código.

Enquanto a instância está em `qr_pending`, nenhum compromisso de código resolve.

## Correções de código (escopo do plano)

### 1. `supabase/functions/manual-outreach/index.ts` — respeitar `instance_id`
Aceitar `instance_id?: string` no body e repassar pro `evolution-send`:

```ts
// no body parse:
instance_id,
// e em cada invoke:
supabase.functions.invoke('evolution-send', {
  body: { organization_id, instance_id, type: 'text', to: leadPhone, payload: { text: bubbles[i] } }
})
```

### 2. `supabase/functions/_shared/post-sale-engine.ts` — propagar `evolution_instance_id`
No bloco `ai_agent_outreach` (linha ~334), adicionar `instance_id: action.evolution_instance_id` no body do invoke pra manual-outreach. Garante que a action sempre force a instância configurada (mesmo que existam várias na org).

### 3. Pré-checagem de instância antes de marcar `success: true`
Na engine pós-venda, antes de chamar `manual-outreach`, conferir se a instância alvo (ou qualquer da org) está `connected`. Se não estiver:
- Não tentar enviar.
- Gravar `executed_actions[].action = 'ai_agent_outreach'` com `success: false, error: 'whatsapp_disconnected'`.
- Inserir notificação em `admin_notifications` (tipo `whatsapp_disconnected`) pra empresa, com lead_id e referência à action — assim o admin vê na sineta que houve compra cuja mensagem não saiu.

### 4. Banner no painel da empresa
Em `src/components/inbox/AcceptTicketBar.tsx` ou local equivalente: já existe lógica de status. Adicionar um banner global de WhatsApp desconectado quando a única instância da org não está `connected` E houve falha de pós-venda nas últimas 24h. Sem mexer em business logic — apenas leitura e CTA pra reconectar.

## Detalhes técnicos

- Edge functions a redeployar: `manual-outreach` e (via _shared) qualquer função que importa `post-sale-engine.ts` (entre elas: `doppus-webhook`, `cakto-webhook`, `hotmart-webhook`, `process-post-sale-scheduled`, `webhook-receiver`).
- Sem migration nova: as colunas `evolution_instance_id` e `admin_notifications` já existem.
- Não tocar em `evolution-send` — o 404 é semanticamente correto (não há instância conectada).
- Critério de pronto: enviar uma compra Doppus de teste após reconectar o WhatsApp; `post_sale_event_logs` deve mostrar `ai_agent_outreach success: true` e o comprador deve receber a mensagem.

## Fora de escopo

- Auto-reconexão do Evolution Go (depende do servidor externo).
- Refator do dispatcher pós-venda (cron `process-post-sale-scheduled` continua igual).
