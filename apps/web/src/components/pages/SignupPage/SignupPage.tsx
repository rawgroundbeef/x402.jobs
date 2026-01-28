"use client";

import Link from "next/link";
import { useState } from "react";
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
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { XIcon, GoogleIcon } from "@/components/icons/SocialIcons";

export default function SignupPage() {
  const { signInWithGoogle, signInWithTwitter, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    "google" | "twitter" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate username format
  const isValidUsername = (u: string) =>
    /^[a-z0-9_]{3,20}$/.test(u.toLowerCase());

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Username validation
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!isValidUsername(username)) {
      setError(
        "Username must be 3-20 characters and contain only letters, numbers, and underscores",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUpWithEmail(email, password, username);
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
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
        `Failed to sign up with ${provider === "google" ? "Google" : "X"}`,
      );
      setSocialLoading(null);
    }
  };

  if (success) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="mb-2 font-display">
                Check your email
              </CardTitle>
              <CardDescription className="mb-6">
                We&apos;ve sent a confirmation link to <strong>{email}</strong>.
                Please click the link to verify your account.
              </CardDescription>
              <Button variant="secondary" asChild>
                <Link href="/login">Return to Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">
              Create an account
            </CardTitle>
            <CardDescription>
              Get started with x402.jobs to build automated workflows
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
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                      )
                    }
                    className="pl-7"
                    maxLength={20}
                    required
                    disabled={isLoading || socialLoading !== null}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This will be your public handle (e.g., @
                  {username || "yourname"})
                </p>
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  );
}
