import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Shield, CheckCircle2, XCircle, Loader2, FileText, Mail, User, Key, Package, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <Shield className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Synapx AI</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Azure Marketplace Activation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 sm:px-8 py-12">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
              <Loader2 className="relative h-16 w-16 text-emerald-600 animate-spin mb-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              Activating Your Subscription
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-center max-w-md text-base">
              Setting up your enterprise account and provisioning resources...
            </p>
          </div>
        )}

        {state === "success" && response && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Success Header */}
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                Subscription Activated
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Your Azure Marketplace purchase is complete
              </p>
            </div>

            {/* Subscription Details Receipt */}
            <div className="max-w-3xl mx-auto">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 px-8 py-6 border-b border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                      <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        Subscription Details
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Microsoft Azure Marketplace
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="p-8">
                  <div className="space-y-6">
                    {/* Customer Information Section */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">
                        Customer Information
                      </h4>
                      <div>
                        {/* Customer Email */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Customer Email
                            </label>
                          </div>
                          <p className="text-base font-medium text-slate-900 dark:text-white">
                            {response.subscription.customer_email || response.organization.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Subscription Details Section */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">
                        Subscription Details
                      </h4>
                      <div className="space-y-4">
                        {/* Subscription ID */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Key className="h-4 w-4 text-slate-400" />
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Subscription ID
                            </label>
                          </div>
                          <p className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-lg">
                            {response.subscription.id}
                          </p>
                        </div>

                        {/* Subscription Name */}
                        {response.subscription.name && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4 text-slate-400" />
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Subscription Name
                              </label>
                            </div>
                            <p className="text-base font-medium text-slate-900 dark:text-white">
                              {response.subscription.name}
                            </p>
                          </div>
                        )}

                        {/* Status Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Status
                              </label>
                            </div>
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 capitalize">
                              {response.organization.subscription_status}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Marketplace Status
                              </label>
                            </div>
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                              {response.subscription.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Plan & Billing Section */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">
                        Plan & Billing
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Offer */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-slate-400" />
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Offer
                            </label>
                          </div>
                          <p className="text-base font-medium text-slate-900 dark:text-white">
                            {response.subscription.offer_id}
                          </p>
                        </div>

                        {/* Plan */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Plan
                            </label>
                          </div>
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 uppercase">
                            {response.subscription.plan_id}
                          </span>
                        </div>

                        {/* Purchaser Email */}
                        {response.subscription.purchaser_email && (
                          <div className="md:col-span-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Mail className="h-4 w-4 text-slate-400" />
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Purchaser Email
                              </label>
                            </div>
                            <p className="text-base font-medium text-slate-900 dark:text-white">
                              {response.subscription.purchaser_email}
                            </p>
                          </div>
                        )}

                        {/* Azure Tenant ID */}
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Key className="h-4 w-4 text-slate-400" />
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Azure Tenant ID
                            </label>
                          </div>
                          <p className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-lg">
                            {response.subscription.azure_tenant_id}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                    Save these details for your records and billing verification
                  </p>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center pt-6">
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-100"
              >
                Sign In to Continue
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Sign in with your Microsoft account to access your dashboard
              </p>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-red-200 dark:border-red-900 overflow-hidden">
              <div className="bg-gradient-to-br from-red-500 to-red-600 px-8 py-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-6">
                  <XCircle className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Activation Failed
                </h2>
                <p className="text-red-50 text-lg">
                  We encountered an issue while activating your subscription
                </p>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300 leading-relaxed">
                    {error}
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">What to do next:</h3>
                  <ul className="space-y-2.5 text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span>Verify the activation link is correct and hasn't expired</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span>Try refreshing the page and attempting activation again</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span>Contact our support team if the issue persists</span>
                    </li>
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                  >
                    Try Again
                  </button>
                  <a
                    href="mailto:support@synapx.ai"
                    className="flex-1 px-6 py-3.5 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-center"
                  >
                    Contact Support
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
