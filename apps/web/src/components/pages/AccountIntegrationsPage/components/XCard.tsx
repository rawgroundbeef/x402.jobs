"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import { Loader2 } from "lucide-react";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";

// X icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface XStatus {
  connected: boolean;
  profile: {
    username?: string;
    display_name?: string;
    profile_image_url?: string;
  };
}

export default function XCard() {
  const { data, mutate } = useSWR<XStatus>(
    "/integrations/x/status",
    authenticatedFetcher,
  );

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await authenticatedFetch("/integrations/x/oauth/initiate", {
        method: "POST",
      });
      const data = await res.json();
      if (data.oauthUrl) {
        window.open(data.oauthUrl, "_blank", "width=600,height=700");
      }
    } catch {
      // Error handled silently
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await authenticatedFetch("/integrations/x/disconnect", {
        method: "POST",
      });
      mutate();
    } catch {
      // Error handled silently
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = data?.connected && data.profile?.username;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <XIcon className="h-5 w-5" />
          <div>
            <h2 className="text-base font-medium">X (Twitter)</h2>
            <p className="text-sm text-muted-foreground">
              Post to X from your jobs
            </p>
          </div>
        </div>
        {isConnected && <Badge variant="success">Connected</Badge>}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isConnected ? (
            <span>Connected as @{data.profile.username}</span>
          ) : (
            "Not connected"
          )}
        </div>
        {isConnected ? (
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Disconnect"
            )}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Connect"
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
