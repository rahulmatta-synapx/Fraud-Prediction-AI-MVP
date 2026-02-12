import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClaimsTable } from "@/components/claims-table";
import { getStatusDisplay } from "@/lib/status-utils";
import { Plus, Search, Filter, Download } from "lucide-react";

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

export default function ClaimsList() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const riskFromUrl = params.get("risk");
  const statusFromUrl = params.get("status");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(statusFromUrl || "all");
  const [riskFilter, setRiskFilter] = useState<string>(riskFromUrl || "all");

  useEffect(() => {
    setRiskFilter(riskFromUrl || "all");
  }, [riskFromUrl]);

  useEffect(() => {
    setStatusFilter(statusFromUrl || "all");
  }, [statusFromUrl]);

  const { data: claims = [], isLoading } = useQuery<ClaimSummary[]>({
    queryKey: ["/api/claims"],
  });

  const filteredClaims = claims.filter((claim) => {
    const claimId = claim.claim_id || claim.id || "";
    const claimantName = claim.claimant_name || "";
    const policyId = claim.policy_id || "";
    const riskBand = claim.risk_band || "";
    
    const matchesSearch = 
      claimId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policyId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
    const matchesRisk = riskFilter === "all" || riskBand === riskFilter;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  const sortedClaims = [...filteredClaims].sort((a, b) => {
    const scoreA = a.fraud_score ?? 0;
    const scoreB = b.fraud_score ?? 0;
    return scoreB - scoreA;
  });

  const handleExport = () => {
    const csv = [
      ["Claim Ref", "Claimant", "Amount", "Status", "Risk Score", "Risk Band"].join(","),
      ...sortedClaims.map(c => [
        c.claim_id || c.id,
        `"${c.claimant_name || ""}"`,
        c.claim_amount_gbp || 0,
        c.status,
        c.fraud_score ?? "N/A",
        c.risk_band ?? "N/A"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claims-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-claims-list">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {riskFilter === "high" 
              ? "High Risk Claims" 
              : statusFilter === "in_review" 
              ? "In Review Claims" 
              : "All Claims"}
          </h1>
          <p className="text-muted-foreground">
            {riskFilter === "high" 
              ? "Review high-risk motor insurance claims requiring attention" 
              : statusFilter === "in_review"
              ? "Claims currently under manual investigation"
              : "Browse and manage motor insurance claims"}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExport} className="gap-2" data-testid="button-export">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/submit">
            <Button className="gap-2" data-testid="button-submit-claim">
              <Plus className="h-4 w-4" />
              Submit Claim
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference, claimant, or policy..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="approved">{getStatusDisplay("approved")}</SelectItem>
                  <SelectItem value="rejected">{getStatusDisplay("rejected")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-risk">
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {sortedClaims.length} of {claims.length} claims
            {(searchTerm || statusFilter !== "all" || riskFilter !== "all") && " (filtered)"}
          </div>
          <ClaimsTable claims={sortedClaims} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
