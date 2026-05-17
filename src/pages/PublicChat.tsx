import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { useFunnelBySlug } from '@/hooks/useFunnels';
import { supabase } from '@/integrations/supabase/client';
import { FunnelBlock, VARIABLE_TO_LEAD_FIELD } from '@/types/funnel';

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  block?: FunnelBlock;
  options?: { id: string; label: string; emoji?: string }[];
}

export default function PublicChat() {
  const { slug } = useParams<{ slug: string }>();
  const { data: funnel, isLoading, error } = useFunnelBySlug(slug, 'chat');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const responsesRef = useRef<Record<string, string>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // Get ordered blocks with robust fallback logic
  const getOrderedBlocks = (): FunnelBlock[] => {
    if (!funnel?.flow_blocks || funnel.flow_blocks.length === 0) return [];
    
    const blocks = funnel.flow_blocks;
    
    // Step 1: Try to find block by start_block_id
    let startBlock = blocks.find(b => b.id === funnel.start_block_id);
    
    // Step 2: Fallback - find "orphan" block (not targeted by any connection)
    if (!startBlock) {
      const targetedIds = new Set(
        blocks.flatMap(b => [
          b.next_block_id,
          b.data.true_next_block_id,
          b.data.false_next_block_id,
          ...(b.data.options?.map(o => o.next_block_id) || []),
          ...(b.data.ai_outputs?.map(o => o.next_block_id) || []),
        ].filter(Boolean))
      );
      startBlock = blocks.find(b => !targetedIds.has(b.id));
    }
    
    // Step 3: Last fallback - sort by position (top-left first)
    if (!startBlock) {
      const sorted = [...blocks].sort((a, b) => 
        a.position.y - b.position.y || a.position.x - b.position.x
      );
      startBlock = sorted[0];
    }
    
    if (!startBlock) return [];
    
    // Traverse with infinite loop protection
    const ordered: FunnelBlock[] = [];
    const visited = new Set<string>();
    let current: FunnelBlock | undefined = startBlock;
    const maxIterations = blocks.length + 10;
    let iterations = 0;

    while (current && !visited.has(current.id) && iterations < maxIterations) {
      ordered.push(current);
      visited.add(current.id);
      iterations++;
      
      if (current.next_block_id) {
        current = blocks.find(b => b.id === current!.next_block_id);
      } else {
        break;
      }
    }

    return ordered;
  };

  const orderedBlocks = getOrderedBlocks();

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track views
  useEffect(() => {
    if (funnel?.id) {
      supabase.rpc('increment_funnel_views', { p_funnel_id: funnel.id, p_channel: 'chat' });
    }
  }, [funnel?.id]);

  // Process next block
  const processBlock = async (block: FunnelBlock) => {
    setIsTyping(true);
    
    await new Promise(resolve => setTimeout(resolve, block.data.delay_ms || 500));
    
    setIsTyping(false);

    if (block.type === 'message') {
      setMessages(prev => [...prev, {
        id: block.id,
        type: 'bot',
        content: block.data.content || '',
        block,
      }]);
      
      // Auto-advance to next block
      const nextIndex = orderedBlocks.findIndex(b => b.id === block.id) + 1;
      if (nextIndex < orderedBlocks.length) {
        setTimeout(() => processBlock(orderedBlocks[nextIndex]), 300);
      }
    } else if (block.type === 'input') {
      setMessages(prev => [...prev, {
        id: block.id,
        type: 'bot',
        content: block.data.content || block.data.placeholder || 'Digite sua resposta',
        block,
      }]);
      
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (block.type === 'buttons') {
      setMessages(prev => [...prev, {
        id: block.id,
        type: 'bot',
        content: block.data.content || 'Escolha uma opção:',
        block,
        options: block.data.options,
      }]);
    } else if (block.type === 'end') {
      setMessages(prev => [...prev, {
        id: block.id,
        type: 'bot',
        content: block.data.success_message || 'Obrigado!',
        block,
      }]);
      setIsComplete(true);
      
      // Submit lead
      await submitLead();
      
      // Redirect if configured
      if (block.data.redirect_url) {
        setTimeout(() => {
          window.location.href = block.data.redirect_url!;
        }, 2000);
      }
    } else if (block.type === 'delay') {
      await new Promise(resolve => setTimeout(resolve, block.data.delay_ms || 1000));
      
      const nextIndex = orderedBlocks.findIndex(b => b.id === block.id) + 1;
      if (nextIndex < orderedBlocks.length) {
        processBlock(orderedBlocks[nextIndex]);
      }
    } else if (block.type === 'webhook') {
      // Fire webhook silently then advance
      const cfg = block.data.webhook_config;
      const isOnBlock = !cfg?.trigger || cfg.trigger === 'on_block';
      if (cfg?.url && isOnBlock && funnel?.id) {
        try {
          const collectedData: Record<string, string> = {};
          for (const [key, value] of Object.entries(responsesRef.current)) {
            const lf = VARIABLE_TO_LEAD_FIELD[key.toLowerCase()] || key;
            collectedData[lf] = value;
          }
          const urlParams = new URLSearchParams(window.location.search);
          const tracking = {
            utm_source: urlParams.get('utm_source') || undefined,
            utm_campaign: urlParams.get('utm_campaign') || undefined,
            referrer_url: document.referrer || undefined,
            landing_page: window.location.href,
          };
          const promise = supabase.functions.invoke('funnel-execute-webhook', {
            body: {
              funnel_id: funnel.id,
              block_id: block.id,
              collected_data: collectedData,
              responses: responsesRef.current,
              tracking,
              trigger_source: 'on_block',
            },
          });
          if (cfg.wait_for_response) {
            const { error } = await promise;
            if (error) throw error;
          } else {
            promise.then(({ error }) => {
              if (error) console.error('[chat] webhook error:', error);
            });
          }
        } catch (err) {
          console.error('[chat] webhook error:', err);
        }
      }
      const nextIndex = orderedBlocks.findIndex(b => b.id === block.id) + 1;
      if (nextIndex < orderedBlocks.length) {
        processBlock(orderedBlocks[nextIndex]);
      }
    } else {
      // For other block types, just advance
      const nextIndex = orderedBlocks.findIndex(b => b.id === block.id) + 1;
      if (nextIndex < orderedBlocks.length) {
        processBlock(orderedBlocks[nextIndex]);
      }
    }
  };

  // Start conversation
  useEffect(() => {
    if (funnel && orderedBlocks.length > 0 && messages.length === 0) {
      processBlock(orderedBlocks[0]);
    }
  }, [funnel]);

  const handleSubmitInput = async () => {
    if (!inputValue.trim()) return;
    
    const currentBlock = messages[messages.length - 1]?.block;
    if (!currentBlock || currentBlock.type !== 'input') return;

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue,
    }]);

    // Store response
    const variableName = currentBlock.data.variable_name || currentBlock.id;
    const nextResponses = { ...responsesRef.current, [variableName]: inputValue };
    setResponses(nextResponses);
    responsesRef.current = nextResponses;
    
    setInputValue('');

    // Process next block
    const currentIndex = orderedBlocks.findIndex(b => b.id === currentBlock.id);
    if (currentIndex >= 0 && currentIndex < orderedBlocks.length - 1) {
      setTimeout(() => processBlock(orderedBlocks[currentIndex + 1]), 300);
    }
  };

  const handleSelectOption = (option: { id: string; label: string }) => {
    const currentBlock = messages[messages.length - 1]?.block;
    if (!currentBlock || currentBlock.type !== 'buttons') return;

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      type: 'user',
      content: option.label,
    }]);

    // Store response
    const variableName = currentBlock.data.variable_name || currentBlock.id;
    const nextResponses = { ...responsesRef.current, [variableName]: option.label };
    setResponses(nextResponses);
    responsesRef.current = nextResponses;

    // Find next block (could be option-specific or default)
    const selectedOption = currentBlock.data.options?.find(o => o.id === option.id);
    const nextBlockId = selectedOption?.next_block_id || currentBlock.next_block_id;
    
    if (nextBlockId) {
      const nextBlock = orderedBlocks.find(b => b.id === nextBlockId);
      if (nextBlock) {
        setTimeout(() => processBlock(nextBlock), 300);
        return;
      }
    }

    // Default: advance to next in sequence
    const currentIndex = orderedBlocks.findIndex(b => b.id === currentBlock.id);
    if (currentIndex >= 0 && currentIndex < orderedBlocks.length - 1) {
      setTimeout(() => processBlock(orderedBlocks[currentIndex + 1]), 300);
    }
  };

  const submitLead = async () => {
    if (isSubmitting || !funnel) return;
    setIsSubmitting(true);

    try {
      // Map responses to lead fields using variable names
      const collectedData: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(responses)) {
        const leadField = VARIABLE_TO_LEAD_FIELD[key.toLowerCase()] || key;
        collectedData[leadField] = value;
      }

      // Get tracking params
      const urlParams = new URLSearchParams(window.location.search);
      const tracking = {
        utm_source: urlParams.get('utm_source') || undefined,
        utm_medium: urlParams.get('utm_medium') || undefined,
        utm_campaign: urlParams.get('utm_campaign') || undefined,
        utm_term: urlParams.get('utm_term') || undefined,
        utm_content: urlParams.get('utm_content') || undefined,
        referrer_url: document.referrer || undefined,
        landing_page: window.location.href,
        user_agent: navigator.userAgent,
      };

      // Submit via edge function with correct payload structure
      const { error } = await supabase.functions.invoke('funnel-submit', {
        body: {
          funnel_id: funnel.id,
          channel: 'chat',
          responses,
          collected_data: collectedData,
          tracking,
        },
      });

      if (error) {
        console.error('Error submitting lead:', error);
      }
    } catch (err) {
      console.error('Error submitting lead:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error || !funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Chat não encontrado</h1>
          <p className="text-muted-foreground">Este link pode estar inativo ou incorreto.</p>
        </div>
      </div>
    );
  }

  const currentMessage = messages[messages.length - 1];
  const showInput = currentMessage?.block?.type === 'input' && !isTyping && !isComplete;
  const showButtons = currentMessage?.options && !isTyping && !isComplete;

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: funnel.theme.background_color }}
    >
      {/* Header */}
      <div 
        className="p-4 border-b"
        style={{ backgroundColor: funnel.theme.primary_color }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {funnel.theme.logo_url ? (
            <img src={funnel.theme.logo_url} alt="Logo" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <p className="font-medium text-white">{funnel.products?.name || funnel.name}</p>
            <p className="text-sm text-white/70">Online agora</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <AnimatePresence>
            {messages.map((message, idx) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'bot' && (
                  <div className="flex gap-2 max-w-[85%]">
                    <div 
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: funnel.theme.primary_color }}
                    >
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="space-y-2">
                      <div 
                        className="p-3 rounded-2xl rounded-tl-sm"
                        style={{ 
                          backgroundColor: funnel.theme.primary_color,
                          color: '#fff'
                        }}
                      >
                        {message.content}
                      </div>
                      
                      {/* Buttons */}
                      {message.options && idx === messages.length - 1 && !isTyping && (
                        <div className="space-y-2 mt-2">
                          {message.options.map(option => (
                            <button
                              key={option.id}
                              onClick={() => handleSelectOption(option)}
                              className="block w-full p-3 rounded-xl border text-left transition-all hover:scale-[1.02]"
                              style={{ 
                                borderColor: funnel.theme.primary_color,
                                color: funnel.theme.text_color 
                              }}
                            >
                              {option.emoji && <span className="mr-2">{option.emoji}</span>}
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {message.type === 'user' && (
                  <div 
                    className="max-w-[85%] p-3 rounded-2xl rounded-tr-sm bg-muted"
                    style={{ color: funnel.theme.text_color }}
                  >
                    {message.content}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: funnel.theme.primary_color }}
              >
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div 
                className="p-3 rounded-2xl rounded-tl-sm"
                style={{ backgroundColor: funnel.theme.primary_color }}
              >
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {showInput && (
        <div className="p-4 border-t" style={{ backgroundColor: funnel.theme.background_color }}>
          <div className="max-w-lg mx-auto">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitInput();
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type={currentMessage?.block?.data.input_type === 'email' ? 'email' : 'text'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={currentMessage?.block?.data.placeholder || 'Digite aqui...'}
                className="flex-1 px-4 py-3 rounded-full border bg-background"
                style={{ 
                  borderColor: funnel.theme.primary_color,
                  color: funnel.theme.text_color 
                }}
              />
              <button
                type="submit"
                className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ backgroundColor: funnel.theme.primary_color }}
              >
                <Send className="h-5 w-5 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Complete indicator */}
      {isComplete && (
        <div className="p-4 border-t text-center" style={{ backgroundColor: funnel.theme.background_color }}>
          <p className="text-sm" style={{ color: funnel.theme.text_color, opacity: 0.7 }}>
            ✅ Conversa finalizada
          </p>
        </div>
      )}
    </div>
  );
}
