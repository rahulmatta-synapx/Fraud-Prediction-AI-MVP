import { format } from "date-fns";
import { User, Clock, ArrowRight } from "lucide-react";
import type { AuditLog } from "@shared/schema";

interface AuditLogItemProps {
  log: AuditLog;
}

const reasonLabels: Record<string, string> = {
  false_positive: "False Positive",
  additional_evidence: "Additional Evidence",
  disagree_with_signal: "Disagree with Signal",
  manual_review_complete: "Manual Review Complete",
  other: "Other",
};

export function AuditLogItem({ log }: AuditLogItemProps) {
  const getActionLabel = (action: string) => {
    switch (action) {
      case "score_calculated":
        return "Score calculated";
      case "score_override":
        return "Score overridden";
      case "status_change":
        return "Status changed";
      case "claim_created":
        return "Claim created";
      default:
        return action;
    }
  };

  return (
    <div className="flex gap-4 py-3 border-b border-border last:border-b-0" data-testid={`audit-log-${log.id}`}>
      <div className="flex-shrink-0 mt-0.5">
        <div className="p-1.5 rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{getActionLabel(log.action)}</span>
          {log.fieldChanged && (
            <span className="text-xs text-muted-foreground">({log.fieldChanged})</span>
          )}
        </div>
        
        {log.oldValue && log.newValue && (
          <div className="flex items-center gap-2 text-sm mb-1">
            <span className="text-muted-foreground">{log.oldValue}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{log.newValue}</span>
          </div>
        )}
        
        {log.reasonCategory && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Reason:</span> {reasonLabels[log.reasonCategory] || log.reasonCategory}
          </p>
        )}
        
        {log.notes && (
          <p className="text-sm text-muted-foreground mt-1 italic">"{log.notes}"</p>
        )}
        
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{format(new Date(log.createdAt), "dd MMM yyyy 'at' HH:mm")}</span>
        </div>
      </div>
    </div>
  );
}
