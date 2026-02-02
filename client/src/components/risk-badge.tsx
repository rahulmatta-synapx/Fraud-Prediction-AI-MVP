import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

interface RiskBadgeProps {
  riskBand: "high" | "medium" | "low" | null | undefined;
  score?: number | null;
  showScore?: boolean;
  size?: "sm" | "default" | "lg";
}

export function RiskBadge({ riskBand, score, showScore = true, size = "default" }: RiskBadgeProps) {
  const config = {
    high: {
      label: "High Risk",
      icon: AlertTriangle,
      className: "bg-risk-high/10 text-risk-high border-risk-high/20 dark:bg-risk-high/20 dark:text-risk-high dark:border-risk-high/30",
    },
    medium: {
      label: "Medium Risk",
      icon: AlertCircle,
      className: "bg-risk-medium/10 text-risk-medium border-risk-medium/20 dark:bg-risk-medium/20 dark:text-risk-medium dark:border-risk-medium/30",
    },
    low: {
      label: "Low Risk",
      icon: CheckCircle,
      className: "bg-risk-low/10 text-risk-low border-risk-low/20 dark:bg-risk-low/20 dark:text-risk-low dark:border-risk-low/30",
    },
  };

  if (!riskBand) {
    return (
      <Badge variant="secondary" className="font-medium" data-testid="badge-risk-unscored">
        Not Scored
      </Badge>
    );
  }

  const { label, icon: Icon, className } = config[riskBand];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-semibold border gap-1.5",
        className,
        size === "sm" && "text-xs px-2 py-0.5",
        size === "lg" && "text-sm px-3 py-1"
      )}
      data-testid={`badge-risk-${riskBand}`}
    >
      <Icon className={cn("h-3.5 w-3.5", size === "sm" && "h-3 w-3", size === "lg" && "h-4 w-4")} />
      {showScore && score !== null && score !== undefined ? (
        <span>{score}</span>
      ) : (
        <span>{label}</span>
      )}
    </Badge>
  );
}
