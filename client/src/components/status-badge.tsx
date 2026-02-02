import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileText, BarChart3, Eye, CheckCircle2 } from "lucide-react";

type ClaimStatus = "new" | "scored" | "reviewing" | "decided";

interface StatusBadgeProps {
  status: ClaimStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<ClaimStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    new: {
      label: "New",
      icon: FileText,
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    },
    scored: {
      label: "Scored",
      icon: BarChart3,
      className: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    },
    reviewing: {
      label: "Reviewing",
      icon: Eye,
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
    },
    decided: {
      label: "Decided",
      icon: CheckCircle2,
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
    },
  };

  const statusKey = status as ClaimStatus;
  const { label, icon: Icon, className } = config[statusKey] || config.new;

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium border gap-1.5", className)}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Badge>
  );
}
