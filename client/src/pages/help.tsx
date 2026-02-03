import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Book, 
  Scale, 
  Brain, 
  FileText, 
  History, 
  AlertTriangle,
  Shield,
  Clock,
  MapPin,
  User,
  Users,
  ChevronRight
} from "lucide-react";

interface RuleInfo {
  id: string;
  name: string;
  description: string;
  weight: number;
  category: string;
  trigger: string;
}

const RULES: RuleInfo[] = [
  {
    id: "late_notification",
    name: "Late Notification",
    description: "Claim submitted more than 14 days after incident",
    weight: 20,
    category: "Claim Timing",
    trigger: "Claim submission date - Incident date > 14 days"
  },
  {
    id: "suspicious_timing",
    name: "Suspicious Timing",
    description: "Claim submitted between 11pm and 5am",
    weight: 10,
    category: "Claim Timing",
    trigger: "Claim submitted between 23:00 and 05:00"
  },
  {
    id: "early_policy_claim",
    name: "Early Policy Claim",
    description: "Claim filed on a new policy within 7 days of incident",
    weight: 30,
    category: "Policyholder Behaviour",
    trigger: "New policy (0 previous claims) with incident within 7 days of policy start"
  },
  {
    id: "frequent_claimant",
    name: "Frequent Claimant",
    description: "More than 2 previous claims in last 12 months",
    weight: 25,
    category: "Policyholder Behaviour",
    trigger: "Number of previous claims > 2"
  },
  {
    id: "vague_location",
    name: "Vague Location",
    description: "Incident location is missing or vague",
    weight: 15,
    category: "Location & Circumstance",
    trigger: "Location is NULL or contains vague terms ('near home', 'local road', etc.)"
  },
  {
    id: "unusual_location",
    name: "Unusual Location",
    description: "Accident location appears far from policyholder's usual area",
    weight: 20,
    category: "Location & Circumstance",
    trigger: "Accident location > 100 miles from policyholder address"
  },
  {
    id: "description_mismatch",
    name: "Description Mismatch",
    description: "Damage description contradicts the stated accident type",
    weight: 30,
    category: "Document Consistency",
    trigger: "Damage description contradicts accident type (e.g., rear damage + 'head-on collision')"
  },
  {
    id: "invalid_document_timeline",
    name: "Invalid Document Timeline",
    description: "Document dates appear before incident date",
    weight: 25,
    category: "Document Consistency",
    trigger: "Repair invoice date < Incident date"
  },
  {
    id: "repeat_third_party",
    name: "Repeat Third Party",
    description: "Same third party appears in multiple claims",
    weight: 40,
    category: "Third-Party Patterns",
    trigger: "Same third party in > 2 claims across different policies"
  },
  {
    id: "professional_witness",
    name: "Professional Witness",
    description: "Witness name matches witnesses from previous claims",
    weight: 35,
    category: "Third-Party Patterns",
    trigger: "Witness name matches previous claims"
  },
];

const CATEGORY_ICONS: { [key: string]: typeof Clock } = {
  "Claim Timing": Clock,
  "Policyholder Behaviour": User,
  "Location & Circumstance": MapPin,
  "Document Consistency": FileText,
  "Third-Party Patterns": Users,
};

const CATEGORY_COLORS: { [key: string]: string } = {
  "Claim Timing": "bg-blue-50 dark:bg-blue-950 text-blue-600",
  "Policyholder Behaviour": "bg-purple-50 dark:bg-purple-950 text-purple-600",
  "Location & Circumstance": "bg-green-50 dark:bg-green-950 text-green-600",
  "Document Consistency": "bg-amber-50 dark:bg-amber-950 text-amber-600",
  "Third-Party Patterns": "bg-red-50 dark:bg-red-950 text-red-600",
};

export default function HelpPage() {
  const groupedRules = RULES.reduce((acc, rule) => {
    if (!acc[rule.category]) {
      acc[rule.category] = [];
    }
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, RuleInfo[]>);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8" data-testid="page-help">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Book className="h-8 w-8 text-primary" />
          How Fraud Prediction Works
        </h1>
        <p className="text-muted-foreground text-lg">
          A comprehensive guide to understanding the fraud prediction system
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800 rounded-lg">
            <p className="font-medium text-cyan-800 dark:text-cyan-200">
              This is a helper tool only — AI suggests risk score, human decides
            </p>
          </div>
          <p>
            The FraudGuard AI system is designed to assist human fraud analysts in evaluating 
            motor insurance claims. The system provides risk score recommendations based on 
            configurable rules and AI-detected patterns, but <strong>all final decisions are 
            made by qualified human investigators</strong>.
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>AI provides recommendations only — humans make all final decisions</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>Score overrides require mandatory reason and notes for audit compliance</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>All changes are logged in an immutable audit trail</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>Neutral, non-judgmental language in AI analysis</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Fraud Detection Rules
          </CardTitle>
          <CardDescription>
            The system uses 10 configurable rules to evaluate claims. Each rule has a trigger 
            condition and a weight that contributes to the overall fraud score.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(groupedRules).map(([category, rules]) => {
            const IconComponent = CATEGORY_ICONS[category] || AlertTriangle;
            const colorClass = CATEGORY_COLORS[category] || "bg-muted text-muted-foreground";
            
            return (
              <div key={category} className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <div className={`p-1.5 rounded ${colorClass}`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  {category}
                </h3>
                <div className="space-y-2 pl-8">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className="p-3 border rounded-lg space-y-1"
                      data-testid={`rule-${rule.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{rule.name}</p>
                        <Badge variant="secondary">+{rule.weight} points</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                      <p className="text-xs text-muted-foreground italic">
                        Trigger: {rule.trigger}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Score Calculation & Risk Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">How the Score is Calculated</h3>
            <p className="text-muted-foreground mb-4">
              The fraud score is calculated by summing the weights of all triggered rules. 
              The maximum possible score is capped at 100.
            </p>
            <div className="p-4 bg-muted rounded-lg font-mono text-sm">
              Fraud_Score = SUM(triggered rule weights), capped at 100
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Risk Thresholds & Recommended Actions</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-semibold text-green-700 dark:text-green-300">Low Risk</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-1">&lt; 30</p>
                <p className="text-sm text-green-600 dark:text-green-400">Auto-approve</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Claims with minimal risk indicators may proceed with minimal review
                </p>
              </div>
              
              <div className="p-4 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-semibold text-amber-700 dark:text-amber-300">Medium Risk</span>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mb-1">30 - 60</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">Manual review</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Claims require human analyst review before processing
                </p>
              </div>
              
              <div className="p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-semibold text-red-700 dark:text-red-300">High Risk</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300 mb-1">&gt; 60</p>
                <p className="text-sm text-red-600 dark:text-red-400">SIU referral</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Claims should be referred to the Special Investigation Unit
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Document Extraction (AI Auto-Fill)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            When you upload a document (PDF or image) during claim submission, the AI will 
            attempt to extract relevant information and auto-fill the form fields.
          </p>
          <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Important: Always review and verify AI-extracted values
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Fields auto-filled by AI are marked with an "AI" badge. If you edit an AI-extracted 
              value, it will be flagged as "Edited" and logged in the audit trail.
            </p>
          </div>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>Only one document per claim is allowed</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>Supported formats: PDF, PNG, JPG, JPEG</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>Extraction confidence is displayed after processing</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-1 text-primary" />
              <span>Human review and editing is always required before submission</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Audit Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            All actions on claims are tracked in an immutable audit trail. This ensures 
            full accountability and compliance with regulatory requirements.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium">Tracked actions include:</h4>
            <ul className="grid gap-2 md:grid-cols-2">
              <li className="flex items-center gap-2 p-2 border rounded">
                <Badge variant="outline">CLAIM_CREATED</Badge>
                <span className="text-sm">New claim submission</span>
              </li>
              <li className="flex items-center gap-2 p-2 border rounded">
                <Badge variant="outline">SCORE_GENERATED</Badge>
                <span className="text-sm">AI scoring completed</span>
              </li>
              <li className="flex items-center gap-2 p-2 border rounded">
                <Badge variant="outline">OVERRIDE</Badge>
                <span className="text-sm">Score manually changed</span>
              </li>
              <li className="flex items-center gap-2 p-2 border rounded">
                <Badge variant="outline">FIELD_EDIT</Badge>
                <span className="text-sm">AI-extracted value edited</span>
              </li>
              <li className="flex items-center gap-2 p-2 border rounded">
                <Badge variant="outline">STATUS_CHANGE</Badge>
                <span className="text-sm">Claim status updated</span>
              </li>
              <li className="flex items-center gap-2 p-2 border rounded">
                <Badge variant="outline">DOCUMENT_UPLOADED</Badge>
                <span className="text-sm">Document attached</span>
              </li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">
            Each log entry includes: timestamp, user name, action type, old value, new value, 
            and notes (where applicable). Override actions require a mandatory reason category 
            and notes explaining the decision.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
