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
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  PoundSterling,
} from "lucide-react";

interface StatsData {
  total_claims: number;
  high_risk_claims: number;
  medium_risk_claims: number;
  low_risk_claims: number;
  pending_review: number;
  needs_review_count: number;
  approved_count: number;
  rejected_count: number;
  decisions_made: number;
  claims_this_month: number;
  claims_last_24h: number;
  average_score: number;
  total_value_gbp: number;
}

export default function Stats() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="page-stats">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">Loading statistics...</p>
      </div>
    );
  }

  const totalClaims = stats?.total_claims || 0;
  const highRisk = stats?.high_risk_claims || 0;
  const mediumRisk = stats?.medium_risk_claims || 0;
  const lowRisk = stats?.low_risk_claims || 0;
  const needsReview = stats?.needs_review_count || stats?.pending_review || 0;
  const approved = stats?.approved_count || 0;
  const rejected = stats?.rejected_count || 0;
  const decisionsMade = stats?.decisions_made || 0;
  const claimsThisMonth = stats?.claims_this_month || 0;
  const claimsLast24h = stats?.claims_last_24h || 0;
  const avgScore = stats?.average_score || 0;
  const totalValue = stats?.total_value_gbp || 0;

  return (
    <div className="p-6 space-y-6" data-testid="page-stats">
      <div>
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">
          Real-time fraud analysis metrics and claim distributions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Claims"
          value={totalClaims}
          description="In the system"
          icon={FileText}
        />
        <StatsCard
          title="High Risk"
          value={highRisk}
          description={`${totalClaims > 0 ? Math.round((highRisk / totalClaims) * 100) : 0}% of claims`}
          icon={AlertTriangle}
          className="border-risk-high/20"
        />
        <StatsCard
          title="Average Score"
          value={Math.round(avgScore)}
          description="Across all scored claims"
          icon={TrendingDown}
        />
        <StatsCard
          title="Total Value"
          value={`£${(totalValue / 1000).toFixed(0)}k`}
          description="Combined claim amounts"
          icon={PoundSterling}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Needs Review"
          value={needsReview}
          description="Awaiting decision"
          icon={Clock}
          className="border-amber-500/20"
        />
        <StatsCard
          title="Approved"
          value={approved}
          description="Claims approved"
          icon={CheckCircle2}
          className="border-green-500/20"
        />
        <StatsCard
          title="Rejected"
          value={rejected}
          description="Claims rejected"
          icon={XCircle}
          className="border-red-500/20"
        />
        <StatsCard
          title="Decisions Made"
          value={decisionsMade}
          description="Total decisions"
          icon={UserCheck}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatsCard
          title="Claims This Month"
          value={claimsThisMonth}
          description="New submissions"
          icon={Calendar}
        />
        <StatsCard
          title="Last 24 Hours"
          value={claimsLast24h}
          description="Recent activity"
          icon={Clock}
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
                    ({totalClaims > 0 ? Math.round((highRisk / totalClaims) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-risk-high h-3 rounded-full transition-all" 
                  style={{ width: `${totalClaims > 0 ? (highRisk / totalClaims) * 100 : 0}%` }}
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
                    ({totalClaims > 0 ? Math.round((mediumRisk / totalClaims) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-risk-medium h-3 rounded-full transition-all" 
                  style={{ width: `${totalClaims > 0 ? (mediumRisk / totalClaims) * 100 : 0}%` }}
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
                    ({totalClaims > 0 ? Math.round((lowRisk / totalClaims) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-risk-low h-3 rounded-full transition-all" 
                  style={{ width: `${totalClaims > 0 ? (lowRisk / totalClaims) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Decision Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Needs Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{needsReview}</span>
                  <span className="text-muted-foreground text-sm">
                    ({totalClaims > 0 ? Math.round((needsReview / totalClaims) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-amber-500 h-3 rounded-full transition-all" 
                  style={{ width: `${totalClaims > 0 ? (needsReview / totalClaims) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{approved}</span>
                  <span className="text-muted-foreground text-sm">
                    ({totalClaims > 0 ? Math.round((approved / totalClaims) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all" 
                  style={{ width: `${totalClaims > 0 ? (approved / totalClaims) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Rejected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{rejected}</span>
                  <span className="text-muted-foreground text-sm">
                    ({totalClaims > 0 ? Math.round((rejected / totalClaims) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-red-500 h-3 rounded-full transition-all" 
                  style={{ width: `${totalClaims > 0 ? (rejected / totalClaims) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
