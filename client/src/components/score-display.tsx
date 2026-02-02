import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
}

export function ScoreDisplay({ score, size = "md", showLabel = true }: ScoreDisplayProps) {
  if (score === null || score === undefined) {
    return (
      <div className="flex flex-col items-center justify-center" data-testid="score-display-unscored">
        <span className="text-muted-foreground text-sm">Not Scored</span>
      </div>
    );
  }

  const getRiskColor = (s: number) => {
    if (s >= 70) return "text-risk-high";
    if (s >= 40) return "text-risk-medium";
    return "text-risk-low";
  };

  const getBackgroundColor = (s: number) => {
    if (s >= 70) return "bg-risk-high/10 dark:bg-risk-high/15";
    if (s >= 40) return "bg-risk-medium/10 dark:bg-risk-medium/15";
    return "bg-risk-low/10 dark:bg-risk-low/15";
  };

  const sizeClasses = {
    sm: "h-12 w-12 text-lg",
    md: "h-16 w-16 text-2xl",
    lg: "h-20 w-20 text-3xl",
    xl: "h-28 w-28 text-4xl",
  };

  return (
    <div className="flex flex-col items-center gap-1" data-testid="score-display">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold",
          sizeClasses[size],
          getBackgroundColor(score),
          getRiskColor(score)
        )}
      >
        {score}
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium", getRiskColor(score))}>
          {score >= 70 ? "High Risk" : score >= 40 ? "Medium Risk" : "Low Risk"}
        </span>
      )}
    </div>
  );
}
