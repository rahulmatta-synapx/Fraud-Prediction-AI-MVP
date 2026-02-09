import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScoreDisplay } from "@/components/score-display";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  ThumbsUp,
  ThumbsDown,
  Info,
  Eye,
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
  justification?: {
    risk_overview: {
      risk_band: string;
      fraud_score: number;
      system_interpretation: string;
    };
    key_factors: Array<{
      type: string;
      name: string;
      explanation: string;
    }>;
    analyst_guidance: {
      review_focus: string[];
      missing_or_uncertain_information: string[];
    };
    confidence_note: string;
  };
  created_at: string;
  updated_at: string;
  scored_at: string | null;
  created_by: string;
  in_review_by?: string;
  in_review_at?: string;
  decision_reason?: string;
  decision_notes?: string;
  decided_by?: string;
  decided_at?: string;
}

const APPROVE_REASONS = [
  "Low risk score with no significant rule triggers",
  "All supporting documentation verified and consistent",
  "Timeline and evidence align with claim narrative",
  "Third-party documentation supports claim (e.g., police/fire service report)",
  "Other",
];

const REJECT_REASONS = [
  "Multiple high-weight rules triggered (high risk score)",
  "Pattern of frequent similar claims detected",
  "Document timeline inconsistencies identified",
  "Missing critical supporting evidence (CCTV, police report, etc.)",
  "Other",
];

const FIELD_LABEL_MAP: Record<string, string> = {
  claimant_name: "Claimant Name",
  policy_id: "Policy ID",
  num_previous_claims: "Number of Previous Claims",
  total_previous_claims_gbp: "Total Previous Claims (£)",
  vehicle_make: "Vehicle Make",
  vehicle_model: "Vehicle Model",
  vehicle_year: "Vehicle Year",
  vehicle_registration: "Vehicle Registration",
  vehicle_estimated_value_gbp: "Vehicle Estimated Value (£)",
  accident_date: "Accident Date",
  accident_type: "Accident Type",
  accident_location: "Accident Location",
  claim_amount_gbp: "Claim Amount (£)",
  accident_description: "Accident Description",
  status: "Status",
  fraud_score: "Fraud Score",
  risk_band: "Risk Band",
  created_by: "Created By",
  created_at: "Created At",
  updated_at: "Updated At",
  scored_at: "Scored At",
  in_review_by: "In Review By",
  in_review_at: "In Review At",
  decided_by: "Decided By",
  decided_at: "Decided At",
  decision_reason: "Decision Reason",
  decision_notes: "Decision Notes",
};

const getFieldLabel = (fieldName: string): string => {
  if (FIELD_LABEL_MAP[fieldName]) {
    return FIELD_LABEL_MAP[fieldName];
  }
  // Fallback: convert snake_case to Title Case
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");

  const { data: claim, isLoading, error } = useQuery<Claim>({
    queryKey: ["/api/claims", id],
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/claims/${id}/approve`, { reason: decisionReason, notes: decisionNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      toast({ title: "Claim approved successfully" });
      setShowApproveModal(false);
      setDecisionReason("");
      setDecisionNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error approving claim", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/claims/${id}/reject`, { reason: decisionReason, notes: decisionNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      toast({ title: "Claim rejected successfully" });
      setShowRejectModal(false);
      setDecisionReason("");
      setDecisionNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error rejecting claim", description: error.message, variant: "destructive" });
    },
  });

  const markInReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/claims/${id}/mark-in-review`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      toast({ title: "Claim marked as in review" });
    },
    onError: (error: Error) => {
      toast({ title: "Error marking claim as in review", description: error.message, variant: "destructive" });
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

  const isDecided = claim.status === "approved" || claim.status === "rejected";
  const canDecide = !isDecided;
  const canMarkInReview = claim.status === "needs_review";
  const isInReview = claim.status === "in_review";

  const formatStatusValue = (status: string) => {
    const mapping: { [key: string]: string } = {
      needs_review: "Needs Review",
      in_review: "In Review",
      approved: "Approved",
      rejected: "Rejected",
      rescored: "Rescored",
    };
    return mapping[status] || status;
  };

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
              <h1 className="text-lg font-bold">{claim.claim_id}</h1>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-muted-foreground">
              {claim.claimant_name} - {claim.policy_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Show Mark In Review button ONLY when status is needs_review */}
          {claim.status === "needs_review" && (
            <Button
              variant="outline"
              className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              onClick={() => markInReviewMutation.mutate()}
              disabled={markInReviewMutation.isPending}
              data-testid="button-mark-in-review"
            >
              <Eye className="h-4 w-4" />
              Mark In Review
            </Button>
          )}
          
          {/* Show Approve/Reject buttons ONLY when status is in_review */}
          {claim.status === "in_review" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={() => setShowApproveModal(true)}
                data-testid="button-approve"
              >
                <ThumbsUp className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => setShowRejectModal(true)}
                data-testid="button-reject"
              >
                <ThumbsDown className="h-4 w-4" />
                Reject
              </Button>
            </div>
          )}
          
          {/* Show "In review by" message when status is in_review */}
          {claim.status === "in_review" && claim.in_review_by && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="text-sm">In review by {claim.in_review_by}</span>
            </div>
          )}
          
          {/* Show read-only message when decision is made */}
          {(claim.status === "approved" || claim.status === "rejected") && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span className="text-sm">Decision made - Claim is now read-only</span>
            </div>
          )}
        </div>
      </div>

      {isDecided && claim.decided_by && (
        <Card className={claim.status === "approved" ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {claim.status === "approved" ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <div className="flex-1">
                <p className="font-semibold">
                  Claim {claim.status === "approved" ? "Approved" : "Rejected"} by {claim.decided_by}
                </p>
                {claim.decided_at && (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(claim.decided_at), "dd MMM yyyy, HH:mm")}
                  </p>
                )}
                {claim.decision_reason && (
                  <Badge variant="outline" className="mt-2">{claim.decision_reason}</Badge>
                )}
                {claim.decision_notes && (
                  <p className="text-sm mt-2">{claim.decision_notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

              {claim.accident_description && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm">{claim.accident_description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Risk Explanation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {claim.justification ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-1">System Interpretation</p>
                    <p className="text-sm text-muted-foreground">
                      {claim.justification.risk_overview.system_interpretation}
                    </p>
                  </div>

                  {claim.justification.key_factors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-3">Key Factors</p>
                      <div className="space-y-2">
                        {claim.justification.key_factors.map((factor, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                            <Badge variant="outline" className="text-xs shrink-0">
                              {factor.type}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{factor.name}</p>
                              <p className="text-sm text-muted-foreground">{factor.explanation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {claim.justification.analyst_guidance && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          Review Focus
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {claim.justification.analyst_guidance.review_focus.map((item, idx) => (
                            <li key={idx}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      {claim.justification.analyst_guidance.missing_or_uncertain_information.length > 0 && (
                        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            Information Gaps
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {claim.justification.analyst_guidance.missing_or_uncertain_information.map((item, idx) => (
                              <li key={idx}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {claim.justification.confidence_note && (
                    <p className="text-xs text-muted-foreground italic">
                      {claim.justification.confidence_note}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Risk explanation based on triggered rules and AI signals:
                  </p>
                  {claim.rule_triggers?.length > 0 ? (
                    <div className="space-y-2">
                      {claim.rule_triggers.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                          <Badge variant="outline" className="text-xs shrink-0">Rule</Badge>
                          <div>
                            <p className="font-medium text-sm">{rule.rule_name}</p>
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          </div>
                          <Badge variant="secondary" className="ml-auto">+{rule.weight}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No risk factors detected.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="signals">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                  <TabsTrigger value="signals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Signals ({claim.signals?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="rules" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    <Scale className="h-4 w-4 mr-2" />
                    Rules ({claim.rule_triggers?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    <FileText className="h-4 w-4 mr-2" />
                    Documents ({claim.documents?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    <History className="h-4 w-4 mr-2" />
                    Audit Log ({claim.audit_logs?.length || 0})
                  </TabsTrigger>
                </TabsList>

                <div className="p-4">
                  <TabsContent value="signals" className="mt-0">
                    {claim.signals?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No AI signals detected
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {claim.signals?.map((signal, idx) => (
                          <div key={idx} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-start gap-3">
                              <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                              <div>
                                <p className="font-medium text-sm">{signal.signal_type}</p>
                                <p className="text-sm text-muted-foreground">{signal.description}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(signal.confidence * 100)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="rules" className="mt-0">
                    {claim.rule_triggers?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No rules triggered
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {claim.rule_triggers?.map((rule, idx) => (
                          <div key={idx} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-start gap-3">
                              <Scale className="h-4 w-4 text-amber-600 mt-0.5" />
                              <div>
                                <p className="font-medium text-sm">{rule.rule_name}</p>
                                <p className="text-sm text-muted-foreground">{rule.description}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs font-bold">
                              +{rule.weight}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="mt-0">
                    {claim.documents?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No documents attached
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {claim.documents?.map((doc, idx) => (
                          <div key={idx} className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
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

                            {doc.blob_url && (
                              <div className="border rounded-lg overflow-hidden bg-muted/30">
                                <div className="p-2 border-b bg-muted/50">
                                  <p className="text-sm font-medium">Document Preview</p>
                                  <p className="text-xs text-muted-foreground">View the uploaded document</p>
                                </div>
                                {doc.content_type.startsWith("image/") ? (
                                  <div className="p-4 flex justify-center">
                                    <img 
                                      src={doc.blob_url} 
                                      alt="Document preview" 
                                      className="max-w-full max-h-96 object-contain rounded border"
                                    />
                                  </div>
                                ) : doc.content_type === "application/pdf" ? (
                                  <div className="h-96 w-full">
                                    <iframe
                                      src={doc.blob_url}
                                      className="w-full h-full"
                                      title="PDF Preview"
                                    />
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="mt-0">
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
                                  <span className="font-medium">{getFieldLabel(log.field_changed)}:</span>{" "}
                                  {log.old_value && (
                                    <span className="line-through text-muted-foreground">
                                      {log.field_changed === "status" ? formatStatusValue(log.old_value) : log.old_value}
                                    </span>
                                  )}
                                  {log.old_value && " → "}
                                  <span className="font-medium">
                                    {log.field_changed === "status" ? formatStatusValue(log.new_value || "") : log.new_value}
                                  </span>
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
                </div>
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
                      <p className="font-medium">{getFieldLabel(edit.field_name)}</p>
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

      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="max-w-mlgd">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-600" />
              Approve Claim
            </DialogTitle>
            <DialogDescription>
              Approve this claim with a reason and notes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="approve-reason">Reason *</Label>
              <Select value={decisionReason} onValueChange={setDecisionReason}>
                <SelectTrigger data-testid="select-approve-reason" className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {APPROVE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason} className="cursor-pointer">
                      <span className="block max-w-[350px] text-sm">{reason}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approve-notes">Notes *</Label>
              <Textarea
                id="approve-notes"
                placeholder="Enter notes about your decision..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="textarea-approve-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => approveMutation.mutate()}
              disabled={!decisionReason || !decisionNotes || approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-600" />
              Reject Claim
            </DialogTitle>
            <DialogDescription>
              Reject this claim with a reason and notes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason *</Label>
              <Select value={decisionReason} onValueChange={setDecisionReason}>
                <SelectTrigger data-testid="select-reject-reason" className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {REJECT_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason} className="cursor-pointer">
                      <span className="block max-w-[350px] text-sm">{reason}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject-notes">Notes *</Label>
              <Textarea
                id="reject-notes"
                placeholder="Enter notes about your decision..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="textarea-reject-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={!decisionReason || !decisionNotes || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
