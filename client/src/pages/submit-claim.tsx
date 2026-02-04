import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestFormData } from "@/lib/queryClient";
import { Car, User, FileText, MapPin, Send, Upload, Sparkles, Loader2, X, Image, AlertTriangle, Lock } from "lucide-react";

const ACCIDENT_TYPES = [
  { value: "Collision", label: "Collision" },
  { value: "Rear-End", label: "Rear-End" },
  { value: "Side Impact", label: "Side Impact" },
  { value: "Rollover", label: "Rollover" },
  { value: "Hit and Run", label: "Hit and Run" },
  { value: "Parking Damage", label: "Parking Damage" },
  { value: "Theft", label: "Theft" },
  { value: "Vandalism", label: "Vandalism" },
  { value: "Fire", label: "Fire" },
  { value: "Flood Damage", label: "Flood Damage" },
];

const submitClaimSchema = z.object({
  claimant_name: z.string().min(1, "Claimant name is required"),
  policy_id: z.string().min(1, "Policy ID is required"),
  num_previous_claims: z.coerce.number().int().min(0),
  total_previous_claims_gbp: z.coerce.number().min(0),
  vehicle_make: z.string().min(1, "Vehicle make is required"),
  vehicle_model: z.string().min(1, "Vehicle model is required"),
  vehicle_year: z.coerce.number().int().min(1900).max(2030),
  vehicle_registration: z.string().min(1, "Registration is required"),
  vehicle_estimated_value_gbp: z.coerce.number().min(0),
  accident_date: z.string().min(1, "Accident date is required"),
  accident_type: z.string().min(1, "Accident type is required"),
  accident_location: z.string().min(1, "Location is required"),
  claim_amount_gbp: z.coerce.number().min(0),
  accident_description: z.string().min(10, "Please provide a detailed description"),
});

type SubmitClaimForm = z.infer<typeof submitClaimSchema>;

interface ExtractedFields {
  [key: string]: any;
  extraction_confidence?: number;
  extraction_notes?: string;
}

export default function SubmitClaim() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [extractedFields, setExtractedFields] = useState<ExtractedFields | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<SubmitClaimForm | null>(null);

  const form = useForm<SubmitClaimForm>({
    resolver: zodResolver(submitClaimSchema),
    defaultValues: {
      claimant_name: "",
      policy_id: "",
      num_previous_claims: 0,
      total_previous_claims_gbp: 0,
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: new Date().getFullYear(),
      vehicle_registration: "",
      vehicle_estimated_value_gbp: 0,
      accident_date: "",
      accident_type: "",
      accident_location: "",
      claim_amount_gbp: 0,
      accident_description: "",
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedFile) {
      toast({
        title: "File Already Uploaded",
        description: "Sorry, only one document per claim entry is allowed. Remove the current file first.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const file = files[0];
    setUploadedFile(file);
    
    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);
    
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiRequestFormData("POST", "/api/extract-fields", formData);
      const extracted = await response.json();
      
      if (extracted.error) {
        toast({
          title: "Extraction Warning",
          description: extracted.error,
          variant: "destructive",
        });
        return;
      }

      setExtractedFields(extracted);

      const fieldMapping: { [key: string]: keyof SubmitClaimForm } = {
        claimant_name: "claimant_name",
        policy_id: "policy_id",
        num_previous_claims: "num_previous_claims",
        total_previous_claims_gbp: "total_previous_claims_gbp",
        vehicle_make: "vehicle_make",
        vehicle_model: "vehicle_model",
        vehicle_year: "vehicle_year",
        vehicle_registration: "vehicle_registration",
        vehicle_estimated_value_gbp: "vehicle_estimated_value_gbp",
        accident_date: "accident_date",
        accident_type: "accident_type",
        accident_location: "accident_location",
        claim_amount_gbp: "claim_amount_gbp",
        accident_description: "accident_description",
      };

      Object.entries(fieldMapping).forEach(([extractedKey, formKey]) => {
        const value = extracted[extractedKey];
        if (value !== null && value !== undefined && value !== "") {
          form.setValue(formKey, value);
        }
      });

      toast({
        title: "Fields Extracted",
        description: `Extracted ${Object.keys(extracted).filter(k => extracted[k] && !k.startsWith('extraction')).length} fields from document. Please review and edit as needed.`,
      });
    } catch (error) {
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract fields from document",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setUploadedFile(null);
    setExtractedFields(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({
      title: "File Removed",
      description: "You can now upload a different document.",
    });
  };

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitClaimForm) => {
      const payload = {
        ...data,
        ai_extracted_fields: extractedFields,
      };
      const response = await apiRequest("POST", "/api/claims", payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Claim Submitted",
        description: "The claim has been submitted and will be analyzed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      navigate(`/claims/${data.claim_id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit claim",
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (data: SubmitClaimForm) => {
    setPendingFormData(data);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    if (pendingFormData) {
      submitMutation.mutate(pendingFormData);
      setShowConfirmModal(false);
    }
  };

  const hasAiValue = (field: string) => {
    return extractedFields && extractedFields[field] !== null && extractedFields[field] !== undefined;
  };

  const isFieldModified = (field: string, currentValue: any) => {
    if (!hasAiValue(field)) return false;
    return String(currentValue) !== String(extractedFields![field]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="page-submit-claim">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Submit New Claim</h1>
        <p className="text-muted-foreground">
          Enter the motor insurance claim details for AI-assisted fraud analysis
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            Document Upload
          </CardTitle>
          <CardDescription>
            Upload a claim document (PDF or image) to automatically extract field values using AI. Only one document per claim.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            data-testid="input-file-upload"
          />
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting || !!uploadedFile}
                className="gap-2"
                data-testid="button-upload"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : uploadedFile ? (
                  <>
                    <Upload className="h-4 w-4" />
                    File Uploaded
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </>
                )}
              </Button>
              
              {uploadedFile && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRemoveFile}
                  className="gap-1"
                  data-testid="button-remove-file"
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            
            {uploadedFile && (
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <p className="font-medium truncate" data-testid="text-filename">{uploadedFile.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <div className="ml-7 mt-1">
                      {uploadedFile.type.startsWith("image/") && (
                        <Badge variant="secondary">
                          <Image className="h-3 w-3 mr-1" />
                          Image
                        </Badge>
                      )}
                      {uploadedFile.type === "application/pdf" && (
                        <Badge variant="secondary">
                          <FileText className="h-3 w-3 mr-1" />
                          PDF
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {filePreviewUrl && (
                  <div className="border rounded-lg overflow-hidden bg-muted/30" data-testid="document-preview">
                    <div className="p-2 border-b bg-muted/50">
                      <p className="text-sm font-medium">Document Preview</p>
                      <p className="text-xs text-muted-foreground">Review the document to verify AI-extracted values</p>
                    </div>
                    {uploadedFile.type.startsWith("image/") ? (
                      <div className="p-4 flex justify-center">
                        <img 
                          src={filePreviewUrl} 
                          alt="Document preview" 
                          className="max-w-full max-h-96 object-contain rounded border"
                          data-testid="image-preview"
                        />
                      </div>
                    ) : uploadedFile.type === "application/pdf" ? (
                      <div className="h-96 w-full">
                        <iframe
                          src={filePreviewUrl}
                          className="w-full h-full"
                          title="PDF Preview"
                          data-testid="pdf-preview"
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

          {extractedFields && (
            <Alert className="mt-4 bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
              <Sparkles className="h-4 w-4 text-cyan-600" />
              <AlertDescription className="text-cyan-800 dark:text-cyan-200">
                AI extracted {Object.keys(extractedFields).filter(k => extractedFields[k] && !k.startsWith('extraction')).length} fields 
                with {((extractedFields.extraction_confidence || 0) * 100).toFixed(0)}% confidence. 
                Fields you edit will be logged in the audit trail.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Claimant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="claimant_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Claimant Name
                      {hasAiValue("claimant_name") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("claimant_name", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" data-testid="input-claimant-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="policy_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Policy ID
                      {hasAiValue("policy_id") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("policy_id", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="POL-2024-001234" data-testid="input-policy-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="num_previous_claims"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous Claims</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" data-testid="input-previous-claims" {...field} />
                    </FormControl>
                    <FormDescription>Number of previous claims</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total_previous_claims_gbp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Previous Claims (GBP)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" data-testid="input-previous-amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="h-5 w-5 text-primary" />
                Vehicle Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="vehicle_make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Make
                      {hasAiValue("vehicle_make") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("vehicle_make", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="BMW" data-testid="input-vehicle-make" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicle_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Model
                      {hasAiValue("vehicle_model") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("vehicle_model", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="3 Series" data-testid="input-vehicle-model" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicle_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2022" data-testid="input-vehicle-year" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicle_registration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Registration
                      {hasAiValue("vehicle_registration") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("vehicle_registration", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="AB12 CDE" data-testid="input-vehicle-reg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicle_estimated_value_gbp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Value (GBP)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="25000" data-testid="input-vehicle-value" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Accident Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="accident_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Accident Date
                        {hasAiValue("accident_date") && (
                          <Badge variant="outline" className="text-xs">
                            {isFieldModified("accident_date", field.value) ? (
                              <span className="text-amber-600">Edited</span>
                            ) : (
                              <span className="text-cyan-600 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> AI
                              </span>
                            )}
                          </Badge>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-accident-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accident_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Accident Type
                        {hasAiValue("accident_type") && (
                          <Badge variant="outline" className="text-xs">
                            {isFieldModified("accident_type", field.value) ? (
                              <span className="text-amber-600">Edited</span>
                            ) : (
                              <span className="text-cyan-600 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> AI
                              </span>
                            )}
                          </Badge>
                        )}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-accident-type">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACCIDENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="accident_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Location
                      {hasAiValue("accident_location") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("accident_location", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="High Street, London" data-testid="input-accident-location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="claim_amount_gbp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Claim Amount (GBP)
                      {hasAiValue("claim_amount_gbp") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("claim_amount_gbp", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000" data-testid="input-claim-amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accident_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Description
                      {hasAiValue("accident_description") && (
                        <Badge variant="outline" className="text-xs">
                          {isFieldModified("accident_description", field.value) ? (
                            <span className="text-amber-600">Edited</span>
                          ) : (
                            <span className="text-cyan-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          )}
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what happened..."
                        className="min-h-24"
                        data-testid="input-accident-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/claims")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="gap-2"
              data-testid="button-submit-claim"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Claim
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Submission
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Important:</strong> You cannot change this claim once submitted. 
                    Please double-check all fields, extracted data, and documents before proceeding.
                  </p>
                </div>
              </div>
              <p className="text-sm">
                The claim will be locked and AI analysis will begin immediately after submission.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              data-testid="button-go-back"
            >
              Go Back
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={submitMutation.isPending}
              className="gap-2"
              data-testid="button-submit-anyway"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Anyway
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
