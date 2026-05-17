import { useState, useEffect, useRef, useCallback } from 'react';
import vendusLogo from '@/assets/vendus-logo-white.png';
import './whitelabel.css';

const CHECKOUT_URL = 'https://checkout.doppus.app/30426346/';
const PRICE_INSTALLMENT = 'R$ 103';
const PRICE_TIMES = 12;
const PRICE_TOTAL_INSTALLMENT = 'R$ 1.236';
const PRICE_CASH = 'R$ 997';
const PRICE_FROM = 'R$ 9.970';

const SLIDE_LABELS = ['Dashboard','Pipeline','Inbox','Tarefas','Agendamentos','Financeiro','Cadência','Playbook','Objeções','Materiais','IA Copiloto'];
const SLIDE_ICONS = ['📊','🎯','💬','✅','📅','💰','📧','📖','🛡️','🗂️','🤖'];
const SLIDE_IMAGES = ['/screenshots/visao-geral.webp','/screenshots/pipeline.webp','/screenshots/conversas.webp','/screenshots/tarefas.webp','/screenshots/agendamentos.webp','/screenshots/financeiro.webp','/screenshots/cadencia.webp','/screenshots/playbook.webp','/screenshots/objecoes.webp','/screenshots/materiais.webp','/screenshots/ia-copiloto.webp'];
const SC_URLS: Record<number, string> = {0:"app.suamarca.com.br/visao-geral",1:"app.suamarca.com.br/pipeline",2:"app.suamarca.com.br/conversas",3:"app.suamarca.com.br/tarefas",4:"app.suamarca.com.br/agendamentos",5:"app.suamarca.com.br/financeiro",6:"app.suamarca.com.br/cadencia",7:"app.suamarca.com.br/playbook",8:"app.suamarca.com.br/objecoes",9:"app.suamarca.com.br/materiais",10:"app.suamarca.com.br/ia-copiloto"};
const TICKER_ITEMS = ['🚀 Apenas 30 licenças no valor de lançamento · ','💰 12x de R$103 ou R$997 à vista · ','🤖 Agentes de IA + Voz + Omnichannel inclusos · ','✅ Código-fonte 100% seu, white label real · ','📈 Tenha sua plataforma, sua marca, sua recorrência · ','🛡️ Garantia de 7 dias ou seu dinheiro de volta · '];
const MODULES = [
  {icon:'🎯',name:'CRM & Pipeline Kanban',desc:'Drag-and-drop, filtros avançados, campos customizáveis, temperatura de leads e deal value em tempo real.',value:'≈ R$297/mês (Pipedrive)'},
  {icon:'💬',name:'Inbox Omnichannel',desc:'WhatsApp, Instagram, Facebook e WebChat em um único inbox com métricas e histórico completo.',value:'≈ R$499/mês (Trengo)'},
  {icon:'🤖',name:'Agentes de IA Autônomos',desc:'18 ferramentas de execução, 8 canais de atuação, troca dinâmica de agentes e auditoria de ações.',value:'≈ R$900/mês (custom dev)'},
  {icon:'🧠',name:'Cérebro do Produto (KB)',desc:'PDFs, sites, YouTube, FAQ e treinamento direto. Brain Health Score e respostas híbridas precisas.',value:'≈ R$400/mês'},
  {icon:'🚀',name:'Funis de Captação',desc:'30+ tipos de bloco, 4 formatos de publicação, A/B test, IA decide e rastreamento de UTMs.',value:'≈ R$297/mês (Landbot)'},
  {icon:'📋',name:'Formulários Inteligentes',desc:'16 tipos de bloco, score acumulativo, perguntas IA adaptativas e embed para sites externos.',value:'≈ R$197/mês (Typeform)'},
  {icon:'⚡',name:'Fluxos de Chat',desc:'Canvas visual, 8 tipos de bloco, IA takeover com variáveis e disparo por triggers customizados.',value:'≈ R$299/mês'},
  {icon:'🔗',name:'Webhooks & Automações',desc:'16 ações automatizadas, receptor com logs, mapeamento de payload e AI Agent outreach proativo.',value:'≈ R$99/mês (Zapier)'},
  {icon:'📅',name:'Booking System',desc:'Página pública de agendamento, integração Google Calendar OAuth, confirmação automática por e-mail.',value:'≈ R$197/mês (Calendly)'},
  {icon:'👥',name:'Gestão de Equipes',desc:'Squads, papéis, permissões granulares por recurso, metas e comissões por produto e vendedor.',value:'Nativo — sem similar'},
  {icon:'🎯',name:'Distribuição Inteligente',desc:'Round Robin, menor carga, status em tempo real e fila automática para leads sem atendente.',value:'Nativo — sem similar'},
  {icon:'📧',name:'Cadências de Outreach',desc:'Sequências multicanal por dias, e-mail, WhatsApp, ligação e nota — geração de conteúdo por IA.',value:'≈ R$399/mês (Outreach)'},
  {icon:'📖',name:'Playbook de Vendas',desc:'Pitch, ICP, pricing, diferenciais e contorno de objeções com IA — treinamento inline da equipe.',value:'Nativo — sem similar'},
  {icon:'🗂️',name:'DAM — Materiais',desc:'Gestão de PDFs, vídeos e apresentações por produto com envio direto pelo Inbox ou por agentes.',value:'≈ R$150/mês'},
  {icon:'🧑‍💼',name:'Copiloto de Vendas (IA)',desc:'Chat com IA treinada no produto, contexto do lead atual e sugestões de próximos passos em tempo real.',value:'≈ R$500/mês'},
  {icon:'📞',name:'Agentes de Voz',desc:'ElevenLabs + Twilio, voz conversacional, transcrição automática, qualificação BANT por ligação.',value:'≈ R$800/mês'},
  {icon:'📊',name:'Relatórios & Dashboard',desc:'Dashboard mobile premium, relatório diário por IA, insights automáticos e métricas por squad.',value:'≈ R$200/mês'},
  {icon:'💰',name:'Módulo Financeiro',desc:'Comissões, metas por vendedor, previsão de receita baseada no pipeline e painel individual.',value:'Nativo — sem similar'},
  {icon:'🏷️',name:'White Label Total',desc:'Logo, cores, favicon, PWA, e-mail branding, SEO/OG dinâmico e painel super admin de revendas.',value:'Zero hardcode garantido'},
  {icon:'🔐',name:'Segurança Enterprise',desc:'RLS por organização, RBAC, Security Definer Functions, Google OAuth e isolamento total de dados.',value:'Pronto para LGPD'},
];
const STACK_ITEMS = [
  {name:'CRM + Pipeline Kanban Visual',value:'R$297'},{name:'Inbox Omnichannel (WhatsApp, IG, FB, Chat)',value:'R$499'},
  {name:'Agentes de IA com 18 ferramentas de execução',value:'R$900'},{name:'Knowledge Base (Cérebro do Produto)',value:'R$400'},
  {name:'Funis de Captação (30+ blocos, 4 formatos)',value:'R$297'},{name:'Formulários Inteligentes com IA',value:'R$197'},
  {name:'Booking System + Google Calendar OAuth',value:'R$197'},{name:'Cadências de Outreach Multicanal',value:'R$399'},
  {name:'Agentes de Voz (ElevenLabs + Twilio)',value:'R$800'},{name:'Webhooks + 16 Ações de Automação',value:'R$99'},
  {name:'Distribuição Inteligente + Round Robin',value:'Nativo'},{name:'Playbook + Contorno de Objeções IA',value:'Nativo'},
  {name:'DAM — Materiais de Vendas',value:'R$150'},{name:'Copiloto de Vendas IA',value:'R$500'},
  {name:'Relatórios + Dashboard Mobile + IA Insights',value:'R$200'},{name:'40+ Edge Functions Serverless',value:'Incluso'},
  {name:'White Label 100% + Super Admin Panel',value:'Zero hardcode'},{name:'Código-Fonte React + TypeScript + Supabase',value:'Liberdade total'},
];
const FAQ_ITEMS = [
  {q:'Como funciona o pagamento?',a:`Você pode pagar em até 12x de ${PRICE_INSTALLMENT} no cartão de crédito (total ${PRICE_TOTAL_INSTALLMENT}) ou ${PRICE_CASH} à vista no PIX/boleto, ganhando 17% de desconto. O processamento é feito pela Doppus, com acesso liberado imediatamente após a confirmação.`},
  {q:'Preciso saber programar para usar e revender?',a:'Para usar a plataforma como negócio de revenda, não. O painel admin é visual e intuitivo. Para customizações além das configurações de white label — como adicionar features novas ou integrar sistemas específicos — o código está aberto e hoje você faz isso com IA (Claude, Cursor, Lovable) sem ser dev.'},
  {q:'Posso cobrar qualquer valor dos meus clientes?',a:'Sim, 100%. Você compra o código-fonte e a plataforma passa a ser sua. Você define o pricing, os planos, os limites de uso — tudo. Não existe royalty, não existe porcentagem nossa em cima da sua receita.'},
  {q:'Quantos clientes posso ter na plataforma?',a:'Sem limite da nossa parte. A plataforma escala de acordo com sua infraestrutura. Com o plano Pro do backend (~R$125/mês) você suporta confortavelmente dezenas de organizações em modo multi-tenant nativo.'},
  {q:'O WhatsApp funciona de verdade?',a:'Funciona via integração com Evolution API.'},
  {q:'E se eu precisar de uma feature que não tem?',a:'O código é aberto exatamente para isso. Como o sistema foi feito com IA, você mesmo consegue editar com tranquilidade.'},
  {q:'Qual o custo mensal para manter no ar?',a:'Lovable + VPS de R$89/mês — em média ~R$200/mês de infra total, atendendo de 10 a 30 clientes (depende do porte). A VPS suporta até 100 clientes.'},
  {q:'Em quanto tempo consigo colocar no ar?',a:'Quem segue a documentação de setup coloca no ar entre 1 e 4 dias. Clientes com experiência técnica mínima costumam terminar em 24–48 horas.'},
  {q:'A garantia é de verdade? Como funciona?',a:'Sim, garantia de 7 dias no curso/acesso. Importante: ao assinar o termo e baixar o código-fonte, você abre mão da garantia (é um ativo digital irrevogável). Se quiser avaliar antes, é só assistir as aulas primeiro, sem assinar o termo, e decidir se vai permanecer.'},
];
const MODULE_SCREENSHOTS = [
  {icon:'📊',name:'Dashboard & Visão Geral',badge:'AO VIVO',caption:'KPIs, funil de vendas, agendamentos e atividades em tempo real',img:'/screenshots/visao-geral.webp'},
  {icon:'🎯',name:'Pipeline Kanban',badge:'AO VIVO',caption:'Drag-and-drop, filtros avançados e deal value em cada card',img:'/screenshots/pipeline.webp'},
  {icon:'💬',name:'Inbox Omnichannel',badge:'AO VIVO',caption:'WhatsApp, Instagram e WebChat em um único inbox unificado',img:'/screenshots/conversas.webp'},
  {icon:'✅',name:'Central de Tarefas',badge:'AO VIVO',caption:'Tarefas automáticas, cadência e prioridades com deadline',img:'/screenshots/tarefas.webp'},
  {icon:'📅',name:'Agendamentos',badge:'AO VIVO',caption:'Google Calendar integrado, tipos de evento e disponibilidade',img:'/screenshots/agendamentos.webp'},
  {icon:'💰',name:'Financeiro',badge:'AO VIVO',caption:'Comissões, metas, potencial do funil e pipeline financeiro',img:'/screenshots/financeiro.webp'},
  {icon:'📧',name:'Cadência de Vendas',badge:'AO VIVO',caption:'Roteiro dia a dia com mensagens, áudios e materiais',img:'/screenshots/cadencia.webp'},
  {icon:'📖',name:'Playbook Comercial',badge:'AO VIVO',caption:'Pitches, ICP, pricing e diferenciais para a equipe',img:'/screenshots/playbook.webp'},
  {icon:'🛡️',name:'Objeções com IA',badge:'AO VIVO',caption:'Central de objeções com assistente IA especialista',img:'/screenshots/objecoes.webp'},
  {icon:'🤖',name:'IA Copiloto',badge:'AO VIVO',caption:'Chat com IA treinada no produto para suporte ao vendedor',img:'/screenshots/ia-copiloto.webp'},
];
const COMPARE_BAD = ['Pagar R$2.000–5.000/mês em ferramentas separadas','Dados espalhados em 5+ plataformas diferentes','Integrações que quebram toda semana','Zero controle sobre preço, features ou marca','Margem comprimida e dependência total','Cada feature nova = mais um SaaS para assinar'];
const COMPARE_GOOD = ['Pagar uma vez e ser dono do código para sempre','Tudo integrado nativamente — zero gambiarras','Sua marca, seu preço, sua margem de 90%+','Código aberto para customizar com IA ou devs','Escalar de 1 a 200+ clientes sem restrição','Cada feature nova aumenta o valor do SEU produto'];
const INCLUDES = [
  {ck:'✅',text:'Código-fonte completo (React 18 + TypeScript)'},{ck:'✅',text:'Backend Supabase (PostgreSQL + Edge Functions)'},
  {ck:'✅',text:'28 módulos funcionais e integrados'},{ck:'✅',text:'40+ Edge Functions serverless prontas'},
  {ck:'✅',text:'Painel Super Admin White Label'},{ck:'✅',text:'Documentação de setup completa'},
  {ck:'✅',text:'Integrações nativas (WhatsApp, ElevenLabs, Twilio, Resend, Sankhya)'},{ck:'✅',text:'PWA mobile com manifest dinâmico'},
  {ck:'✅',text:'RLS, RBAC e segurança enterprise'},{ck:'✅',text:'Atualizações por 12 meses'},
  {ck:'✅',text:'Suporte de onboarding'},{ck:'🎁',text:'Bônus: Templates de funis prontos'},
  {ck:'🎁',text:'Bônus: Scripts de vendas para revenda'},
];

function fmt(n: number) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }
function pad(n: number) { return n.toString().padStart(2, '0'); }

function PricingDual() {
  return (
    <>
      <div className="wl-pricing-dual">
        <div className="wl-price-option featured">
          <div className="wl-price-badge-top">MAIS ESCOLHIDO</div>
          <div className="wl-price-tag">{PRICE_TIMES}x</div>
          <div className="wl-price-amount">
            <span className="currency">R$</span>103<span className="cents">,00</span>
          </div>
          <div className="wl-price-method">no cartão de crédito</div>
          <div className="wl-price-foot">💳 Total: {PRICE_TOTAL_INSTALLMENT},00</div>
        </div>
        <div className="wl-price-option">
          <div className="wl-price-tag">À VISTA</div>
          <div className="wl-price-amount">
            <span className="currency">R$</span>997<span className="cents">,00</span>
          </div>
          <div className="wl-price-method">no PIX ou boleto</div>
          <div className="wl-price-discount">17% DE DESCONTO</div>
        </div>
      </div>
      <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="wl-cta-pulse">
        🔒 QUERO GARANTIR MINHA LICENÇA AGORA
      </a>
      <div className="wl-scarcity">
        ⏰ <strong>ATENÇÃO:</strong> Apenas 30 licenças disponíveis no valor de lançamento.
      </div>
      <div style={{textAlign:'center',fontSize:'0.78rem',color:'var(--wl-text2)',fontWeight:700,letterSpacing:1,marginTop:18,marginBottom:8}}>FORMAS DE PAGAMENTO ACEITAS</div>
      <div className="wl-payment-methods">
        <span className="wl-pm-pill">VISA</span>
        <span className="wl-pm-pill">MASTER</span>
        <span className="wl-pm-pill">AMEX</span>
        <span className="wl-pm-pill">ELO</span>
        <span className="wl-pm-pill dark">BOLETO</span>
        <span className="wl-pm-pill dark">PIX</span>
      </div>
      <div className="wl-trust-row">
        <div>🛡️<strong>Compra Segura</strong>Seus dados protegidos</div>
        <div>✅<strong>Acesso Imediato</strong>Comece a usar hoje</div>
        <div>🎧<strong>Suporte Especializado</strong>Equipe à disposição</div>
      </div>
    </>
  );
}

export default function WhiteLabelPage() {
  const [timer, setTimer] = useState({ h: 23, m: 59, s: 47 });
  const endRef = useRef<Date | null>(null);
  useEffect(() => {
    const end = new Date(); end.setHours(end.getHours() + 23, end.getMinutes() + 47); endRef.current = end;
    const interval = setInterval(() => {
      const diff = (endRef.current?.getTime() || 0) - Date.now();
      if (diff <= 0) { setTimer({ h: 0, m: 0, s: 0 }); return; }
      setTimer({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.title = 'Scale White Label · Sua plataforma de vendas com Agentes de IA';
  }, []);

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => setProgress((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    window.addEventListener('scroll', onScroll); return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [currentSlide, setCurrentSlide] = useState(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goToSlide = useCallback((idx: number) => {
    setCurrentSlide(idx);
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayRef.current = setInterval(() => setCurrentSlide(prev => (prev + 1) % SLIDE_LABELS.length), 4000);
  }, []);
  useEffect(() => {
    autoplayRef.current = setInterval(() => setCurrentSlide(prev => (prev + 1) % SLIDE_LABELS.length), 4000);
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, []);

  const [clientes, setClientes] = useState(20);
  const [ticket, setTicket] = useState(497);
  const [infraVal, setInfraVal] = useState(25);
  const [churn, setChurn] = useState(3);
  const bruta = clientes * ticket;
  const custoInfra = clientes * infraVal;
  const liquida = bruta - custoInfra;
  const margem = bruta > 0 ? Math.round((liquida / bruta) * 100) : 0;
  const anual = liquida * 12;
  const paybackMeses = liquida > 0 ? Math.max(1, Math.ceil(9970 / liquida)) : 99;

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { setStatsVisible(true); obs.disconnect(); } }, { threshold: 0.5 });
    obs.observe(statsRef.current); return () => obs.disconnect();
  }, []);
  const STAT_TARGETS = [28, 40, 100, 30];
  const [countVals, setCountVals] = useState([0, 0, 0, 0]);
  useEffect(() => {
    if (!statsVisible) return;
    const steps = 1200 / 16; let frame = 0;
    const interval = setInterval(() => {
      frame++; const pct = Math.min(frame / steps, 1);
      setCountVals(STAT_TARGETS.map(t => Math.floor(t * pct)));
      if (frame >= steps) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [statsVisible]);

  useEffect(() => {
    if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
      const link = document.createElement('link'); link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'; link.rel = 'stylesheet'; document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="wl-page">
      <div className="wl-progress-bar" style={{ width: `${progress}%` }} />
      <div className="wl-ticker"><div className="wl-ticker-inner">{[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => <span key={i} className="wl-ticker-item">{item}</span>)}</div></div>
      <div className="wl-timer-bar">
        <span className="wl-timer-label">⚡ Oferta de lançamento encerra em:</span>
        <div className="wl-timer-boxes">
          <div className="wl-timer-box">{pad(timer.h)}</div><span className="wl-timer-sep">:</span>
          <div className="wl-timer-box">{pad(timer.m)}</div><span className="wl-timer-sep">:</span>
          <div className="wl-timer-box">{pad(timer.s)}</div>
        </div>
        <span className="wl-timer-warn">— Quando zerar, o preço sobe</span>
      </div>
      <nav className="wl-nav"><div className="wl-nav-inner">
        <a href="#" className="wl-nav-brand">
          <img src={vendusLogo} alt="Scale" className="wl-vendus-logo" style={{height:32}} />
          
        </a>
        <ul className="wl-nav-links"><li><a href="#modulos">Módulos</a></li><li><a href="#calculadora">Calculadora</a></li><li><a href="#oferta">Oferta</a></li><li><a href="#faq">FAQ</a></li></ul>
        <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="wl-nav-cta">Quero minha licença →</a>
      </div></nav>

      <section className="wl-hero" id="home">
        <div className="wl-grid-bg" /><div className="wl-hero-glow" /><div className="wl-hero-glow2" />
        <img src={vendusLogo} alt="Scale White Label" style={{height:64,marginBottom:24,filter:'drop-shadow(0 0 30px rgba(0,255,102,0.4))'}} />
        <div className="wl-hero-badge">🔥 Lançamento Scale White Label</div>
        <h1>Sua plataforma de vendas<br /><span className="hl">com Agentes de IA</span><span className="line2">— sua marca, seus clientes, sua recorrência</span></h1>
        <p className="wl-hero-sub">Tenha um SaaS completo de CRM, IA, omnichannel e automação com 28 módulos prontos. Código-fonte React + Supabase 100% seu, white label real, pronto para vender amanhã.</p>

        {/* === SLOT DO VÍDEO — cole aqui o HTML/embed do vídeo === */}
        <div className="wl-hero-video">
          <iframe
            src="https://player.vimeo.com/video/1187458523?badge=0&autopause=0&player_id=0&app_id=58479"
            frameBorder={0}
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
            allowFullScreen
            title="Scale White Label"
            style={{ width: '100%', height: '100%', border: 0, borderRadius: 'inherit' }}
          />
        </div>
        {/* === /SLOT DO VÍDEO === */}

        <div className="wl-hero-pills">{['Agentes de IA','Pipeline Inteligente','WhatsApp Integrado','Multi-Tenant','White Label 100%','Código-Fonte Seu'].map(p => <div key={p} className="wl-pill"><span className="dot" />{p}</div>)}</div>
        <div className="wl-hero-cta-group">
          <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="wl-btn-primary">👉 Quero Garantir Minha Licença</a>
          <div className="wl-btn-reassure"><span>🛡️ Garantia 7 dias</span><span>⚡ Acesso imediato</span><span>🏷️ 12x R$103 ou R$997 à vista</span></div>
        </div>
        <div className="wl-hero-mockup"><div className="wl-sc-carousel">
          <div className="wl-sc-browser-bar"><div className="wl-dot-r" /><div className="wl-dot-y" /><div className="wl-dot-g" /><div className="wl-sc-url-bar">{SC_URLS[currentSlide]}</div><div className="wl-sc-live-badge">● AO VIVO</div></div>
          <div className="wl-sc-tabs">{SLIDE_LABELS.map((label, i) => <button key={i} className={`wl-sc-tab ${i === currentSlide ? 'active' : ''}`} onClick={() => goToSlide(i)}>{label}</button>)}</div>
          <div className="wl-sc-viewport">
            <div className="wl-sc-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>{SLIDE_LABELS.map((label, i) => <div key={i} className="wl-sc-slide">{SLIDE_IMAGES[i] ? <img src={SLIDE_IMAGES[i]} alt={label} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top left'}} /> : <div className="wl-sc-slide-placeholder"><span className="ico">{SLIDE_ICONS[i]}</span><span className="lbl">{label}</span></div>}</div>)}</div>
            <button className="wl-sc-arrow wl-sc-prev" onClick={() => goToSlide((currentSlide - 1 + SLIDE_LABELS.length) % SLIDE_LABELS.length)}>‹</button>
            <button className="wl-sc-arrow wl-sc-next" onClick={() => goToSlide((currentSlide + 1) % SLIDE_LABELS.length)}>›</button>
          </div>
          <div className="wl-sc-dots">{SLIDE_LABELS.map((_, i) => <div key={i} className={`wl-sc-dot ${i === currentSlide ? 'active' : ''}`} onClick={() => goToSlide(i)} />)}</div>
        </div></div>
      </section>

      <div className="wl-stats-bar" ref={statsRef}><div className="wl-stats-bar-inner">
        {[{val:countVals[0],suffix:'',label:'Módulos Incluídos'},{val:countVals[1],suffix:'+',label:'Edge Functions Serverless'},{val:`R$${countVals[2]}k`,suffix:'',label:'Potencial Mensal (k/mês)'},{val:`${countVals[3]}`,suffix:'',label:'Licenças no lançamento'}].map((s, i) => (
          <div key={i} className="wl-stat-item"><span className="wl-stat-num">{typeof s.val === 'number' ? `${s.val}${s.suffix}` : s.val}</span><div className="wl-stat-label">{s.label}</div></div>
        ))}
      </div></div>

      <section className="wl-dor-section"><div className="wl-container">
        <div className="wl-section-badge">O Problema</div>
        <h2 className="wl-section-title">Você quer um SaaS lucrativo.<br />Mas os caminhos normais são armadilhas.</h2>
        <p className="wl-section-sub">Antes de te mostrar a solução, precisa ver por que a maioria das pessoas nunca chega lá.</p>
        <div className="wl-pain-grid">
          {[{ico:'🏗️',title:'Desenvolver do zero',desc:'Um desenvolvedor sênior custa R$12–18k/mês. 12 meses de trabalho. R$150k–300k investidos.',cost:'💸 Custo real: R$150k–300k + 12 meses'},
            {ico:'🔗',title:'Revender SaaS de terceiro',desc:'Sua marca não existe — é a marca deles. Você não controla preço, features nem suporte.',cost:'⚠️ Risco: perder tudo do dia pra noite'},
            {ico:'🎰',title:'Montar com freelancers',desc:'Orçamentos que não param de crescer. Entregas atrasadas. Código que ninguém entende depois.',cost:'😩 Resultado: estresse infinito sem previsibilidade'}
          ].map((p, i) => <div key={i} className="wl-pain-card"><div className="wl-pain-ico">{p.ico}</div><h3>{p.title}</h3><p>{p.desc}</p><div className="wl-pain-cost">{p.cost}</div></div>)}
        </div>
      </div></section>

      <section className="wl-alt-section"><div className="wl-container">
        <div className="wl-section-badge">Por Que o Resto Não Funciona</div>
        <h2 className="wl-section-title">As ferramentas separadas custam uma fortuna.<br />E ainda não integram entre si.</h2>
        <div className="wl-alt-grid">
          {[{title:'Pipedrive + Kommo + Calendly',desc:'CRM separado, inbox separado, agendamento separado. Cada integração quebra uma vez por mês.',cost:'💸 R$994–R$2.800/mês por cliente'},
            {title:'Ferramentas de automação + no-code',desc:'Zapier + Make + Typeform + Landbot. Cada automação tem um custo. Limite de tasks que estoura.',cost:'💸 R$600–R$1.500/mês e crescendo'},
            {title:'Contratar IA por fora',desc:'ChatGPT + APIs de voz + integração manual. Sem contexto do CRM, sem rastreabilidade.',cost:'💸 R$800–R$2.000/mês + dev para integrar'}
          ].map((a, i) => <div key={i} className="wl-alt-card"><div className="wl-x-mark">❌</div><h3>{a.title}</h3><p>{a.desc}</p><div className="wl-alt-cost">{a.cost}</div></div>)}
        </div>
        <div className="wl-solution-bridge"><h2>Existe um terceiro caminho — e ele é absurdamente mais inteligente.</h2><p>O Scale White Label: uma plataforma completa, com código liberado, white label total e pronta para faturar hoje.</p></div>
      </div></section>

      <section className="wl-modules-section" id="modulos"><div className="wl-container">
        <div className="wl-section-badge">28 Módulos Completos</div>
        <h2 className="wl-section-title">Tudo que um negócio de vendas precisa.<br />Em uma plataforma. Com seu nome.</h2>
        <p className="wl-section-sub">Cada módulo é produção-ready, battle-tested e integrado nativamente com os outros.</p>
        <div className="wl-modules-grid">{MODULES.map((m, i) => <div key={i} className="wl-module-card"><div className="wl-mod-glow" /><div className="wl-mod-icon">{m.icon}</div><div className="wl-mod-name">{m.name}</div><div className="wl-mod-desc">{m.desc}</div><div className="wl-mod-value">{m.value}</div></div>)}</div>
      </div></section>

      <section className="wl-calc-section" id="calculadora"><div className="wl-container">
        <div className="wl-section-badge">Calculadora de Resultado</div>
        <h2 className="wl-section-title" style={{marginBottom:60}}>Quanto você vai faturar?<br />Você escolhe o cenário.</h2>
        <div className="wl-calc-wrapper"><div className="wl-calc-grid">
          <div className="wl-calc-left">
            <h2>Simule sua receita mensal recorrente</h2>
            <p>Ajuste os sliders com o seu cenário e veja o faturamento em tempo real.</p>
            <div className="wl-slider-group"><div className="wl-slider-label"><span>Número de clientes ativos</span><strong>{clientes} clientes</strong></div><input type="range" min={1} max={200} value={clientes} onChange={e => setClientes(+e.target.value)} /></div>
            <div className="wl-slider-group"><div className="wl-slider-label"><span>Ticket médio por cliente</span><strong>R$ {ticket.toLocaleString('pt-BR')}/mês</strong></div><input type="range" min={297} max={2500} step={50} value={ticket} onChange={e => setTicket(+e.target.value)} /></div>
            <div className="wl-slider-group"><div className="wl-slider-label"><span>Custo de infra estimado</span><strong>R$ {infraVal}/cliente</strong></div><input type="range" min={10} max={80} step={5} value={infraVal} onChange={e => setInfraVal(+e.target.value)} /></div>
            <div className="wl-slider-group"><div className="wl-slider-label"><span>Taxa de churn mensal</span><strong>{churn}%</strong></div><input type="range" min={1} max={15} value={churn} onChange={e => setChurn(+e.target.value)} /></div>
          </div>
          <div><div className="wl-result-card">
            <div className="wl-result-label">Receita Bruta Mensal</div>
            <div className="wl-result-value">{fmt(bruta)}</div>
            <div className="wl-result-sub">recorrente todo mês</div>
            <div className="wl-result-breakdown">
              <div className="wl-rb-item"><span className="wl-rb-label">Receita bruta</span><span className="wl-rb-value green">{fmt(bruta)}</span></div>
              <div className="wl-rb-item"><span className="wl-rb-label">Custo de infra</span><span className="wl-rb-value warn">- {fmt(custoInfra)}</span></div>
              <div className="wl-rb-item"><span className="wl-rb-label">Margem líquida</span><span className="wl-rb-value green">{fmt(liquida)}</span></div>
              <div className="wl-rb-item"><span className="wl-rb-label">Margem %</span><span className="wl-rb-value green">{margem}%</span></div>
              <div className="wl-rb-item"><span className="wl-rb-label">Receita anual</span><span className="wl-rb-value green">{fmt(anual)}</span></div>
            </div>
            <div className="wl-payback-badge">⚡ Payback do Scale em {paybackMeses <= 1 ? '1 mês' : `${paybackMeses} meses`}</div>
            <a href="#oferta" className="wl-btn-primary" style={{fontSize:'0.95rem',padding:'14px 28px',width:'100%'}}>Quero esse faturamento →</a>
          </div></div>
        </div></div>
      </div></section>

      <section className="wl-proof-section"><div className="wl-container">
        <div className="wl-section-badge">Resultados Reais</div>
        <h2 className="wl-section-title">Quem já foi, está faturando.</h2>
        <p className="wl-section-sub">Resultados reais de quem colocou a plataforma no ar e foi vender.</p>
        <div className="wl-testimonials-grid">
          {[{text:'"Coloquei no ar em 4 dias. Na primeira semana fechei 3 clientes no plano de R$697."',result:'💰 R$ 2.091/mês em MRR na primeira semana',initials:'RF',name:'Rafael F.',role:'Agência de Marketing · São Paulo',bg:'rgba(0,255,102,0.2)',color:'#00FF66'},
            {text:'"Meus clientes já pagavam por ferramentas separadas. Agora pago R$25/mês de infra e cobro R$997/mês. 22 clientes ativos."',result:'📈 R$ 21.934/mês com 22 clientes',initials:'CM',name:'Carla M.',role:'Consultora Comercial · Belo Horizonte',bg:'rgba(255,184,0,0.2)',color:'#FFB800'},
            {text:'"Tentei construir algo parecido por 8 meses com dev. Gastei R$90k e não entreguei metade. Comprei o Scale, customizei com IA em 2 semanas e lancei."',result:'🏆 Economizou R$90k e 6 meses',initials:'PT',name:'Pedro T.',role:'Tech Founder · Curitiba',bg:'rgba(99,145,255,0.2)',color:'#6391FF'}
          ].map((t, i) => <div key={i} className="wl-testi-card"><div className="wl-testi-stars">★★★★★</div><p className="wl-testi-text">{t.text}</p><div className="wl-testi-result">{t.result}</div><div className="wl-testi-author"><div className="wl-testi-avatar" style={{background:t.bg,color:t.color}}>{t.initials}</div><div><div className="wl-testi-name">{t.name}</div><div className="wl-testi-role">{t.role}</div></div></div></div>)}
        </div>
      </div></section>

      <section className="wl-module-screenshot-section" style={{padding:'100px 24px'}}><div className="wl-container">
        <div className="wl-section-badge">Veja Por Dentro</div>
        <h2 className="wl-section-title">Cada tela é uma arma de vendas.<br />Tudo rodando de verdade.</h2>
        <p className="wl-section-sub">Screenshots reais da plataforma em produção.</p>
        <div className="wl-module-showcase">{MODULE_SCREENSHOTS.map((ms, i) => <div key={i} className="wl-ms-card"><div className="wl-ms-card-header"><span className="wl-ms-card-icon">{ms.icon}</span><span className="wl-ms-card-name">{ms.name}</span><span className="wl-ms-card-badge">{ms.badge}</span></div><div className="wl-ms-img-wrap">{ms.img ? <img src={ms.img} alt={ms.name} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top left',borderRadius:8}} /> : <div className="wl-ms-img-placeholder"><span>{ms.icon}</span></div>}<div className="wl-ms-overlay" /><div className="wl-ms-caption">{ms.caption}</div></div></div>)}</div>
      </div></section>

      <section className="wl-compare-section"><div className="wl-container">
        <div className="wl-section-badge">Comparação</div>
        <h2 className="wl-section-title" style={{marginBottom:60}}>Dois caminhos. Um resultado completamente diferente.</h2>
        <div className="wl-compare-grid">
          <div className="wl-compare-card bad"><div className="wl-compare-header"><h3>❌ Sem o Scale</h3></div><div className="wl-compare-body">{COMPARE_BAD.map((item, i) => <div key={i} className="wl-compare-item"><span className="wl-ci-icon">✕</span><span className="wl-ci-text">{item}</span></div>)}</div></div>
          <div className="wl-compare-card good"><div className="wl-compare-header"><h3>✅ Com o Scale</h3></div><div className="wl-compare-body">{COMPARE_GOOD.map((item, i) => <div key={i} className="wl-compare-item"><span className="wl-ci-icon">✓</span><span className="wl-ci-text">{item}</span></div>)}</div></div>
        </div>
      </div></section>

      <section className="wl-stack-section" id="oferta"><div className="wl-container">
        <div className="wl-section-badge">Valor Total</div>
        <h2 className="wl-section-title">Tudo isso em uma única compra.</h2>
        <p className="wl-section-sub">Some o valor de mercado de cada módulo e você vai entender por que o preço desta oferta é absurdo.</p>
        <div className="wl-stack-grid">{STACK_ITEMS.map((item, i) => <div key={i} className="wl-stack-item"><div className="wl-si-check">✓</div><div className="wl-si-name">{item.name}</div><div className="wl-si-value">{item.value.startsWith('R$') ? <><del>{item.value}</del>/mês</> : item.value}</div></div>)}</div>
        <div className="wl-stack-total">
          <div className="wl-total-label">Valor de mercado das ferramentas equivalentes</div>
          <div className="wl-total-old">R$ 5.935/mês — todo mês, para sempre</div>
          <div className="wl-total-new">Uma única licença.</div>
          <div className="wl-total-sub">Você paga uma vez e o código é seu para sempre.</div>
          <a href="#preco" className="wl-btn-primary" style={{fontSize:'1rem',padding:'16px 36px'}}>Ver a oferta completa →</a>
        </div>
      </div></section>

      <section className="wl-offer-section" id="preco"><div className="wl-container"><div className="wl-offer-wrapper">
        <div className="wl-offer-top">
          <div className="wl-hero-badge" style={{margin:'0 auto 16px'}}>🔥 Oferta de Lançamento Scale</div>
          <h2>Scale White Label<br />Plataforma SaaS All-in-One com Código Liberado</h2>
          <p>Pague uma vez. Use para sempre. Fature recorrente todo mês.</p>
        </div>
        <div className="wl-offer-body">
          <div className="wl-offer-includes"><h3>O que está incluso</h3>{INCLUDES.map((item, i) => <div key={i} className="wl-include-item"><span className="ck">{item.ck}</span>{item.text}</div>)}</div>
          <div className="wl-offer-price-box">
            <div style={{textAlign:'center',marginBottom:8}}>
              <div className="wl-price-from">🔒 COMPRA 100% SEGURA</div>
              <div style={{fontSize:'0.78rem',color:'var(--wl-text2)',marginTop:4}}>Ambiente protegido e criptografado</div>
            </div>
            <div className="wl-price-old" style={{textAlign:'center',marginBottom:0}}>De R$ 24.900</div>
            <div style={{textAlign:'center',fontSize:'0.85rem',color:'var(--wl-text2)',marginBottom:14,fontWeight:700,letterSpacing:0.5}}>ESCOLHA SUA FORMA DE PAGAMENTO</div>
            <PricingDual />
            <div className="wl-guarantee-box" style={{marginTop:18}}>
              <h4>🛡️ Garantia de 7 Dias (curso)</h4>
              <p>Você tem 7 dias para avaliar assistindo às aulas. Ao assinar o termo e baixar o código-fonte, você abre mão da garantia — por se tratar de um ativo digital irrevogável. Quer testar antes? Assista as aulas primeiro, sem assinar o termo.</p>
            </div>
          </div>
        </div>
      </div></div></section>

      <section className="wl-final-section">
        <div className="wl-final-glow" />
        <div className="wl-container" style={{position:'relative'}}>
          <h2>O custo de não agir<br />é mais caro que investir.</h2>
          <p>Cada mês parado é MRR que você não está recebendo.</p>
          <div className="wl-final-cost-table">
            <div className="wl-fct-item"><h4>Construir do zero</h4><div className="val red">R$300k</div><div style={{fontSize:'0.75rem',color:'var(--wl-text3)',marginTop:4}}>+ 12–18 meses</div></div>
            <div className="wl-fct-item" style={{border:'1px solid var(--wl-accent)'}}><h4>Scale White Label</h4><div className="val green">{PRICE_FROM}</div><div style={{fontSize:'0.75rem',color:'var(--wl-accent)',marginTop:4}}>12x R$103 ou R$997 à vista</div></div>
            <div className="wl-fct-item"><h4>Sua economia</h4><div className="val gold">R$290k</div><div style={{fontSize:'0.75rem',color:'var(--wl-text3)',marginTop:4}}>+ 1 ano de vantagem</div></div>
          </div>
          <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="wl-btn-primary" style={{fontSize:'1.1rem',padding:'20px 48px'}}>🚀 Quero Minha Licença — 12x R$103</a>
          <div style={{marginTop:16,fontSize:'0.82rem',color:'var(--wl-text3)',position:'relative'}}>🛡️ Garantia 7 dias · ⚡ Acesso imediato · 🏷️ Pague uma vez, seu para sempre</div>
        </div>
      </section>

      <section className="wl-faq-section" id="faq"><div className="wl-container">
        <div className="wl-section-badge">Perguntas Frequentes</div>
        <h2 className="wl-section-title" style={{marginBottom:50}}>Respondendo antes que você pergunte.</h2>
        <div className="wl-faq-list">{FAQ_ITEMS.map((faq, i) => <div key={i} className={`wl-faq-item ${openFaq === i ? 'open' : ''}`}><button className="wl-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{faq.q}<span className="wl-faq-arrow">▼</span></button><div className="wl-faq-a">{faq.a}</div></div>)}</div>
      </div></section>

      <footer className="wl-footer"><p>© 2026 Scale · Todos os direitos reservados · Produto digital — entrega imediata após confirmação do pagamento</p></footer>
    </div>
  );
}
