import { Trophy, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanStage } from '@/hooks/useKanbanData';
import { KanbanLeadCard } from './KanbanLeadCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  stage: KanbanStage;
  onViewLead: (leadId: string) => void;
}

export function KanbanColumn({ stage, onViewLead }: KanbanColumnProps) {
  const stageColor = stage.color || '#6b7280';

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full w-[300px] shrink-0 bg-muted/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="p-4 text-white"
        style={{
          background: `linear-gradient(135deg, ${stageColor}, ${stageColor}cc)`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {stage.is_won && <Trophy className="h-4 w-4" />}
            {stage.is_lost && <XCircle className="h-4 w-4" />}
            <h3 className="font-semibold text-sm uppercase tracking-wide">{stage.name}</h3>
          </div>
          <Badge 
            variant="secondary" 
            className="bg-white/20 text-white hover:bg-white/30 text-xs"
          >
            {stage.leadCount}
          </Badge>
        </div>
        
        <div className="text-xl font-bold">
          {formatCurrency(stage.totalValue)}
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {stage.leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div 
                className="w-12 h-12 rounded-full mb-3 flex items-center justify-center opacity-30"
                style={{ backgroundColor: stageColor }}
              >
                <span className="text-white text-lg">0</span>
              </div>
              <p className="text-sm text-muted-foreground">Nenhum lead</p>
            </div>
          ) : (
            stage.leads.map((lead) => (
              <KanbanLeadCard
                key={lead.id}
                lead={lead}
                stageColor={stageColor}
                onViewDetails={() => onViewLead(lead.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
