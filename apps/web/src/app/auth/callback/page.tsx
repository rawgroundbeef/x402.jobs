"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import { Spinner } from "@x402jobs/ui/spinner";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AuthCallback() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check URL for error parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const urlError = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");

        if (urlError) {
          setError(`Authentication failed: ${errorDescription || urlError}`);
          setLoading(false);
          return;
        }

        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setError(`Authentication failed: ${error.message}`);
          setLoading(false);
          return;
        }

        if (data.session?.user) {
          // Successfully authenticated - redirect to jobs/new
          router.push("/jobs/new");
        } else {
          setError("No session found. Please try signing in again.");
          setLoading(false);
        }
      } catch {
        setError("An unexpected error occurred. Please try again.");
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Spinner className="h-8 w-8 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              Processing authentication...
            </h2>
            <p className="text-muted-foreground text-sm">
              Please wait while we complete your sign-in
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push("/login")} className="w-full">
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
