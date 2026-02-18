import { useAzureAuth } from "@/lib/azureAuth";
import { AlertTriangle, Clock, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function SubscriptionBanner() {
  const { user, subscription } = useAzureAuth();
  const [dismissed, setDismissed] = useState(false);

  // Don't show for legacy users or if dismissed
  if (!user || !subscription || dismissed) return null;

  const status = user.subscription_status;
  const tier = user.subscription_tier;
  const trialDays = subscription?.trial?.days_remaining;
  const isTrialExpired = subscription?.trial?.is_expired;
  const claimsUsed = subscription?.usage?.claims_this_month ?? 0;
  const claimsLimit = subscription?.limits?.max_claims_per_month ?? -1;
  const isNearLimit = claimsLimit > 0 && claimsUsed >= claimsLimit * 0.8;

  // Suspended / cancelled
  if (status === "suspended" || status === "cancelled") {
    return (
      <div className="bg-red-600 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Your subscription is <strong>{status}</strong>. Please contact your
          administrator to restore access.
        </span>
      </div>
    );
  }

  // Trial expired
  if (status === "trial" && isTrialExpired) {
    return (
      <div className="bg-red-600 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Your free trial has expired. Upgrade to continue using the platform.
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-2 h-6 text-xs bg-white text-red-700 hover:bg-red-50"
        >
          <Zap className="h-3 w-3 mr-1" />
          Upgrade Now
        </Button>
      </div>
    );
  }

  // Trial active - show days remaining
  if (status === "trial" && trialDays !== undefined) {
    const urgency = trialDays <= 3 ? "bg-amber-500" : "bg-blue-600";
    return (
      <div
        className={`${urgency} text-white px-4 py-1.5 text-center text-sm flex items-center justify-center gap-2`}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>
          Free trial: <strong>{trialDays} day{trialDays !== 1 ? "s" : ""}</strong> remaining
          {claimsLimit > 0 && (
            <> · {claimsUsed}/{claimsLimit} claims used</>
          )}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-2 h-6 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
        >
          <Zap className="h-3 w-3 mr-1" />
          Upgrade
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 opacity-70 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Near claims limit warning (free tier only)
  if (status === "active" && isNearLimit) {
    return (
      <div className="bg-amber-500 text-white px-4 py-1.5 text-center text-sm flex items-center justify-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>
          {claimsUsed}/{claimsLimit} monthly claims used (Free Tier).
          {claimsUsed >= claimsLimit
            ? " Limit reached — upgrade to Enterprise to continue."
            : " Approaching limit."}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-2 h-6 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
        >
          <Zap className="h-3 w-3 mr-1" />
          Upgrade
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 opacity-70 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
