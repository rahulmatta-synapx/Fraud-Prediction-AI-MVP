import { Link } from "wouter";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { ChevronRight, Car, Calendar, PoundSterling } from "lucide-react";

interface ClaimSummary {
  id: string;
  claim_id?: string;
  claimRef?: string;
  claimant_name?: string;
  claimantName?: string;
  policy_id?: string;
  policyId?: string;
  claim_amount_gbp?: number;
  claimAmount?: number;
  accident_date?: string;
  accidentDate?: string;
  status: string;
  fraud_score?: number | null;
  fraudScore?: number | null;
  risk_band?: string | null;
  riskBand?: string | null;
}

interface ClaimsTableProps {
  claims: ClaimSummary[];
  isLoading?: boolean;
}

export function ClaimsTable({ claims, isLoading }: ClaimsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-claims">
        <Car className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-1">No claims found</h3>
        <p className="text-muted-foreground text-sm">
          Claims will appear here once they are submitted for analysis.
        </p>
      </div>
    );
  }

  const getClaimRef = (c: ClaimSummary) => c.claim_id || c.claimRef || c.id;
  const getClaimantName = (c: ClaimSummary) => c.claimant_name || c.claimantName || "";
  const getPolicyId = (c: ClaimSummary) => c.policy_id || c.policyId || "";
  const getClaimAmount = (c: ClaimSummary) => c.claim_amount_gbp ?? c.claimAmount ?? 0;
  const getAccidentDate = (c: ClaimSummary) => c.accident_date || c.accidentDate || new Date().toISOString();
  const getFraudScore = (c: ClaimSummary) => c.fraud_score ?? c.fraudScore ?? null;
  const getRiskBand = (c: ClaimSummary) => c.risk_band || c.riskBand || null;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold">Claim Ref</TableHead>
            <TableHead className="font-semibold">Claimant</TableHead>
            <TableHead className="font-semibold">Amount</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Risk Score</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {claims.map((claim) => (
            <TableRow 
              key={claim.id} 
              className="hover-elevate cursor-pointer"
              data-testid={`row-claim-${claim.id}`}
            >
              <TableCell className="font-mono font-medium text-sm">
                {getClaimRef(claim)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{getClaimantName(claim)}</span>
                  <span className="text-xs text-muted-foreground">{getPolicyId(claim)}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <PoundSterling className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {Number(getClaimAmount(claim)).toLocaleString("en-GB", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {format(new Date(getAccidentDate(claim)), "dd MMM yyyy")}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={claim.status} />
              </TableCell>
              <TableCell className="text-center">
                <RiskBadge 
                  riskBand={getRiskBand(claim) as "high" | "medium" | "low" | null} 
                  score={getFraudScore(claim)}
                  size="sm"
                />
              </TableCell>
              <TableCell>
                <Link href={`/claims/${claim.claim_id}`}>
                  <Button variant="ghost" size="icon" data-testid={`button-view-claim-${claim.claim_id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
