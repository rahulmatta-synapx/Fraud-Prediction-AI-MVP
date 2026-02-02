import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale } from "lucide-react";
import type { RuleTrigger } from "@shared/schema";

interface RuleTriggerCardProps {
  trigger: RuleTrigger;
}

export function RuleTriggerCard({ trigger }: RuleTriggerCardProps) {
  return (
    <Card className="hover-elevate" data-testid={`card-rule-${trigger.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">{trigger.ruleName}</h4>
              <p className="text-sm text-muted-foreground">{trigger.ruleDescription}</p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            +{trigger.weight} pts
          </Badge>
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Triggered by:</span> {trigger.triggered}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
