import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreDisplay } from "@/components/score-display";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
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
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface Claim {
  id: string;
  claim_id: string;
  claimant_name: string;
  policy_id: string;
  num_previous_claims: number;
  total_previous_claims_gbp: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_registration: string;
  vehicle_estimated_value_gbp: number;
  accident_date: string;
  accident_type: string;
  accident_location: string;
  claim_amount_gbp: number;
  accident_description: string;
  documents: Array<{
    blob_path: string;
    blob_url: string;
    filename: string;
    content_type: string;
    uploaded_at: string;
    uploaded_by: string;
  }>;
  fraud_score: number | null;
  risk_band: string | null;
  status: string;
  signals: Array<{
    id: string;
    signal_type: string;
    description: string;
    confidence: number;
    detected_at: string;
  }>;
  rule_triggers: Array<{
    id: string;
    rule_id: string;
    rule_name: string;
    description: string;
    weight: number;
    triggered_at: string;
  }>;
  field_edits: Array<{
    field_name: string;
    original_value: string;
    edited_value: string;
    edited_by: string;
    edited_at: string;
    reason: string | null;
  }>;
  audit_logs: Array<{
    id: string;
    claim_id: string;
    user_name: string;
    action_type: string;
    field_changed: string | null;
    old_value: string | null;
    new_value: string | null;
    reason_category: string | null;
    notes: string | null;
    timestamp: string;
  }>;
  created_at: string;
  updated_at: string;
  scored_at: string | null;
  created_by: string;
}

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: claim, isLoading, error } = useQuery<Claim>({
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

  const formatActionType = (action: string) => {
    const mapping: { [key: string]: string } = {
      CLAIM_CREATED: "Claim Created",
      SCORE_GENERATED: "Score Generated",
      OVERRIDE: "Score Override",
      FIELD_EDIT: "Field Edited",
      STATUS_CHANGE: "Status Changed",
      DOCUMENT_UPLOADED: "Document Uploaded",
    };
    return mapping[action] || action;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CLAIM_CREATED": return <FileText className="h-4 w-4" />;
      case "SCORE_GENERATED": return <Brain className="h-4 w-4" />;
      case "OVERRIDE": return <AlertTriangle className="h-4 w-4" />;
      case "FIELD_EDIT": return <User className="h-4 w-4" />;
      case "STATUS_CHANGE": return <CheckCircle2 className="h-4 w-4" />;
      case "DOCUMENT_UPLOADED": return <FileText className="h-4 w-4" />;
      default: return <History className="h-4 w-4" />;
    }
  };

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
              <h1 className="text-2xl font-bold">{claim.claim_id}</h1>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-muted-foreground">
              {claim.claimant_name} - {claim.policy_id}
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
          {claim.status !== "under_review" && claim.status !== "approved" && claim.status !== "denied" && (
            <Button 
              variant="outline"
              onClick={() => updateStatus.mutate("under_review")}
              className="gap-2"
              data-testid="button-start-review"
            >
              <Eye className="h-4 w-4" />
              Start Review
            </Button>
          )}
          {claim.status === "under_review" && (
            <Button 
              onClick={() => updateStatus.mutate("approved")}
              className="gap-2"
              data-testid="button-approve"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
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
                        £{Number(claim.claim_amount_gbp).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Accident Date</p>
                      <p className="font-medium">{format(new Date(claim.accident_date), "dd MMMM yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{claim.accident_location}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Accident Type</p>
                    <Badge variant="outline">{claim.accident_type}</Badge>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle</p>
                      <p className="font-medium">
                        {claim.vehicle_year} {claim.vehicle_make} {claim.vehicle_model}
                      </p>
                      <p className="text-sm text-muted-foreground">{claim.vehicle_registration}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <PoundSterling className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle Value</p>
                      <p className="font-medium">£{Number(claim.vehicle_estimated_value_gbp).toLocaleString("en-GB")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Previous Claims</p>
                      <p className="font-medium">
                        {claim.num_previous_claims} claims (£{Number(claim.total_previous_claims_gbp).toLocaleString("en-GB")})
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-2">Accident Description</p>
                <p className="text-sm">{claim.accident_description}</p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="signals">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="signals" className="gap-2" data-testid="tab-signals">
                <Brain className="h-4 w-4" />
                AI Signals ({claim.signals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-2" data-testid="tab-rules">
                <Scale className="h-4 w-4" />
                Rules ({claim.rule_triggers?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
                <FileText className="h-4 w-4" />
                Documents ({claim.documents?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2" data-testid="tab-audit">
                <History className="h-4 w-4" />
                Audit Log ({claim.audit_logs?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signals" className="mt-4 space-y-3">
              {(!claim.signals || claim.signals.length === 0) ? (
                <Card className="p-6 text-center text-muted-foreground">
                  No AI signals detected for this claim.
                </Card>
              ) : (
                claim.signals.map((signal) => (
                  <Card key={signal.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
                          <Sparkles className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div>
                          <p className="font-medium">{signal.signal_type}</p>
                          <p className="text-sm text-muted-foreground">{signal.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {(signal.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="rules" className="mt-4 space-y-3">
              {(!claim.rule_triggers || claim.rule_triggers.length === 0) ? (
                <Card className="p-6 text-center text-muted-foreground">
                  No rules triggered for this claim.
                </Card>
              ) : (
                claim.rule_triggers.map((rule) => (
                  <Card key={rule.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded-lg">
                          <Scale className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium">{rule.rule_name}</p>
                          <p className="text-sm text-muted-foreground">{rule.description}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">+{rule.weight} points</Badge>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4 space-y-3">
              {(!claim.documents || claim.documents.length === 0) ? (
                <Card className="p-6 text-center text-muted-foreground">
                  No documents uploaded for this claim.
                </Card>
              ) : (
                claim.documents.map((doc, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            Uploaded by {doc.uploaded_by} on {format(new Date(doc.uploaded_at), "dd MMM yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.blob_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4 space-y-3">
              {(!claim.audit_logs || claim.audit_logs.length === 0) ? (
                <Card className="p-6 text-center text-muted-foreground">
                  No audit entries for this claim.
                </Card>
              ) : (
                claim.audit_logs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        {getActionIcon(log.action_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{formatActionType(log.action_type)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.timestamp), "dd MMM yyyy HH:mm:ss")}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          by {log.user_name}
                        </p>
                        {log.field_changed && log.old_value && log.new_value && (
                          <p className="text-sm mt-1">
                            <span className="text-muted-foreground">{log.field_changed}:</span>{" "}
                            <span className="line-through text-red-600">{log.old_value}</span>{" "}
                            → <span className="text-green-600">{log.new_value}</span>
                          </p>
                        )}
                        {log.reason_category && (
                          <Badge variant="outline" className="mt-2">
                            {log.reason_category.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {log.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">"{log.notes}"</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Risk Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreDisplay score={claim.fraud_score || 0} size="lg" />
              <RiskBadge riskBand={(claim.risk_band as "high" | "medium" | "low") || "low"} />
              {claim.scored_at && (
                <p className="text-xs text-muted-foreground">
                  Last scored: {format(new Date(claim.scored_at), "dd MMM yyyy 'at' HH:mm")}
                </p>
              )}
            </CardContent>
          </Card>

          <OverrideForm 
            claimId={id!} 
            currentScore={claim.fraud_score || 0} 
          />
        </div>
      </div>
    </div>
  );
}
