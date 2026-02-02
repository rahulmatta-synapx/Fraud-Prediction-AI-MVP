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
import type { Claim } from "@shared/schema";

interface ClaimsTableProps {
  claims: Claim[];
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
                {claim.claimRef}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{claim.claimantName}</span>
                  <span className="text-xs text-muted-foreground">{claim.policyId}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <PoundSterling className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    {Number(claim.claimAmount).toLocaleString("en-GB", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {format(new Date(claim.accidentDate), "dd MMM yyyy")}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={claim.status} />
              </TableCell>
              <TableCell className="text-center">
                <RiskBadge 
                  riskBand={claim.riskBand as "high" | "medium" | "low" | null} 
                  score={claim.fraudScore}
                  size="sm"
                />
              </TableCell>
              <TableCell>
                <Link href={`/claims/${claim.id}`}>
                  <Button variant="ghost" size="icon" data-testid={`button-view-claim-${claim.id}`}>
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
