import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/stats-card";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { 
  FileText, 
  AlertTriangle, 
  TrendingUp, 
  UserCheck,
  RefreshCw,
  PoundSterling,
  Calendar,
  Car,
} from "lucide-react";

interface ClaimSummary {
  id: string;
  claim_id?: string;
  claimant_name?: string;
  policy_id?: string;
  claim_amount_gbp?: number;
  accident_date?: string;
  accident_type?: string;
  vehicle_registration?: string;
  status: string;
  fraud_score?: number | null;
  risk_band?: string | null;
  created_at?: string;
}

interface DashboardStats {
  total_claims?: number;
  totalClaims?: number;
  high_risk_claims?: number;
  highRiskClaims?: number;
  pending_review?: number;
  pendingReview?: number;
  overrides_this_month?: number;
  overridesThisMonth?: number;
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-muted-foreground";
  if (score < 30) return "text-green-600";
  if (score <= 60) return "text-amber-600";
  return "text-red-600";
}

function getScoreBgColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-muted";
  if (score < 30) return "bg-green-50 dark:bg-green-950/20";
  if (score <= 60) return "bg-amber-50 dark:bg-amber-950/20";
  return "bg-red-50 dark:bg-red-950/20";
}

export default function Dashboard() {
  const { data: claims = [], isLoading: claimsLoading, refetch } = useQuery<ClaimSummary[]>({
    queryKey: ["/api/claims"],
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const sortedClaims = [...claims].sort((a, b) => {
    const scoreA = a.fraud_score ?? 0;
    const scoreB = b.fraud_score ?? 0;
    return scoreB - scoreA;
  });

  const highRiskClaims = sortedClaims.filter(c => (c.risk_band || "") === "high");
  const recentClaims = sortedClaims.slice(0, 8);

  const getTotalClaims = () => stats?.total_claims ?? stats?.totalClaims ?? claims.length;
  const getHighRiskClaims = () => stats?.high_risk_claims ?? stats?.highRiskClaims ?? highRiskClaims.length;
  const getPendingReview = () => stats?.pending_review ?? stats?.pendingReview ?? claims.filter(c => c.status === "needs_review").length;
  const getOverrides = () => stats?.overrides_this_month ?? stats?.overridesThisMonth ?? 0;

  return (
    <div className="p-6 space-y-6" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            AI-assisted fraud analysis for UK motor insurance claims
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="gap-2"
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Claims"
          value={getTotalClaims()}
          description="Active in system"
          icon={FileText}
        />
        <StatsCard
          title="High Risk"
          value={getHighRiskClaims()}
          description="Requires attention"
          icon={AlertTriangle}
          className="border-risk-high/20"
        />
        <StatsCard
          title="Needs Review"
          value={getPendingReview()}
          description="Awaiting decision"
          icon={TrendingUp}
        />
        <StatsCard
          title="Decisions Made"
          value={getOverrides()}
          description="This month"
          icon={UserCheck}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg font-semibold">All Claims</CardTitle>
            <Link href="/claims">
              <Button variant="ghost" size="sm" data-testid="link-view-all-claims">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {claimsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading claims...
              </div>
            ) : recentClaims.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No claims to display</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentClaims.map((claim) => (
                  <Link key={claim.claim_id || claim.id} href={`/claims/${claim.claim_id || claim.id}`}>
                    <div 
                      className={`p-4 rounded-lg border hover-elevate cursor-pointer ${getScoreBgColor(claim.fraud_score)}`}
                      data-testid={`claim-card-${claim.claim_id || claim.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">{claim.claim_id || claim.id}</p>
                            <StatusBadge status={claim.status} />
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {claim.claimant_name}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <PoundSterling className="h-3 w-3" />
                              £{Number(claim.claim_amount_gbp || 0).toLocaleString("en-GB")}
                            </span>
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {claim.accident_type || "N/A"}
                            </span>
                            {claim.vehicle_registration && (
                              <span className="flex items-center gap-1">
                                <Car className="h-3 w-3" />
                                {claim.vehicle_registration}
                              </span>
                            )}
                          </div>
                          {claim.created_at && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(claim.created_at), "dd MMM yyyy, HH:mm")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`text-2xl font-bold ${getScoreColor(claim.fraud_score)}`}>
                            {claim.fraud_score ?? "--"}
                          </div>
                          <RiskBadge 
                            riskBand={(claim.risk_band as "low" | "medium" | "high") || "low"} 
                            score={claim.fraud_score}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-risk-high" />
              High Risk Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            {highRiskClaims.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No high-risk claims to review</p>
              </div>
            ) : (
              <div className="space-y-3">
                {highRiskClaims.slice(0, 5).map((claim) => (
                  <Link key={claim.claim_id || claim.id} href={`/claims/${claim.claim_id || claim.id}`}>
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 hover-elevate cursor-pointer"
                      data-testid={`priority-claim-${claim.claim_id || claim.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{claim.claim_id || claim.id}</p>
                          <StatusBadge status={claim.status} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{claim.claimant_name}</p>
                        <p className="text-xs text-muted-foreground">
                          £{Number(claim.claim_amount_gbp || 0).toLocaleString("en-GB")}
                        </p>
                      </div>
                      <div className="text-xl font-bold text-red-600">
                        {claim.fraud_score ?? "--"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <UserCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Human-in-the-Loop</h3>
              <p className="text-sm text-muted-foreground">
                FraudGuard provides AI-powered risk scores as recommendations only. 
                All final decisions are made by qualified fraud analysts. 
                Claims are locked after submission to ensure data integrity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
