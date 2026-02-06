import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, User, Lock } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(username, password);
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
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
            <CardTitle className="text-white">Login</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to access the fraud analysis dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-200">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    data-testid="input-username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    data-testid="input-password"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 text-center mb-3">
                Authorized analysts only
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
