import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText } from "lucide-react";
import type { LlmSignal } from "@shared/schema";

interface SignalCardProps {
  signal: LlmSignal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const confidencePercent = Math.round(Number(signal.confidence) * 100);
  
  const getConfidenceColor = (c: number) => {
    if (c >= 80) return "bg-risk-high/10 text-risk-high border-risk-high/20";
    if (c >= 50) return "bg-risk-medium/10 text-risk-medium border-risk-medium/20";
    return "bg-muted text-muted-foreground border-muted";
  };

  return (
    <Card className="border-l-4 border-l-primary" data-testid={`card-signal-${signal.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{signal.signalType}</span>
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs font-medium ${getConfidenceColor(confidencePercent)}`}
          >
            {confidencePercent}% confidence
          </Badge>
        </div>
        
        <p className="text-sm text-foreground mb-3">{signal.description}</p>
        
        <div className="bg-muted/50 rounded-md p-3 border border-border">
          <p className="text-sm text-muted-foreground italic leading-relaxed">
            "{signal.evidence}"
          </p>
        </div>

        {signal.sourceDocument && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Source: {signal.sourceDocument}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
