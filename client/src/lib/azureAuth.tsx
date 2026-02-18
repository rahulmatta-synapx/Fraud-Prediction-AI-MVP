import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus, AccountInfo } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface AzureUser {
  username: string;
  full_name: string;
  email: string;
  org_id: string;
  org_name: string;
  role: string;
  subscription_status: string;
  subscription_tier: string;
  trial_days_remaining?: number;
  claims_this_month?: number;
  max_claims_per_month?: number;
}

interface AzureAuthContextType {
  user: AzureUser | null;
  token: string | null;
  login: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscription: any | null;
}

const AzureAuthContext = createContext<AzureAuthContextType | null>(null);

export function AzureAuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isMsalAuthenticated = useIsAuthenticated();
  const [user, setUser] = useState<AzureUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasValidated, setHasValidated] = useState(false);

  // Validate token with our backend and get user info
  const validateWithBackend = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/azure-ad/validate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Backend validation failed:", errorData);
        throw new Error(errorData.detail || "Token validation failed");
      }

      const data = await response.json();
      const sub = data.subscription || null;

      const azureUser: AzureUser = {
        username: data.user.email || data.user.username,
        full_name: data.user.full_name,
        email: data.user.email,
        org_id: data.user.org_id,
        org_name: data.user.organization?.org_name || "Unknown Organization",
        role: data.user.role,
        subscription_status: data.user.organization?.subscription_status || "active",
        subscription_tier: data.user.organization?.subscription_tier || "free",
        trial_days_remaining: sub?.trial?.days_remaining,
        claims_this_month: sub?.usage?.claims_this_month,
        max_claims_per_month: sub?.limits?.max_claims_per_month,
      };

      setUser(azureUser);
      setToken(accessToken);
      setSubscription(sub);
      localStorage.setItem("fraud_guard_token", accessToken);
      localStorage.setItem("fraud_guard_user", JSON.stringify(azureUser));
      if (sub) localStorage.setItem("fraud_guard_subscription", JSON.stringify(sub));

      return azureUser;
    } catch (error) {
      console.error("Backend validation error:", error);
      // Clear any stale state
      setUser(null);
      setToken(null);
      setSubscription(null);
      localStorage.removeItem("fraud_guard_token");
      localStorage.removeItem("fraud_guard_user");
      localStorage.removeItem("fraud_guard_subscription");
      throw error;
    }
  }, []);

  // Acquire token silently and validate with backend
  const acquireAndValidateToken = useCallback(async (account: AccountInfo) => {
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });

      if (response.idToken) {
        await validateWithBackend(response.idToken);
        setHasValidated(true);
      }
    } catch (error) {
      console.error("Silent token acquisition failed:", error);
      // Don't throw — user will need to log in again
      setUser(null);
      setToken(null);
      setSubscription(null);
      localStorage.removeItem("fraud_guard_token");
      localStorage.removeItem("fraud_guard_user");
      localStorage.removeItem("fraud_guard_subscription");
    }
  }, [instance, validateWithBackend]);

  // On mount: if MSAL has an account, silently acquire token and validate
  useEffect(() => {
    const initAuth = async () => {
      // Wait for MSAL to finish any in-progress interactions
      if (inProgress !== InteractionStatus.None) return;

      if (accounts.length > 0 && !hasValidated) {
        await acquireAndValidateToken(accounts[0]);
      } else if (accounts.length === 0) {
        // No MSAL account — check for legacy token
        const savedToken = localStorage.getItem("fraud_guard_token");
        const savedUser = localStorage.getItem("fraud_guard_user");
        const savedSub = localStorage.getItem("fraud_guard_subscription");
        if (savedToken && savedUser) {
          try {
            setUser(JSON.parse(savedUser));
            setToken(savedToken);
            if (savedSub) setSubscription(JSON.parse(savedSub));
          } catch {
            localStorage.removeItem("fraud_guard_token");
            localStorage.removeItem("fraud_guard_user");
            localStorage.removeItem("fraud_guard_subscription");
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [accounts, inProgress, hasValidated, acquireAndValidateToken]);

  const login = useCallback(async () => {
    try {
      const result = await instance.loginPopup(loginRequest);

      if (result.idToken) {
        await validateWithBackend(result.idToken);
        setHasValidated(true);
      }
    } catch (error: any) {
      // User cancelled or error
      if (error.errorCode === "user_cancelled") {
        console.log("User cancelled login");
        return;
      }
      console.error("Login error:", error);
      throw error;
    }
  }, [instance, validateWithBackend]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setSubscription(null);
    setHasValidated(false);
    localStorage.removeItem("fraud_guard_token");
    localStorage.removeItem("fraud_guard_user");
    localStorage.removeItem("fraud_guard_subscription");

    // Clear all MSAL cached accounts before logout popup
    const allAccounts = instance.getAllAccounts();
    allAccounts.forEach((acct) => {
      instance.setActiveAccount(null);
    });

    instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin,
    }).then(() => {
      // After popup closes, clear any remaining browser storage entries
      instance.clearCache();
    }).catch((e) => {
      console.error("Logout error:", e);
      // Fallback: force-clear MSAL cache even if popup fails
      try { instance.clearCache(); } catch { /* ignore */ }
    });
  }, [instance]);

  return (
    <AzureAuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading: isLoading || inProgress !== InteractionStatus.None,
        subscription,
      }}
    >
      {children}
    </AzureAuthContext.Provider>
  );
}

export function useAzureAuth() {
  const context = useContext(AzureAuthContext);
  if (!context) {
    throw new Error("useAzureAuth must be used within an AzureAuthProvider");
  }
  return context;
}

export function getAzureAuthToken(): string | null {
  return localStorage.getItem("fraud_guard_token");
}
