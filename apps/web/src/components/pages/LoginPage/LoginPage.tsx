"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@x402jobs/ui/card";
import { Label } from "@x402jobs/ui/label";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import BaseLayout from "@/components/BaseLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";
import { XIcon, GoogleIcon } from "@/components/icons/SocialIcons";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithGoogle, signInWithTwitter, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    "google" | "twitter" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Get redirect URL from query params
  const redirectUrl = searchParams.get("redirect");

  // Store redirect URL for OAuth flow (which goes through a callback page)
  useEffect(() => {
    if (redirectUrl) {
      localStorage.setItem("authRedirect", redirectUrl);
    }
  }, [redirectUrl]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        setError(error.message);
      } else {
        // Clear stored redirect and navigate
        localStorage.removeItem("authRedirect");
        router.push(redirectUrl || "/jobs/new");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "twitter") => {
    setError(null);
    setSocialLoading(provider);

    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithTwitter();
      }
    } catch (err) {
      setError(
        `Failed to sign in with ${provider === "google" ? "Google" : "X"}`,
      );
      setSocialLoading(null);
    }
  };

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">
              Welcome back
            </CardTitle>
            <CardDescription>
              Sign in to your account to manage your jobs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleSocialLogin("google")}
                disabled={socialLoading !== null || isLoading}
              >
                {socialLoading === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                Google
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleSocialLogin("twitter")}
                disabled={socialLoading !== null || isLoading}
              >
                {socialLoading === "twitter" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XIcon className="h-4 w-4" />
                )}
                X
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || socialLoading !== null}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || socialLoading !== null}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isLoading || socialLoading !== null}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  );
}
