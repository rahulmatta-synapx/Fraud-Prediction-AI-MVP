import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { overrideInputSchema, type OverrideInput } from "@shared/schema";
import { AlertTriangle, Edit3, Save } from "lucide-react";

interface OverrideFormProps {
  claimId: number;
  currentScore: number | null;
  onSuccess?: () => void;
}

const reasonOptions = [
  { value: "false_positive", label: "False Positive" },
  { value: "additional_evidence", label: "Additional Evidence" },
  { value: "disagree_with_signal", label: "Disagree with Signal" },
  { value: "manual_review_complete", label: "Manual Review Complete" },
  { value: "other", label: "Other" },
] as const;

export function OverrideForm({ claimId, currentScore, onSuccess }: OverrideFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OverrideInput>({
    resolver: zodResolver(overrideInputSchema),
    defaultValues: {
      newScore: currentScore ?? 50,
      reasonCategory: undefined,
      notes: "",
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (data: OverrideInput) => {
      return apiRequest("POST", `/api/claims/${claimId}/override`, data);
    },
    onSuccess: () => {
      toast({
        title: "Score Updated",
        description: "The risk score has been successfully overridden.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", claimId] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      setIsOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to override score",
        variant: "destructive",
      });
    },
  });

  const watchedScore = form.watch("newScore");

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-risk-high";
    if (score >= 40) return "text-risk-medium";
    return "text-risk-low";
  };

  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="gap-2"
        data-testid="button-open-override"
      >
        <Edit3 className="h-4 w-4" />
        Override Score
      </Button>
    );
  }

  return (
    <Card className="border-primary/20" data-testid="form-override">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Override Risk Score</CardTitle>
        </div>
        <CardDescription>
          As the investigator, you can adjust the AI-suggested score. All changes are logged for audit purposes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => overrideMutation.mutate(data))} className="space-y-6">
            <FormField
              control={form.control}
              name="newScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Score</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">0 (Low Risk)</span>
                        <span className={`text-2xl font-bold ${getScoreColor(watchedScore)}`}>
                          {watchedScore}
                        </span>
                        <span className="text-sm text-muted-foreground">100 (High Risk)</span>
                      </div>
                      <Slider
                        value={[field.value]}
                        onValueChange={(v) => field.onChange(v[0])}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                        data-testid="slider-score"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reasonCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Override</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-reason">
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reasonOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Required)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide details about why you're overriding this score..."
                      className="resize-none min-h-[100px]"
                      data-testid="textarea-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  form.reset();
                }}
                data-testid="button-cancel-override"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={overrideMutation.isPending}
                className="gap-2"
                data-testid="button-submit-override"
              >
                <Save className="h-4 w-4" />
                {overrideMutation.isPending ? "Saving..." : "Save Override"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
