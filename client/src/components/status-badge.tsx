import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileSearch, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

type ClaimStatus = "needs_review" | "rescored" | "approved" | "rejected";

interface StatusBadgeProps {
  status: ClaimStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<ClaimStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    needs_review: {
      label: "Needs Review",
      icon: FileSearch,
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30",
    },
    rescored: {
      label: "Rescored",
      icon: RefreshCw,
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30",
    },
    approved: {
      label: "Approved",
      icon: CheckCircle2,
      className: "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    },
    rejected: {
      label: "Rejected",
      icon: XCircle,
      className: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
    },
  };

  const normalizedStatus = status.toLowerCase().replace(/ /g, "_") as ClaimStatus;
  const { label, icon: Icon, className } = config[normalizedStatus] || config.needs_review;

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
