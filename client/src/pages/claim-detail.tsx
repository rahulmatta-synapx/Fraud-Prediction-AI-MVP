import { useQuery } from "@tanstack/react-query";
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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Lock,
  Edit3,
  RefreshCw,
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
  decision_reason?: string;
  decision_notes?: string;
  decided_by?: string;
  decided_at?: string;
}

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: claim, isLoading, error } = useQuery<Claim>({
    queryKey: ["/api/claims", id],
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
      RESCORE: "Rescored",
      FIELD_EDIT: "Field Edited",
      STATUS_CHANGE: "Status Changed",
      DOCUMENT_UPLOADED: "Document Uploaded",
      APPROVE: "Approved",
      REJECT: "Rejected",
    };
    return mapping[action] || action;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CLAIM_CREATED": return <FileText className="h-4 w-4" />;
      case "SCORE_GENERATED": return <Brain className="h-4 w-4" />;
      case "OVERRIDE": return <AlertTriangle className="h-4 w-4" />;
      case "RESCORE": return <RefreshCw className="h-4 w-4" />;
      case "FIELD_EDIT": return <Edit3 className="h-4 w-4" />;
      case "STATUS_CHANGE": return <CheckCircle2 className="h-4 w-4" />;
      case "DOCUMENT_UPLOADED": return <FileText className="h-4 w-4" />;
      case "APPROVE": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "REJECT": return <XCircle className="h-4 w-4 text-red-600" />;
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
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span className="text-sm">Read-only - Submitted claims cannot be edited</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Claim Details
                <Badge variant="secondary" className="ml-2">
                  <Lock className="h-3 w-3 mr-1" />
                  Locked
                </Badge>
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
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Accident Type</p>
                      <Badge variant="outline">{claim.accident_type}</Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Claimant</p>
                      <p className="font-medium">{claim.claimant_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {claim.num_previous_claims} previous claim{claim.num_previous_claims !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Policy ID</p>
                      <p className="font-medium">{claim.policy_id}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Submitted</p>
                      <p className="font-medium">{format(new Date(claim.created_at), "dd MMM yyyy, HH:mm")}</p>
                      <p className="text-sm text-muted-foreground">by {claim.created_by}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="flex items-start gap-3">
                  <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">
                      {claim.vehicle_year} {claim.vehicle_make} {claim.vehicle_model}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {claim.vehicle_registration} • Est. Value: £{Number(claim.vehicle_estimated_value_gbp).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-2">Accident Description</p>
                <p className="text-sm">{claim.accident_description}</p>
              </div>
            </CardContent>
          </Card>

          {claim.decision_reason && (
            <Card className={claim.status === "approved" ? "border-green-200 bg-green-50/50 dark:bg-green-950/20" : "border-red-200 bg-red-50/50 dark:bg-red-950/20"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {claim.status === "approved" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  Decision: {claim.status === "approved" ? "Approved" : "Rejected"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Reason</p>
                  <p className="font-medium">{claim.decision_reason}</p>
                </div>
                {claim.decision_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{claim.decision_notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>By: {claim.decided_by}</span>
                  {claim.decided_at && (
                    <span>On: {format(new Date(claim.decided_at), "dd MMM yyyy, HH:mm")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="signals">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="signals" data-testid="tab-signals">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Signals ({claim.signals?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="rules" data-testid="tab-rules">
                    <Scale className="h-4 w-4 mr-2" />
                    Rules ({claim.rule_triggers?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="documents" data-testid="tab-documents">
                    <FileText className="h-4 w-4 mr-2" />
                    Documents ({claim.documents?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="audit" data-testid="tab-audit">
                    <History className="h-4 w-4 mr-2" />
                    Audit Log
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signals" className="mt-4">
                  {claim.signals?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No signals detected
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {claim.signals?.map((signal, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Sparkles className="h-4 w-4 text-cyan-600 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {signal.signal_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {(signal.confidence * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                            <p className="text-sm mt-1">{signal.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="rules" className="mt-4">
                  {claim.rule_triggers?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No rules triggered
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {claim.rule_triggers?.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Scale className="h-4 w-4 text-amber-600 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{rule.rule_name}</p>
                              <Badge variant="destructive" className="text-xs">
                                +{rule.weight} points
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {rule.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documents" className="mt-4">
                  {claim.documents?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents attached
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {claim.documents?.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded by {doc.uploaded_by} on {format(new Date(doc.uploaded_at), "dd MMM yyyy")}
                              </p>
                            </div>
                          </div>
                          {doc.blob_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.blob_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                  {claim.audit_logs?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No audit entries
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {claim.audit_logs?.slice().reverse().map((log, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          {getActionIcon(log.action_type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm">{formatActionType(log.action_type)}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(log.timestamp), "dd MMM HH:mm")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{log.user_name}</p>
                            {log.field_changed && (
                              <p className="text-sm mt-1">
                                <span className="text-muted-foreground">{log.field_changed}:</span>{" "}
                                {log.old_value && <span className="line-through text-muted-foreground">{log.old_value}</span>}
                                {log.old_value && " → "}
                                <span className="font-medium">{log.new_value}</span>
                              </p>
                            )}
                            {log.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>
                            )}
                            {log.reason_category && (
                              <Badge variant="outline" className="mt-1 text-xs">{log.reason_category}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <ScoreDisplay score={claim.fraud_score} size="lg" />
                <div className="mt-3">
                  <RiskBadge 
                    riskBand={(claim.risk_band as "low" | "medium" | "high") || "low"} 
                    score={claim.fraud_score}
                    size="lg"
                  />
                </div>
                {claim.scored_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Scored: {format(new Date(claim.scored_at), "dd MMM yyyy, HH:mm")}
                  </p>
                )}
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">
                  {claim.rule_triggers?.length || 0} rule{(claim.rule_triggers?.length || 0) !== 1 ? "s" : ""} triggered
                </p>
                <div className="space-y-1.5">
                  {claim.rule_triggers?.slice(0, 3).map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="truncate">{rule.rule_name}</span>
                      <Badge variant="outline" className="text-xs">+{rule.weight}</Badge>
                    </div>
                  ))}
                  {(claim.rule_triggers?.length || 0) > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{(claim.rule_triggers?.length || 0) - 3} more rules
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {claim.field_edits && claim.field_edits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-amber-600" />
                  Field Edits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {claim.field_edits.map((edit, idx) => (
                    <div key={idx} className="text-sm p-2 rounded bg-amber-50 dark:bg-amber-950/20">
                      <p className="font-medium">{edit.field_name}</p>
                      <p className="text-muted-foreground">
                        <span className="line-through">{edit.original_value}</span>
                        {" → "}
                        <span>{edit.edited_value}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        by {edit.edited_by}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
