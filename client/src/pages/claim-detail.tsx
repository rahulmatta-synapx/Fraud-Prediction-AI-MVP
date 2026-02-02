import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreDisplay } from "@/components/score-display";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { SignalCard } from "@/components/signal-card";
import { RuleTriggerCard } from "@/components/rule-trigger-card";
import { AuditLogItem } from "@/components/audit-log-item";
import { OverrideForm } from "@/components/override-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Car,
  Calendar,
  MapPin,
  User,
  PoundSterling,
  FileText,
  Brain,
  Scale,
  History,
  RefreshCw,
  Eye,
  CheckCircle2,
} from "lucide-react";
import type { ClaimWithDetails } from "@shared/schema";

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: claim, isLoading, error } = useQuery<ClaimWithDetails>({
    queryKey: ["/api/claims", id],
  });

  const rescore = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/claims/${id}/rescore`, {});
    },
    onSuccess: () => {
      toast({ title: "Claim rescored successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to rescore",
        variant: "destructive",
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest("PATCH", `/api/claims/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      toast({ title: "Status updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Claim Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The requested claim could not be found.
          </p>
          <Link href="/claims">
            <Button>Return to Claims</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const vehicleDetails = claim.vehicleDetails as { make: string; model: string; year: number; registration: string; estimatedValue: number };
  const claimantHistory = claim.claimantHistory as { previousClaims: number; lastClaimDate: string | null; totalPreviousAmount: number };

  return (
    <div className="p-6 space-y-6" data-testid="page-claim-detail">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/claims">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{claim.claimRef}</h1>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-muted-foreground">
              {claim.claimantName} - {claim.policyId}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => rescore.mutate()}
            disabled={rescore.isPending}
            className="gap-2"
            data-testid="button-rescore"
          >
            <RefreshCw className={`h-4 w-4 ${rescore.isPending ? "animate-spin" : ""}`} />
            Rescore
          </Button>
          {claim.status !== "reviewing" && claim.status !== "decided" && (
            <Button 
              variant="outline"
              onClick={() => updateStatus.mutate("reviewing")}
              className="gap-2"
              data-testid="button-start-review"
            >
              <Eye className="h-4 w-4" />
              Start Review
            </Button>
          )}
          {claim.status === "reviewing" && (
            <Button 
              onClick={() => updateStatus.mutate("decided")}
              className="gap-2"
              data-testid="button-mark-decided"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Decided
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Claim Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <PoundSterling className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Claim Amount</p>
                      <p className="text-xl font-bold">
                        £{Number(claim.claimAmount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Accident Date</p>
                      <p className="font-medium">{format(new Date(claim.accidentDate), "dd MMMM yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{claim.accidentLocation}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle</p>
                      <p className="font-medium">
                        {vehicleDetails.year} {vehicleDetails.make} {vehicleDetails.model}
                      </p>
                      <p className="text-sm text-muted-foreground">{vehicleDetails.registration}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Claimant History</p>
                      <p className="font-medium">{claimantHistory.previousClaims} previous claims</p>
                      <p className="text-sm text-muted-foreground">
                        Total: £{claimantHistory.totalPreviousAmount.toLocaleString("en-GB")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Accident Description</p>
                <p className="text-sm leading-relaxed">{claim.accidentDescription}</p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="signals" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signals" className="gap-2" data-testid="tab-signals">
                <Brain className="h-4 w-4" />
                AI Signals ({claim.signals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-2" data-testid="tab-rules">
                <Scale className="h-4 w-4" />
                Rules ({claim.ruleTriggers?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2" data-testid="tab-audit">
                <History className="h-4 w-4" />
                Audit Log ({claim.auditLogs?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signals" className="mt-4 space-y-4">
              {claim.signals?.length === 0 ? (
                <Card className="p-8 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No AI signals detected for this claim.</p>
                </Card>
              ) : (
                claim.signals?.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))
              )}
            </TabsContent>

            <TabsContent value="rules" className="mt-4 space-y-4">
              {claim.ruleTriggers?.length === 0 ? (
                <Card className="p-8 text-center">
                  <Scale className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No rules triggered for this claim.</p>
                </Card>
              ) : (
                claim.ruleTriggers?.map((trigger) => (
                  <RuleTriggerCard key={trigger.id} trigger={trigger} />
                ))
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {claim.auditLogs?.length === 0 ? (
                    <div className="p-8 text-center">
                      <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">No audit entries yet.</p>
                    </div>
                  ) : (
                    claim.auditLogs?.map((log) => (
                      <AuditLogItem key={log.id} log={log} />
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <ScoreDisplay score={claim.fraudScore} size="xl" />
              <RiskBadge 
                riskBand={claim.riskBand as "high" | "medium" | "low" | null} 
                size="lg"
                showScore={false}
              />
              {claim.scoredAt && (
                <p className="text-xs text-muted-foreground text-center">
                  Last scored: {format(new Date(claim.scoredAt), "dd MMM yyyy 'at' HH:mm")}
                </p>
              )}
            </CardContent>
          </Card>

          <OverrideForm 
            claimId={claim.id} 
            currentScore={claim.fraudScore}
          />

          <Card className="bg-accent/30 border-accent">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Decision Support Only:</strong> This score is a recommendation 
                to help prioritize your investigation. You have full authority to override based on your 
                professional judgment.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
