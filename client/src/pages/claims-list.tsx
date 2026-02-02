import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, Filter, Download } from "lucide-react";
import type { Claim } from "@shared/schema";

export default function ClaimsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const { data: claims = [], isLoading } = useQuery<Claim[]>({
    queryKey: ["/api/claims"],
  });

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch = 
      claim.claimRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.policyId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
    const matchesRisk = riskFilter === "all" || claim.riskBand === riskFilter;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  const sortedClaims = [...filteredClaims].sort((a, b) => {
    const scoreA = a.fraudScore ?? 0;
    const scoreB = b.fraudScore ?? 0;
    return scoreB - scoreA;
  });

  const handleExport = () => {
    const csv = [
      ["Claim Ref", "Claimant", "Amount", "Status", "Risk Score", "Risk Band"].join(","),
      ...sortedClaims.map(c => [
        c.claimRef,
        `"${c.claimantName}"`,
        c.claimAmount,
        c.status,
        c.fraudScore ?? "N/A",
        c.riskBand ?? "N/A"
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
          <h1 className="text-2xl font-bold">All Claims</h1>
          <p className="text-muted-foreground">
            Browse and manage motor insurance claims
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
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="scored">Scored</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="decided">Decided</SelectItem>
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
