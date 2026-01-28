"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Search, Server, Box, Play, Plus } from "lucide-react";
import Link from "next/link";
import { authenticatedFetcher } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useModals } from "@/contexts/ModalContext";

interface ServerData {
  id: string;
  origin_url: string;
  name: string;
  favicon_url?: string;
  resource_count: number;
  created_at: string;
}

interface ResourceData {
  id: string;
  name: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  extra?: {
    serviceName?: string;
    agentName?: string;
    avatarUrl?: string;
    pricing?: {
      amount?: number;
    };
  };
}

interface ServersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTryResource?: (resource: ResourceData) => void;
}

export function ServersModal({
  isOpen,
  onClose,
  onTryResource,
}: ServersModalProps) {
  const { openRegisterResource } = useModals();
  const [search, setSearch] = useState("");
  const [selectedServer, setSelectedServer] = useState<ServerData | null>(null);

  const { data: serversData, isLoading: loadingServers } = useSWR<{
    servers: ServerData[];
  }>(isOpen ? "/servers" : null, authenticatedFetcher);

  const { data: resourcesData, isLoading: loadingResources } = useSWR<{
    server: ServerData;
    resources: ResourceData[];
  }>(
    isOpen && selectedServer ? `/servers/${selectedServer.id}` : null,
    authenticatedFetcher,
  );

  const servers = serversData?.servers || [];
  const resources = resourcesData?.resources || [];

  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.origin_url.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredResources = resources.filter(
    (r) =>
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.extra?.agentName?.toLowerCase().includes(search.toLowerCase()) ||
      r.extra?.serviceName?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleBack = () => {
    setSelectedServer(null);
    setSearch("");
  };

  const handleClose = () => {
    setSelectedServer(null);
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex-row items-center gap-3">
          {selectedServer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mr-1"
            >
              ←
            </Button>
          )}
          {selectedServer ? (
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedServer.favicon_url ? (
                  <img
                    src={selectedServer.favicon_url}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Server className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <DialogTitle>{selectedServer.name}</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedServer.resource_count} resources
                </p>
              </div>
            </div>
          ) : (
            <DialogTitle>Servers</DialogTitle>
          )}
          {selectedServer && (
            <Link href={`/servers/${selectedServer.id}`} onClick={handleClose}>
              <Button variant="outline" size="sm">
                View Server
              </Button>
            </Link>
          )}
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              selectedServer ? "Search resources..." : "Search servers..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <DialogBody>
          {selectedServer ? (
            // Resources list for selected server
            loadingResources ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {search ? "No resources found" : "No resources on this server"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredResources.map((resource) => {
                  const priceDisplay = formatPrice(
                    resource.max_amount_required,
                  );
                  const displayName =
                    resource.extra?.agentName ||
                    resource.extra?.serviceName ||
                    resource.name;
                  const avatarUrl =
                    resource.avatar_url || resource.extra?.avatarUrl;

                  return (
                    <div
                      key={resource.id}
                      className="p-3 rounded-lg border border-border hover:border-primary hover:bg-accent/50 transition-colors flex items-center gap-3"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-resource/20 flex items-center justify-center flex-shrink-0">
                          <Box className="w-5 h-5 text-resource" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {displayName}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 bg-muted rounded font-mono">
                            {resource.network}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                          {resource.description || "No description"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-mono text-muted-foreground mr-1">
                          {priceDisplay} USDC{" "}
                          <span className="opacity-60">
                            ({resource.network})
                          </span>
                        </span>
                        <button
                          onClick={() => onTryResource?.(resource as any)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                        >
                          <Play className="w-2.5 h-2.5 mr-1" />
                          Try
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : // Servers list
          loadingServers ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="w-10 h-10 mx-auto mb-3 opacity-50" />
              {search ? "No servers found" : "No servers registered yet"}
              <p className="text-sm mt-2">
                Register a resource to create a server
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredServers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => setSelectedServer(server)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-accent/50 transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {server.favicon_url ? (
                      <img
                        src={server.favicon_url}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Server className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{server.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {server.origin_url}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">
                      {server.resource_count}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {server.resource_count === 1 ? "resource" : "resources"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogBody>

        {/* Footer - only show when not viewing a specific server */}
        {!selectedServer && (
          <DialogFooter>
            <button
              onClick={() => {
                openRegisterResource();
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium rounded bg-resource/20 hover:bg-resource/30 text-resource transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Resource
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
