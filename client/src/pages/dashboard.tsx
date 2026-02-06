import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
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
  ChevronRight,
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
  approved_count?: number;
  rejected_count?: number;
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-muted-foreground";
  if (score < 30) return "text-green-600";
  if (score <= 60) return "text-amber-600";
  return "text-red-600";
}

export default function Dashboard() {
  const [, navigate] = useLocation();

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
  const needsReviewClaims = sortedClaims.filter(c => c.status === "needs_review");

  const getTotalClaims = () => stats?.total_claims ?? stats?.totalClaims ?? claims.length;
  const getHighRiskClaims = () => stats?.high_risk_claims ?? stats?.highRiskClaims ?? highRiskClaims.length;
  const getPendingReview = () => stats?.pending_review ?? stats?.pendingReview ?? needsReviewClaims.length;
  const getDecisionsMade = () => (stats?.approved_count ?? 0) + (stats?.rejected_count ?? 0);

  const handleRowClick = (claimId: string) => {
    navigate(`/claims/${claimId}`);
  };

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
          value={getDecisionsMade()}
          description="Approved + Rejected"
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
            ) : sortedClaims.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No claims to display</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2 font-medium">Claim ID</th>
                      <th className="text-center py-3 px-2 font-medium">Score</th>
                      <th className="text-left py-3 px-2 font-medium">Risk</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-right py-3 px-2 font-medium">Amount</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Type</th>
                      <th className="text-left py-3 px-2 font-medium hidden lg:table-cell">Registration</th>
                      <th className="text-left py-3 px-2 font-medium hidden lg:table-cell">Submitted</th>
                      <th className="py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClaims.slice(0, 10).map((claim) => (
                      <tr 
                        key={claim.claim_id || claim.id}
                        className="border-b hover-elevate cursor-pointer"
                        onClick={() => handleRowClick(claim.claim_id || claim.id)}
                        data-testid={`claim-row-${claim.claim_id || claim.id}`}
                      >
                        <td className="py-3 px-2 font-medium">
                          {claim.claim_id || claim.id}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`text-xl font-bold ${getScoreColor(claim.fraud_score)}`}>
                            {claim.fraud_score ?? "--"}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <RiskBadge 
                            riskBand={(claim.risk_band as "low" | "medium" | "high") || "low"} 
                            score={claim.fraud_score}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <StatusBadge status={claim.status} />
                        </td>
                        <td className="py-3 px-2 text-right">
                          £{Number(claim.claim_amount_gbp || 0).toLocaleString("en-GB")}
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell text-muted-foreground">
                          {claim.accident_type || "N/A"}
                        </td>
                        <td className="py-3 px-2 hidden lg:table-cell text-muted-foreground">
                          {claim.vehicle_registration || "N/A"}
                        </td>
                        <td className="py-3 px-2 hidden lg:table-cell text-muted-foreground text-xs">
                          {claim.created_at ? format(new Date(claim.created_at), "dd MMM yyyy") : "N/A"}
                        </td>
                        <td className="py-3 px-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <p className="text-sm">No high-risk claims</p>
              </div>
            ) : (
              <div className="space-y-2">
                {highRiskClaims.slice(0, 5).map((claim) => (
                  <div 
                    key={claim.claim_id || claim.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 hover-elevate cursor-pointer"
                    onClick={() => handleRowClick(claim.claim_id || claim.id)}
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
                Synapx provides AI-powered risk scores as recommendations only. 
                After reviewing the AI analysis, analysts can approve or reject claims.
                Claims become read-only after decisions are made for audit compliance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
