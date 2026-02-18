import { useState } from "react";
import { useAzureAuth } from "@/lib/azureAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

function MicrosoftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 23 23">
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAzureAuth();

  const handleMicrosoftLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      await login();
    } catch (err: any) {
      if (err?.errorCode !== "user_cancelled") {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/synapx login.png" 
            alt="Synapx Logo" 
            className="h-32 w-auto mb-2"
          />
          <p className="text-slate-400">Fraud Prediction AI Agent</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Welcome</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in with your Microsoft account to access the fraud analysis dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-900">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleMicrosoftLogin}
              className="w-full bg-white hover:bg-gray-100 text-gray-800 font-medium py-6 text-base gap-3"
              disabled={isLoading}
              data-testid="button-microsoft-login"
            >
              <MicrosoftIcon />
              {isLoading ? "Signing in..." : "Sign in with Microsoft"}
            </Button>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 text-center">
                Authorized analysts only · Enterprise SSO powered by Azure AD
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-4">
          AI-assisted decision support for fraud analysis.
          <br />
          All final decisions are made by investigators.
        </p>
      </div>
    </div>
  );
}
