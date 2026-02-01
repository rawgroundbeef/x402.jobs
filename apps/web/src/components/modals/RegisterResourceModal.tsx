"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import {
  Loader2,
  Check,
  Server,
  Box,
  Wrench,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { authenticatedFetch, API_URL } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { getNetwork } from "@/lib/networks";
import {
  processVerifyResponse,
  type VerifiedResource,
  type VerifyResponse,
  type ServerPreview,
} from "@/lib/x402-verify";
import { VerifyResultDetails } from "@/components/VerifyResultDetails";

interface RegisterResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (serverId: string) => void;
}

// Extract the path from a URL to use as the resource name
function getResourceNameFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Get pathname, remove leading slash, use as name
    const path = url.pathname.replace(/^\//, "") || url.hostname;
    return path;
  } catch {
    return urlString;
  }
}

export function RegisterResourceModal({
  isOpen,
  onClose,
  onSuccess: _onSuccess,
}: RegisterResourceModalProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [verified, setVerified] = useState<VerifiedResource | null>(null);
  const [verifyResponse, setVerifyResponse] = useState<VerifyResponse | null>(
    null,
  );
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [registeredResources, setRegisteredResources] = useState<
    Array<{
      id: string;
      slug: string;
      name: string;
      network: string;
      server?: {
        id: string;
        slug: string;
        name: string;
      };
    }>
  >([]);
  const [registeredResource, setRegisteredResource] = useState<{
    id: string;
    slug: string;
    name: string;
    server?: {
      id: string;
      slug: string;
      name: string;
    };
  } | null>(null);
  const [wasUpdated, setWasUpdated] = useState(false);

  const handleVerify = async () => {
    if (!url.trim()) return;

    setIsVerifying(true);
    setError(null);
    setVerified(null);
    setVerifyResponse(null);
    setServerPreview(null);
    setSelectedNetworks([]);

    try {
      // Verify is a public endpoint (checks external URL)
      const res = await fetch(`${API_URL}/api/v1/resources/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const rawData = await res.json();

      if (!res.ok) {
        if (rawData.validationErrors) {
          throw new Error(rawData.validationErrors.join(". "));
        }
        throw new Error(rawData.error || "Verification failed");
      }

      const data = processVerifyResponse(rawData, url);

      // Always set verifyResponse (for VerifyResultDetails display)
      setVerifyResponse(data);
      setServerPreview(data.server);

      // Only set verified resource when valid — gates registration
      if (data.valid) {
        setVerified(data.resource);

        if (data.accepts && data.accepts.length > 0) {
          setSelectedNetworks([data.accepts[0].normalizedNetwork]);
        } else if (data.resource.network) {
          setSelectedNetworks([data.resource.network]);
        }

        if (data.normalizedUrl) {
          setUrl(data.normalizedUrl);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify URL");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegister = async () => {
    if (!verified || !verifyResponse || selectedNetworks.length === 0) return;

    setIsRegistering(true);
    setError(null);

    // Use best available name: agentName > serviceName > URL path
    const baseName =
      verifyResponse.service?.name ||
      verified.extra?.agentName ||
      verified.serviceName ||
      verified.extra?.serviceName ||
      getResourceNameFromUrl(url);

    try {
      const registered: typeof registeredResources = [];

      // Register one resource per selected network
      for (const networkId of selectedNetworks) {
        // Find the accept option for this network
        const acceptOption = verifyResponse.accepts?.find(
          (a) => a.normalizedNetwork === networkId,
        );

        if (!acceptOption) continue;

        const res = await authenticatedFetch("/resources", {
          method: "POST",
          body: JSON.stringify({
            resourceUrl: url,
            network: acceptOption.normalizedNetwork,
            name: baseName,
            description: verified.description,
            payTo: acceptOption.payTo,
            maxAmountRequired: acceptOption.amount,
            asset: acceptOption.asset,
            mimeType: verified.mimeType,
            maxTimeoutSeconds: verified.maxTimeoutSeconds,
            outputSchema: verified.outputSchema,
            extra: { ...verified.extra, ...acceptOption.extra },
            avatarUrl: verified.avatarUrl || verified.extra?.avatarUrl,
            isA2A: verified.isA2A,
            supportsRefunds: acceptOption.extra?.supportsRefunds === true,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Registration failed for ${networkId}`);
        }

        if (data.resource) {
          registered.push({
            id: data.resource.id,
            slug: data.resource.slug,
            name: data.resource.name,
            network: networkId,
            server: data.server
              ? {
                  id: data.server.id,
                  slug: data.server.slug,
                  name: data.server.name,
                }
              : undefined,
          });
          setWasUpdated(data.updated || false);
        }
      }

      // Show success state
      if (registered.length > 0) {
        setRegisteredResources(registered);
        // For backwards compat, also set single resource
        setRegisteredResource(registered[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register resource",
      );
      setIsRegistering(false);
    }
  };

  const handleClose = () => {
    setUrl("");
    setVerified(null);
    setVerifyResponse(null);
    setServerPreview(null);
    setError(null);
    setSelectedNetworks([]);
    setRegisteredResource(null);
    setRegisteredResources([]);
    setWasUpdated(false);
    setIsRegistering(false);
    onClose();
  };

  const handleViewResource = () => {
    if (registeredResource?.server?.slug && registeredResource.slug) {
      router.push(
        `/resources/${registeredResource.server.slug}/${registeredResource.slug}`,
      );
      handleClose();
    }
  };

  const handleAddAnother = () => {
    setUrl("");
    setVerified(null);
    setVerifyResponse(null);
    setServerPreview(null);
    setSelectedNetworks([]);
    setRegisteredResource(null);
    setRegisteredResources([]);
    setWasUpdated(false);
    setIsRegistering(false);
  };

  const handleChangeUrl = () => {
    setVerified(null);
    setVerifyResponse(null);
    setServerPreview(null);
    setSelectedNetworks([]);
  };

  const priceDisplay = formatPrice(verified?.maxAmountRequired);
  const resourceName = url ? getResourceNameFromUrl(url) : "";

  // Success state content
  if (registeredResource || registeredResources.length > 0) {
    const serverName = registeredResource?.server?.name || "server";
    const count = registeredResources.length || 1;
    return (
      <AnimatedDialog
        open={isOpen}
        onOpenChange={(open) => !open && handleClose()}
      >
        <AnimatedDialogContent className="max-w-md" onClose={handleClose}>
          <DialogHeader>
            <AnimatedDialogTitle>
              {wasUpdated
                ? "Resource Updated!"
                : count > 1
                  ? `${count} Resources Registered!`
                  : "Resource Registered!"}
            </AnimatedDialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {registeredResources.length > 1 ? (
              registeredResources.map((res) => (
                <a
                  key={res.id}
                  href={
                    res.server?.slug && res.slug
                      ? `/resources/${res.server.slug}/${res.slug}`
                      : "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm hover:bg-primary/20 transition-colors"
                >
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{res.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20">
                    {getNetwork(res.network).name}
                  </span>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-60" />
                </a>
              ))
            ) : (
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
                <Check className="h-4 w-4 flex-shrink-0" />
                {wasUpdated
                  ? `Updated and linked to ${serverName}`
                  : `Successfully added to ${serverName}`}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleAddAnother}>
              Add Another
            </Button>
            {registeredResources.length <= 1 && (
              <Button onClick={handleViewResource} variant="primary">
                <Box className="h-4 w-4 mr-2" />
                View Resource
              </Button>
            )}
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    );
  }

  return (
    <AnimatedDialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <AnimatedDialogContent className="max-w-md" onClose={handleClose}>
        <DialogHeader>
          <AnimatedDialogTitle>Register Resource</AnimatedDialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {/* URL Input - only show when not verified */}
            {!verifyResponse && (
              <div className="space-y-3">
                <Input
                  id="url"
                  type="url"
                  placeholder="https://api.example.com/x402/..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  disabled={isVerifying}
                  className="w-full"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Need to test your endpoint first?{" "}
                  <Link
                    href="/docs/developer"
                    onClick={handleClose}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Wrench className="h-3 w-3" />
                    Developer Tools
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  Does your resource generate images, videos, or take a while to
                  run?{" "}
                  <Link
                    href="/docs/long-running-resources"
                    onClick={handleClose}
                    className="text-primary hover:underline"
                  >
                    Learn about Long Running Operations
                  </Link>
                </p>
              </div>
            )}

            {/* Error (from network/backend, not validation) */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <span className="flex-shrink-0">&#x2717;</span>
                {error}
              </div>
            )}

            {/* Verify result — shown for both valid and invalid */}
            {verifyResponse && (
              <div className="space-y-4">
                {/* URL display with change option */}
                <div className="flex items-center gap-2 text-sm">
                  <code className="flex-1 px-2 py-1 bg-muted rounded text-xs font-mono truncate">
                    {url}
                  </code>
                  <button
                    onClick={handleChangeUrl}
                    className="text-muted-foreground hover:text-foreground text-xs underline"
                  >
                    Change
                  </button>
                </div>

                {/* Detailed validation results */}
                <VerifyResultDetails verifyResponse={verifyResponse} url={url} />

                {/* Only show resource preview, server, network selection, etc. when valid */}
                {verified && (
                  <>
                    {/* Server Preview */}
                    {serverPreview && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                        {serverPreview.faviconUrl ? (
                          <img
                            src={serverPreview.faviconUrl}
                            alt=""
                            className="w-8 h-8 rounded object-contain bg-background"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                            <Server className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {serverPreview.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {serverPreview.exists
                              ? `${serverPreview.resourceCount} existing resource${serverPreview.resourceCount === 1 ? "" : "s"}`
                              : "New server will be created"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Resource Preview with Avatar */}
                    <div className="flex items-center gap-3 p-3 bg-accent/50 border border-border rounded-lg">
                      {verified.avatarUrl || verified.extra?.avatarUrl ? (
                        <img
                          src={verified.avatarUrl || verified.extra?.avatarUrl}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-resource/20 flex items-center justify-center">
                          <Box className="w-6 h-6 text-resource" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const displayName =
                            verified.extra?.agentName ||
                            verified.serviceName ||
                            verified.extra?.serviceName ||
                            resourceName;
                          const showDescription =
                            verified.description &&
                            verified.description !== displayName;
                          return (
                            <>
                              <p className="font-semibold truncate">
                                {displayName}
                              </p>
                              {showDescription && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {verified.description}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Network Selection for v2 with multiple options */}
                    {verifyResponse.accepts &&
                    verifyResponse.accepts.length > 1 ? (
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">
                          Select payment network(s)
                        </span>
                        <div className="space-y-2">
                          {verifyResponse.accepts.map((accept) => {
                            const network = getNetwork(
                              accept.normalizedNetwork,
                            );
                            const isSelected = selectedNetworks.includes(
                              accept.normalizedNetwork,
                            );
                            const price = accept.amount
                              ? parseFloat(accept.amount) / 1_000_000
                              : 0;
                            return (
                              <label
                                key={accept.normalizedNetwork}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedNetworks((prev) => [
                                        ...prev,
                                        accept.normalizedNetwork,
                                      ]);
                                    } else {
                                      setSelectedNetworks((prev) =>
                                        prev.filter(
                                          (n) =>
                                            n !== accept.normalizedNetwork,
                                        ),
                                      );
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-border"
                                />
                                <div className="flex-1">
                                  <span className="font-medium">
                                    {network.name}
                                  </span>
                                  <span className="text-muted-foreground ml-2">
                                    ${price.toFixed(2)} USDC
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Each selection creates a separate resource entry
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Price</span>
                        <p className="font-mono">
                          {priceDisplay} USDC (
                          {getNetwork(verified.network).name})
                        </p>
                      </div>
                    )}

                    {verified.description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Description
                        </span>
                        <p className="mt-1">{verified.description}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {!verifyResponse ? (
            <Button
              onClick={handleVerify}
              disabled={!url.trim() || isVerifying}
              variant="primary"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                "Verify URL"
              )}
            </Button>
          ) : verified ? (
            <Button
              onClick={handleRegister}
              disabled={isRegistering || selectedNetworks.length === 0}
              variant="primary"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : selectedNetworks.length > 1 ? (
                `Register ${selectedNetworks.length} Resources`
              ) : (
                "Register Resource"
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
