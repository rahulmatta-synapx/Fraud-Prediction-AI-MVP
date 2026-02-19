import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Shield, CheckCircle2, XCircle, Loader2, Building2, CreditCard, User, Mail, Key } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

type LandingState = "loading" | "success" | "error";

interface OrgResult {
  org_id: string;
  org_name: string;
  subscription_tier: string;
  subscription_status: string;
}

interface SubscriptionResult {
  id: string;
  name: string;
  status: string;
  offer_id: string;
  plan_id: string;
  customer_email: string;
  customer_object_id: string;
  customer_tenant_id: string;
  purchaser_email: string;
  purchaser_object_id: string;
  purchaser_tenant_id: string;
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Synapx AI</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Azure Marketplace Activation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-16 w-16 text-emerald-600 animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Activating Your Subscription
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
              We're setting up your enterprise account and provisioning your resources. This will only take a moment.
            </p>
          </div>
        )}

        {state === "success" && response && (
          <div className="space-y-8">
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-lg overflow-hidden">
              <div className="px-8 py-10 text-center">
                <CheckCircle2 className="h-16 w-16 text-white mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-2">
                  Subscription Successfully Activated!
                </h2>
                <p className="text-emerald-50 text-lg">
                  Your organization is now ready to use Synapx AI
                </p>
              </div>
            </div>

            {/* Organization & Subscription Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Organization Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 px-6 py-4 border-b border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                    <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                      Organization Details
                    </h3>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Organization Name
                    </label>
                    <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">
                      {response.organization.org_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Subscription Plan
                    </label>
                    <p className="mt-1">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 uppercase">
                        {response.organization.subscription_tier}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Status
                    </label>
                    <p className="mt-1">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 capitalize">
                        {response.organization.subscription_status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Organization ID
                    </label>
                    <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300 break-all">
                      {response.organization.org_id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscription Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 px-6 py-4 border-b border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Azure Subscription
                    </h3>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Subscription ID
                    </label>
                    <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300 break-all">
                      {response.subscription.id}
                    </p>
                  </div>
                  {response.subscription.name && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Subscription Name
                      </label>
                      <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">
                        {response.subscription.name}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Marketplace Status
                    </label>
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {response.subscription.status}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Offer ID
                      </label>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {response.subscription.offer_id}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Plan ID
                      </label>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {response.subscription.plan_id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer & Purchaser Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 px-6 py-4 border-b border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                    <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                      Customer Details
                    </h3>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {response.subscription.customer_email && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Email Address
                      </label>
                      <p className="mt-1 text-base text-slate-900 dark:text-white">
                        {response.subscription.customer_email}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      Azure Tenant ID
                    </label>
                    <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300 break-all">
                      {response.subscription.customer_tenant_id}
                    </p>
                  </div>
                  {response.subscription.customer_object_id && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Object ID
                      </label>
                      <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300 break-all">
                        {response.subscription.customer_object_id}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Purchaser Card */}
              {response.subscription.purchaser_email && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 px-6 py-4 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                      <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                        Purchaser Details
                      </h3>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Email Address
                      </label>
                      <p className="mt-1 text-base text-slate-900 dark:text-white">
                        {response.subscription.purchaser_email}
                      </p>
                    </div>
                    {response.subscription.purchaser_tenant_id && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <Key className="h-3 w-3" />
                          Azure Tenant ID
                        </label>
                        <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300 break-all">
                          {response.subscription.purchaser_tenant_id}
                        </p>
                      </div>
                    )}
                    {response.subscription.purchaser_object_id && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Object ID
                        </label>
                        <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300 break-all">
                          {response.subscription.purchaser_object_id}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Next Steps Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-8 py-6 text-center space-y-4">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Ready to Get Started?
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                  Your organization has been successfully activated. Sign in with your Microsoft account to access the Synapx AI dashboard and start detecting fraud with advanced AI.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
                >
                  Continue to Dashboard
                  <Shield className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-red-200 dark:border-red-900 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-10 text-center">
                <XCircle className="h-16 w-16 text-white mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-2">
                  Activation Failed
                </h2>
                <p className="text-red-50">
                  We encountered an issue while activating your subscription
                </p>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    {error}
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white">What to do next:</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li>Verify the activation link is correct and hasn't expired</li>
                    <li>Try refreshing the page and attempting activation again</li>
                    <li>Contact our support team if the issue persists</li>
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                  <a
                    href="mailto:support@synapx.ai"
                    className="flex-1 px-6 py-3 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center"
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
