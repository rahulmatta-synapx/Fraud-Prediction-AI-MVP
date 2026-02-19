import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Key,
  Package,
  ArrowRight,
  Copy,
  Check,
  Building2,
  CreditCard,
  RefreshCw,
  LifeBuoy,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

type LandingState = "loading" | "success" | "error";

interface OrgResult {
  org_id: string;
  org_name: string;
  subscription_tier: string;
  subscription_status: string;
  email: string;
}

interface SubscriptionResult {
  id: string;
  name: string;
  status: string;
  offer_id: string;
  plan_id: string;
  customer_email: string;
  purchaser_email: string;
  azure_tenant_id: string;
}

interface ActivationResponse {
  status: string;
  message: string;
  organization: OrgResult;
  subscription: SubscriptionResult;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="ml-2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-slate-400" />
      )}
    </button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  badge,
  badgeColor,
}: {
  icon?: any;
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
  badgeColor?: string;
}) {
  if (!value) return null;

  const colorMap: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
    purple: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20",
  };

  return (
    <div className="flex items-start justify-between py-3.5 gap-4">
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {Icon && <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />}
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-1 min-w-0 text-right">
        {badge ? (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset capitalize ${colorMap[badgeColor || "green"]}`}>
            {value}
          </span>
        ) : mono ? (
          <>
            <code className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all">
              {value}
            </code>
            <CopyButton text={value} />
          </>
        ) : (
          <span className="text-sm font-medium text-slate-900 dark:text-white break-all">
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MarketplaceLanding() {
  const [state, setState] = useState<LandingState>("loading");
  const [response, setResponse] = useState<ActivationResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setState("error");
      setError("No marketplace token provided. Please use the link from Azure Marketplace.");
      return;
    }

    activateSubscription(token);
  }, []);

  async function activateSubscription(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations/marketplace/landing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Activation failed (${response.status})`);
      }

      const data: ActivationResponse = await response.json();
      setResponse(data);
      setState("success");
    } catch (err: any) {
      setState("error");
      setError(err.message || "Something went wrong during activation.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-y-auto">
      {/* Top bar */}
      <div className="border-b border-slate-200/60 dark:border-slate-800 backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
              <Shield className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Fraud Prediction AI</h1>
          </div>
          <span className="text-sm font-medium text-slate-400 dark:text-slate-500 hidden sm:block">
            Azure Marketplace
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 sm:py-16">
        {/* ── Loading State ── */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-emerald-400/20 dark:bg-emerald-400/10 blur-2xl rounded-full scale-150" />
              <div className="relative p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-lg shadow-emerald-500/10 ring-1 ring-slate-200 dark:ring-slate-700">
                <Loader2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Activating your subscription
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
              We're setting up your enterprise account. This usually takes just a few seconds.
            </p>
          </div>
        )}

        {/* ── Success State ── */}
        {state === "success" && response && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Success banner */}
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 ring-1 ring-emerald-200 dark:ring-emerald-500/20 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 shrink-0">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
                    Purchase confirmed
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Your Azure Marketplace subscription has been activated. Review the details below, then sign in with Microsoft to access your dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Main details card */}
            <div className="rounded-2xl bg-white dark:bg-slate-800/50 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700/50 overflow-hidden">
              {/* Organization header */}
              <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-0">
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    <Building2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                      {response.organization.org_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {response.subscription.customer_email || response.organization.email}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 capitalize">
                      {response.organization.subscription_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="px-6 sm:px-8"><div className="border-b border-slate-100 dark:border-slate-700/50 mt-5" /></div>

              {/* Subscription info */}
              <div className="px-6 sm:px-8 py-1">
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  <DetailRow icon={Key} label="Subscription ID" value={response.subscription.id} mono />
                  {response.subscription.name && (
                    <DetailRow icon={Package} label="Subscription" value={response.subscription.name} />
                  )}
                  <DetailRow icon={CreditCard} label="Offer" value={response.subscription.offer_id} />
                  <DetailRow label="Plan" value={response.subscription.plan_id} badge badgeColor="purple" />
                  <DetailRow label="Marketplace Status" value={response.subscription.status} badge badgeColor="blue" />
                  {response.subscription.purchaser_email && (
                    <DetailRow icon={Mail} label="Purchaser" value={response.subscription.purchaser_email} />
                  )}
                  <DetailRow icon={Building2} label="Tenant ID" value={response.subscription.azure_tenant_id} mono />
                </div>
              </div>

              {/* Card footer */}
              <div className="bg-slate-50 dark:bg-slate-800/80 px-6 sm:px-8 py-3.5 border-t border-slate-100 dark:border-slate-700/50">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Save these details for your records · Billing managed through Azure Portal
                </p>
              </div>
            </div>

            {/* Next steps */}
            <div className="rounded-2xl bg-white dark:bg-slate-800/50 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700/50 p-6 sm:p-8">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Next steps
              </h4>
              <div className="grid gap-3">
                {[
                  { step: "1", text: "Sign in with your Microsoft account to access the dashboard" },
                  { step: "2", text: "Configure your organization settings and invite team members" },
                  { step: "3", text: "Start submitting claims for AI-powered fraud analysis" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold shrink-0 mt-0.5">
                      {item.step}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col items-center gap-3 pt-2 pb-4">
              <button
                onClick={() => navigate("/login")}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                Sign in with Microsoft
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Enterprise SSO powered by Azure AD
              </span>
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {state === "error" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-xl mx-auto">
            {/* Error banner */}
            <div className="rounded-2xl bg-red-50 dark:bg-red-500/5 ring-1 ring-red-200 dark:ring-red-500/20 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-500/10 shrink-0">
                  <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
                    Activation failed
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    We couldn't activate your subscription. Here's what happened:
                  </p>
                </div>
              </div>
            </div>

            {/* Error detail */}
            <div className="rounded-2xl bg-white dark:bg-slate-800/50 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700/50 overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-slate-100 dark:border-slate-700/50">
                <code className="text-sm text-red-600 dark:text-red-400 leading-relaxed">
                  {error}
                </code>
              </div>
              <div className="px-6 sm:px-8 py-5">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Try these steps
                </h4>
                <ul className="space-y-2.5">
                  {[
                    "Verify the activation link is correct and hasn't expired",
                    "Refresh this page and try again",
                    "Contact support if the problem continues",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <a
                href="mailto:support@synapx.ai"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                <LifeBuoy className="h-4 w-4" />
                Contact Support
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
