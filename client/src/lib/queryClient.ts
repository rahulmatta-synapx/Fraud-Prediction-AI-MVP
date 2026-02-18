import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "./auth";
import { getAzureAuthToken } from "./azureAuth";

/**
 * FIX: Use the Environment Variable we set up in the YAML and Azure Portal.
 * It will fallback to an empty string if we want to use relative paths, 
 * but for your current Azure setup, it ensures requests hit the App Service.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Session expiry handler - will be set by the app
let sessionExpiredHandler: (() => void) | null = null;
// Subscription blocked handler - will be set by the app
let subscriptionBlockedHandler: ((message: string) => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

export function setSubscriptionBlockedHandler(handler: (message: string) => void) {
  subscriptionBlockedHandler = handler;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle 401 Unauthorized - Session expired
    if (res.status === 401) {
      if (sessionExpiredHandler) {
        sessionExpiredHandler();
      }
      throw new Error("Session expired. Please login again.");
    }
    
    // Check if response is JSON to avoid "Unexpected end of JSON" errors
    const contentType = res.headers.get("content-type");
    let errorMessage = res.statusText;
    
    if (contentType && contentType.includes("application/json")) {
      const errorJson = await res.json();
      errorMessage = errorJson.detail || errorJson.message || errorMessage;
    } else {
      errorMessage = await res.text();
    }

    // Handle 403 Subscription blocked
    if (res.status === 403 && subscriptionBlockedHandler) {
      subscriptionBlockedHandler(errorMessage);
    }
    
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

function getAuthHeaders(): HeadersInit {
  // Prefer Azure AD token, fallback to legacy token
  const azureToken = getAzureAuthToken();
  if (azureToken) {
    return { Authorization: `Bearer ${azureToken}` };
  }
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Helper to ensure the URL always points to the correct backend
 */
function getFullUrl(url: string): string {
  // If the URL is already absolute (starts with http), leave it
  if (url.startsWith("http")) return url;
  // Prepend API_BASE_URL and ensure there's a leading slash if missing
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(getFullUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    // Removed credentials: "include" for production CORS stability 
    // since we are using explicit Bearer tokens.
  });

  await throwIfResNotOk(res);
  return res;
}

export async function apiRequestFormData(
  method: string,
  url: string,
  formData: FormData,
): Promise<Response> {
  const headers: HeadersInit = getAuthHeaders();

  const res = await fetch(getFullUrl(url), {
    method,
    headers,
    body: formData,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build the path from the query key
    const path = queryKey.join("/");
    
    const res = await fetch(getFullUrl(path), {
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    
    // Handle 401 for queries
    if (res.status === 401) {
      if (sessionExpiredHandler) {
        sessionExpiredHandler();
      }
      throw new Error("Session expired. Please login again.");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});