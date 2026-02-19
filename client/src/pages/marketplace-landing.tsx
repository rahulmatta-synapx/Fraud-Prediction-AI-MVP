import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Shield, CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-8 text-center">
          <Shield className="h-12 w-12 text-white mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Synapx AI</h1>
          <p className="text-emerald-100 text-sm mt-1">Azure Marketplace Activation</p>
        </div>

        {/* Body */}
        <div className="px-6 py-8 text-center">
          {state === "loading" && (
            <div className="space-y-4">
              <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto" />
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                Activating your subscription…
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We're setting up your enterprise account. This only takes a moment.
              </p>
            </div>
          )}

          {state === "success" && response && (
            <div className="space-y-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Subscription Activated!
              </h2>
              
              {/* Organization Details */}
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-4 space-y-2 text-left">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Organization
                </h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Name</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {response.organization.org_name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Plan</span>
                    <span className="font-medium text-emerald-600 uppercase">
                      {response.organization.subscription_tier}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Status</span>
                    <span className="font-medium text-emerald-600 capitalize">
                      {response.organization.subscription_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Subscription Details */}
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 space-y-2 text-left">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Azure Marketplace Subscription
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Subscription ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 break-all">
                      {response.subscription.id}
                    </span>
                  </div>
                  {response.subscription.name && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-slate-600 dark:text-slate-400">Name</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {response.subscription.name}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Status</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {response.subscription.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Offer</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {response.subscription.offer_id}
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Plan</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {response.subscription.plan_id}
                    </span>
                  </div>
                  
                  <div className="border-t border-slate-200 dark:border-slate-600 my-2 pt-2">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">Customer</span>
                  </div>
                  
                  {response.subscription.customer_email && (
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-slate-600 dark:text-slate-400">Email</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {response.subscription.customer_email}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Tenant ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 break-all">
                      {response.subscription.customer_tenant_id}
                    </span>
                  </div>
                  
                  {response.subscription.purchaser_email && 
                   response.subscription.purchaser_email !== response.subscription.customer_email && (
                    <>
                      <div className="border-t border-slate-200 dark:border-slate-600 my-2 pt-2">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Purchaser</span>
                      </div>
                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <span className="text-slate-600 dark:text-slate-400">Email</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {response.subscription.purchaser_email}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sign in with your Microsoft account to start using Synapx AI.
              </p>
              <button
                onClick={() => navigate("/")}
                className="w-full mt-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              >
                Continue to Dashboard
              </button>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-4">
              <XCircle className="h-12 w-12 text-red-500 mx-auto" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Activation Failed
              </h2>
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                {error}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Please contact support at{" "}
                <a href="mailto:support@synapx.com" className="text-emerald-600 underline">
                  support@synapx.com
                </a>{" "}
                if the problem persists.
              </p>
              <button
                onClick={() => navigate("/")}
                className="w-full mt-2 px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
