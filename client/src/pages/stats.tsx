import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/stats-card";
import { 
  FileText, 
  AlertTriangle, 
  TrendingDown,
  UserCheck,
  BarChart3,
  PieChart,
} from "lucide-react";
import type { Claim } from "@shared/schema";

export default function Stats() {
  const { data: claims = [] } = useQuery<Claim[]>({
    queryKey: ["/api/claims"],
  });

  const highRisk = claims.filter(c => c.riskBand === "high").length;
  const mediumRisk = claims.filter(c => c.riskBand === "medium").length;
  const lowRisk = claims.filter(c => c.riskBand === "low").length;
  const unscored = claims.filter(c => !c.riskBand).length;

  const totalAmount = claims.reduce((sum, c) => sum + Number(c.claimAmount), 0);
  const avgScore = claims.filter(c => c.fraudScore !== null)
    .reduce((sum, c, _, arr) => sum + (c.fraudScore ?? 0) / arr.length, 0);

  const statusCounts = claims.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6" data-testid="page-stats">
      <div>
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">
          Overview of fraud analysis metrics and claim distributions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Claims"
          value={claims.length}
          description="In the system"
          icon={FileText}
        />
        <StatsCard
          title="High Risk Rate"
          value={claims.length > 0 ? `${Math.round((highRisk / claims.length) * 100)}%` : "0%"}
          description={`${highRisk} claims`}
          icon={AlertTriangle}
        />
        <StatsCard
          title="Average Score"
          value={Math.round(avgScore)}
          description="Across all scored claims"
          icon={TrendingDown}
        />
        <StatsCard
          title="Total Value"
          value={`£${(totalAmount / 1000).toFixed(0)}k`}
          description="Combined claim amounts"
          icon={UserCheck}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-risk-high" />
                  <span>High Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{highRisk}</span>
                  <span className="text-muted-foreground text-sm">
                    ({claims.length > 0 ? Math.round((highRisk / claims.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-risk-high h-2 rounded-full" 
                  style={{ width: `${claims.length > 0 ? (highRisk / claims.length) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-risk-medium" />
                  <span>Medium Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{mediumRisk}</span>
                  <span className="text-muted-foreground text-sm">
                    ({claims.length > 0 ? Math.round((mediumRisk / claims.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-risk-medium h-2 rounded-full" 
                  style={{ width: `${claims.length > 0 ? (mediumRisk / claims.length) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-risk-low" />
                  <span>Low Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{lowRisk}</span>
                  <span className="text-muted-foreground text-sm">
                    ({claims.length > 0 ? Math.round((lowRisk / claims.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-risk-low h-2 rounded-full" 
                  style={{ width: `${claims.length > 0 ? (lowRisk / claims.length) * 100 : 0}%` }}
                />
              </div>

              {unscored > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                      <span>Unscored</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{unscored}</span>
                      <span className="text-muted-foreground text-sm">
                        ({Math.round((unscored / claims.length) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-muted-foreground h-2 rounded-full" 
                      style={{ width: `${(unscored / claims.length) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="capitalize">{status}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${(count / claims.length) * 100}%` }}
                      />
                    </div>
                    <span className="font-bold w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
