import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreDisplay } from "@/components/score-display";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Save,
  Edit3,
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

interface EditedFields {
  claimant_name?: string;
  policy_id?: string;
  num_previous_claims?: number;
  total_previous_claims_gbp?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_registration?: string;
  vehicle_estimated_value_gbp?: number;
  accident_date?: string;
  accident_type?: string;
  accident_location?: string;
  claim_amount_gbp?: number;
  accident_description?: string;
}

const REASON_OPTIONS = [
  { value: "low_risk_confirmed", label: "Low risk confirmed" },
  { value: "evidence_supports", label: "Evidence supports claim" },
  { value: "additional_evidence", label: "Additional evidence provided" },
  { value: "false_positive", label: "False positive detected" },
  { value: "manual_review_complete", label: "Manual review complete" },
  { value: "high_risk_siu_referral", label: "High risk - SIU referral" },
  { value: "insufficient_evidence", label: "Insufficient evidence" },
  { value: "disagree_with_signal", label: "Disagree with AI signal" },
  { value: "other", label: "Other" },
];

const ACCIDENT_TYPES = [
  "Collision", "Rear-End", "Side Impact", "Rollover", "Hit and Run",
  "Parking Damage", "Theft", "Vandalism", "Fire", "Flood Damage"
];

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedFields, setEditedFields] = useState<EditedFields>({});
  const [decisionModal, setDecisionModal] = useState<"approve" | "reject" | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");

  const { data: claim, isLoading, error } = useQuery<Claim>({
    queryKey: ["/api/claims", id],
  });

  const updateFields = useMutation({
    mutationFn: async (fields: EditedFields) => {
      return apiRequest("PATCH", `/api/claims/${id}/fields`, fields);
    },
    onSuccess: () => {
      toast({ title: "Fields updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      setEditedFields({});
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update fields",
        variant: "destructive",
      });
    },
  });

  const rescore = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedFields).length > 0) {
        await apiRequest("PATCH", `/api/claims/${id}/fields`, editedFields);
      }
      return apiRequest("POST", `/api/claims/${id}/rescore`, {});
    },
    onSuccess: () => {
      toast({ title: "Claim rescored successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      setEditedFields({});
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to rescore",
        variant: "destructive",
      });
    },
  });

  const approveClaim = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/claims/${id}/approve`, {
        reason: decisionReason,
        notes: decisionNotes,
      });
    },
    onSuccess: () => {
      toast({ title: "Claim approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      setDecisionModal(null);
      setDecisionReason("");
      setDecisionNotes("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve claim",
        variant: "destructive",
      });
    },
  });

  const rejectClaim = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/claims/${id}/reject`, {
        reason: decisionReason,
        notes: decisionNotes,
      });
    },
    onSuccess: () => {
      toast({ title: "Claim rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      setDecisionModal(null);
      setDecisionReason("");
      setDecisionNotes("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject claim",
        variant: "destructive",
      });
    },
  });

  const handleFieldChange = (field: keyof EditedFields, value: string | number) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
  };

  const getFieldValue = (field: keyof EditedFields): string | number => {
    if (field in editedFields) {
      return editedFields[field] as string | number;
    }
    return claim ? (claim[field] as string | number) : "";
  };

  const hasChanges = Object.keys(editedFields).length > 0;
  const canEdit = claim?.status !== "approved" && claim?.status !== "rejected";
  const canDecide = claim?.status !== "approved" && claim?.status !== "rejected";

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
        <div className="flex gap-3 flex-wrap">
          {canEdit && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(!isEditing)}
                className="gap-2"
                data-testid="button-toggle-edit"
              >
                <Edit3 className="h-4 w-4" />
                {isEditing ? "Cancel Edit" : "Edit Fields"}
              </Button>
              <Button 
                onClick={() => rescore.mutate()}
                disabled={rescore.isPending}
                className="gap-2"
                data-testid="button-save-rescore"
              >
                <RefreshCw className={`h-4 w-4 ${rescore.isPending ? "animate-spin" : ""}`} />
                {hasChanges ? "Save & Rescore" : "Rescore"}
              </Button>
            </>
          )}
          {canDecide && (
            <>
              <Button 
                variant="outline"
                onClick={() => setDecisionModal("reject")}
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                data-testid="button-reject"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button 
                onClick={() => setDecisionModal("approve")}
                className="gap-2 bg-green-600 hover:bg-green-700"
                data-testid="button-approve"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            </>
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
                {isEditing && (
                  <Badge variant="secondary" className="ml-2">Editing</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="claimant_name">Claimant Name</Label>
                      <Input
                        id="claimant_name"
                        value={getFieldValue("claimant_name")}
                        onChange={(e) => handleFieldChange("claimant_name", e.target.value)}
                        data-testid="input-claimant-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="policy_id">Policy ID</Label>
                      <Input
                        id="policy_id"
                        value={getFieldValue("policy_id")}
                        onChange={(e) => handleFieldChange("policy_id", e.target.value)}
                        data-testid="input-policy-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claim_amount">Claim Amount (£)</Label>
                      <Input
                        id="claim_amount"
                        type="number"
                        value={getFieldValue("claim_amount_gbp")}
                        onChange={(e) => handleFieldChange("claim_amount_gbp", parseFloat(e.target.value) || 0)}
                        data-testid="input-claim-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accident_date">Accident Date</Label>
                      <Input
                        id="accident_date"
                        type="date"
                        value={getFieldValue("accident_date")}
                        onChange={(e) => handleFieldChange("accident_date", e.target.value)}
                        data-testid="input-accident-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accident_type">Accident Type</Label>
                      <Select 
                        value={getFieldValue("accident_type") as string}
                        onValueChange={(value) => handleFieldChange("accident_type", value)}
                      >
                        <SelectTrigger data-testid="select-accident-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCIDENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accident_location">Accident Location</Label>
                      <Input
                        id="accident_location"
                        value={getFieldValue("accident_location")}
                        onChange={(e) => handleFieldChange("accident_location", e.target.value)}
                        data-testid="input-accident-location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="num_previous_claims">Previous Claims</Label>
                      <Input
                        id="num_previous_claims"
                        type="number"
                        value={getFieldValue("num_previous_claims")}
                        onChange={(e) => handleFieldChange("num_previous_claims", parseInt(e.target.value) || 0)}
                        data-testid="input-previous-claims"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_previous_claims_gbp">Previous Claims Total (£)</Label>
                      <Input
                        id="total_previous_claims_gbp"
                        type="number"
                        value={getFieldValue("total_previous_claims_gbp")}
                        onChange={(e) => handleFieldChange("total_previous_claims_gbp", parseFloat(e.target.value) || 0)}
                        data-testid="input-previous-claims-total"
                      />
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Car className="h-4 w-4" /> Vehicle Details
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_make">Make</Label>
                        <Input
                          id="vehicle_make"
                          value={getFieldValue("vehicle_make")}
                          onChange={(e) => handleFieldChange("vehicle_make", e.target.value)}
                          data-testid="input-vehicle-make"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_model">Model</Label>
                        <Input
                          id="vehicle_model"
                          value={getFieldValue("vehicle_model")}
                          onChange={(e) => handleFieldChange("vehicle_model", e.target.value)}
                          data-testid="input-vehicle-model"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_year">Year</Label>
                        <Input
                          id="vehicle_year"
                          type="number"
                          value={getFieldValue("vehicle_year")}
                          onChange={(e) => handleFieldChange("vehicle_year", parseInt(e.target.value) || 0)}
                          data-testid="input-vehicle-year"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_registration">Registration</Label>
                        <Input
                          id="vehicle_registration"
                          value={getFieldValue("vehicle_registration")}
                          onChange={(e) => handleFieldChange("vehicle_registration", e.target.value)}
                          data-testid="input-vehicle-registration"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_estimated_value_gbp">Estimated Value (£)</Label>
                        <Input
                          id="vehicle_estimated_value_gbp"
                          type="number"
                          value={getFieldValue("vehicle_estimated_value_gbp")}
                          onChange={(e) => handleFieldChange("vehicle_estimated_value_gbp", parseFloat(e.target.value) || 0)}
                          data-testid="input-vehicle-value"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accident_description">Accident Description</Label>
                    <Textarea
                      id="accident_description"
                      value={getFieldValue("accident_description")}
                      onChange={(e) => handleFieldChange("accident_description", e.target.value)}
                      rows={4}
                      data-testid="input-accident-description"
                    />
                  </div>
                  {hasChanges && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        You have unsaved changes. Click "Save & Rescore" to save changes and recalculate the fraud score.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}
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

          {claim.decided_by && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {claim.status === "approved" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-semibold ${claim.status === "approved" ? "text-green-600" : "text-red-600"}`}>
                    {claim.status === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">By:</span> {claim.decided_by}</p>
                  {claim.decided_at && (
                    <p><span className="text-muted-foreground">On:</span> {format(new Date(claim.decided_at), "dd MMM yyyy 'at' HH:mm")}</p>
                  )}
                  {claim.decision_reason && (
                    <p>
                      <span className="text-muted-foreground">Reason:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {claim.decision_reason.replace(/_/g, " ")}
                      </Badge>
                    </p>
                  )}
                </div>
                {claim.decision_notes && (
                  <p className="text-sm italic text-muted-foreground border-t pt-2 mt-2">
                    "{claim.decision_notes}"
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="p-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Quick Actions</h4>
              <Link href="/help">
                <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                  <AlertTriangle className="h-4 w-4" />
                  View Rules Guide
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={decisionModal !== null} onOpenChange={() => setDecisionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decisionModal === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Approve Claim
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Reject Claim
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {decisionModal === "approve"
                ? "Confirm you want to approve this claim. This action will be logged."
                : "Confirm you want to reject this claim. This action will be logged."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="decision-reason">Reason (required)</Label>
              <Select value={decisionReason} onValueChange={setDecisionReason}>
                <SelectTrigger id="decision-reason" data-testid="select-decision-reason">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="decision-notes">Notes (required)</Label>
              <Textarea
                id="decision-notes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Enter your notes explaining this decision..."
                rows={3}
                data-testid="input-decision-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionModal(null)}>
              Cancel
            </Button>
            {decisionModal === "approve" ? (
              <Button 
                onClick={() => approveClaim.mutate()}
                disabled={!decisionReason || !decisionNotes.trim() || approveClaim.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-confirm-approve"
              >
                {approveClaim.isPending ? "Approving..." : "Approve Claim"}
              </Button>
            ) : (
              <Button 
                onClick={() => rejectClaim.mutate()}
                disabled={!decisionReason || !decisionNotes.trim() || rejectClaim.isPending}
                variant="destructive"
                data-testid="button-confirm-reject"
              >
                {rejectClaim.isPending ? "Rejecting..." : "Reject Claim"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
