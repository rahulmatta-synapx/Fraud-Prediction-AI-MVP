import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { apiRequest } from "@/lib/queryClient";
import { Car, User, FileText, MapPin, Send } from "lucide-react";

const submitClaimSchema = z.object({
  policyId: z.string().min(1, "Policy ID is required"),
  claimAmount: z.string().min(1, "Claim amount is required").transform(v => parseFloat(v)),
  accidentDate: z.string().min(1, "Accident date is required"),
  accidentLocation: z.string().min(1, "Location is required"),
  accidentType: z.string().min(1, "Accident type is required"),
  accidentDescription: z.string().min(10, "Please provide a detailed description"),
  claimantName: z.string().min(1, "Claimant name is required"),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.string().min(1, "Vehicle year is required").transform(v => parseInt(v)),
  vehicleRegistration: z.string().min(1, "Registration is required"),
  vehicleEstimatedValue: z.string().min(1, "Estimated value is required").transform(v => parseFloat(v)),
  previousClaims: z.string().transform(v => parseInt(v) || 0),
  totalPreviousAmount: z.string().transform(v => parseFloat(v) || 0),
});

type SubmitClaimForm = z.input<typeof submitClaimSchema>;

export default function SubmitClaim() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SubmitClaimForm>({
    resolver: zodResolver(submitClaimSchema),
    defaultValues: {
      policyId: "",
      claimAmount: "",
      accidentDate: "",
      accidentLocation: "",
      accidentType: "",
      accidentDescription: "",
      claimantName: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      vehicleRegistration: "",
      vehicleEstimatedValue: "",
      previousClaims: "0",
      totalPreviousAmount: "0",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitClaimForm) => {
      const parsed = submitClaimSchema.parse(data);
      return apiRequest("POST", "/api/claims", {
        policyId: parsed.policyId,
        claimAmount: parsed.claimAmount,
        accidentDate: new Date(parsed.accidentDate).toISOString(),
        accidentLocation: parsed.accidentLocation,
        accidentType: parsed.accidentType,
        accidentDescription: parsed.accidentDescription,
        claimantName: parsed.claimantName,
        vehicleDetails: {
          make: parsed.vehicleMake,
          model: parsed.vehicleModel,
          year: parsed.vehicleYear,
          registration: parsed.vehicleRegistration,
          estimatedValue: parsed.vehicleEstimatedValue,
        },
        claimantHistory: {
          previousClaims: parsed.previousClaims,
          lastClaimDate: null,
          totalPreviousAmount: parsed.totalPreviousAmount,
        },
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Claim Submitted",
        description: "The claim has been submitted and will be analyzed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      navigate(`/claims/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit claim",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="page-submit-claim">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Submit New Claim</h1>
        <p className="text-muted-foreground">
          Enter the motor insurance claim details for AI-assisted fraud analysis
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => submitMutation.mutate(data))} className="space-y-6">
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
                name="claimantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Claimant Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" data-testid="input-claimant-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="policyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy ID</FormLabel>
                    <FormControl>
                      <Input placeholder="POL-2024-001234" data-testid="input-policy-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="previousClaims"
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
                name="totalPreviousAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Previous Claims (£)</FormLabel>
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
                name="vehicleMake"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl>
                      <Input placeholder="BMW" data-testid="input-vehicle-make" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicleModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="3 Series" data-testid="input-vehicle-model" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicleYear"
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
                name="vehicleRegistration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration</FormLabel>
                    <FormControl>
                      <Input placeholder="AB12 CDE" data-testid="input-vehicle-reg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicleEstimatedValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Value (£)</FormLabel>
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
                  name="accidentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accident Date</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-accident-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accidentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accident Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-accident-type">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="collision">Collision</SelectItem>
                          <SelectItem value="rear_end">Rear-End</SelectItem>
                          <SelectItem value="side_impact">Side Impact</SelectItem>
                          <SelectItem value="rollover">Rollover</SelectItem>
                          <SelectItem value="hit_and_run">Hit and Run</SelectItem>
                          <SelectItem value="parking">Parking Damage</SelectItem>
                          <SelectItem value="theft">Theft</SelectItem>
                          <SelectItem value="vandalism">Vandalism</SelectItem>
                          <SelectItem value="fire">Fire</SelectItem>
                          <SelectItem value="flood">Flood Damage</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="accidentLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="High Street, London" data-testid="input-accident-location" {...field} />
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
                <FileText className="h-5 w-5 text-primary" />
                Claim Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="claimAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Claim Amount (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="5000.00" data-testid="input-claim-amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accidentDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accident Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide a detailed description of the accident, including circumstances, witnesses, and any relevant information..."
                        className="min-h-[120px]"
                        data-testid="textarea-description"
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
              onClick={() => form.reset()}
              data-testid="button-reset"
            >
              Reset Form
            </Button>
            <Button 
              type="submit" 
              disabled={submitMutation.isPending}
              className="gap-2"
              data-testid="button-submit"
            >
              <Send className="h-4 w-4" />
              {submitMutation.isPending ? "Submitting..." : "Submit Claim"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
