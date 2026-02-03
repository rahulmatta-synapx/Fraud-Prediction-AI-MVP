import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClaimsTable } from "@/components/claims-table";
import { StatsCard } from "@/components/stats-card";
import { RiskBadge } from "@/components/risk-badge";
import { 
  FileText, 
  AlertTriangle, 
  TrendingUp, 
  UserCheck,
  ArrowRight,
  RefreshCw
} from "lucide-react";

interface ClaimSummary {
  id: string;
  claim_id?: string;
  claimant_name?: string;
  policy_id?: string;
  claim_amount_gbp?: number;
  accident_date?: string;
  status: string;
  fraud_score?: number | null;
  risk_band?: string | null;
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

export default function Dashboard() {
  const { data: claims = [], isLoading: claimsLoading, refetch } = useQuery<ClaimSummary[]>({
    queryKey: ["/api/claims"],
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const highRiskClaims = claims.filter(c => (c.risk_band || "") === "high").slice(0, 5);
  const recentClaims = claims.slice(0, 5);

  const getTotalClaims = () => stats?.total_claims ?? stats?.totalClaims ?? claims.length;
  const getHighRiskClaims = () => stats?.high_risk_claims ?? stats?.highRiskClaims ?? highRiskClaims.length;
  const getPendingReview = () => stats?.pending_review ?? stats?.pendingReview ?? claims.filter(c => c.status === "under_review").length;
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
          title="Pending Review"
          value={getPendingReview()}
          description="In progress"
          icon={TrendingUp}
        />
        <StatsCard
          title="Overrides"
          value={getOverrides()}
          description="This month"
          icon={UserCheck}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Claims</CardTitle>
            <Link href="/claims">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-claims">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ClaimsTable claims={recentClaims} isLoading={claimsLoading} />
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
                {highRiskClaims.map((claim) => (
                  <Link key={claim.id} href={`/claims/${claim.id}`}>
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate cursor-pointer"
                      data-testid={`priority-claim-${claim.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{claim.claim_id || claim.id}</p>
                        <p className="text-xs text-muted-foreground">{claim.claimant_name}</p>
                      </div>
                      <RiskBadge 
                        riskBand="high" 
                        score={claim.fraud_score}
                        size="sm"
                      />
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
                You can override any score with a documented reason.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
