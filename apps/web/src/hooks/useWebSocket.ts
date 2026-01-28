"use client";

import { useEffect, useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { supabase } from "@/lib/supabase";

// WebSocket URL - optional, falls back to polling if not set
const WS_URL = process.env.NEXT_PUBLIC_WS_URL;

// Event types from the server
export type WSEventType =
  | "connected"
  | "run:started"
  | "run:step"
  | "run:completed"
  | "schedule:disabled"
  | "schedule:updated"
  | "notification"
  | "wallet:balance"
  | "job:updated";

export interface WSEvent {
  type: WSEventType;
  [key: string]: unknown;
}

export interface RunStartedEvent extends WSEvent {
  type: "run:started";
  runId: string;
  jobId: string;
  totalSteps: number;
}

export interface RunStepEvent extends WSEvent {
  type: "run:step";
  runId: string;
  jobId: string;
  nodeId: string;
  status: "running" | "completed" | "failed";
  output?: unknown;
  error?: string;
  paid?: number;
  /** Resource name for display (e.g., "x402.storage") */
  resourceName?: string;
}

export interface RunCompletedEvent extends WSEvent {
  type: "run:completed";
  runId: string;
  jobId: string;
  status: "completed" | "failed";
  error?: string;
  totalCost?: number;
  completedCount?: number;
  failedCount?: number;
}

export interface ScheduleDisabledEvent extends WSEvent {
  type: "schedule:disabled";
  jobId: string;
  reason: string;
}

export interface ScheduleUpdatedEvent extends WSEvent {
  type: "schedule:updated";
  jobId: string;
  schedule_next_run_at: string;
}

export interface NotificationEvent extends WSEvent {
  type: "notification";
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface JobUpdatedEvent extends WSEvent {
  type: "job:updated";
  jobId: string;
  changes: Record<string, unknown>;
}

type EventCallback<T extends WSEvent = WSEvent> = (event: T) => void;

interface Subscription {
  eventType: WSEventType;
  callback: EventCallback;
}

interface UseWebSocketResult {
  isConnected: boolean;
  isAvailable: boolean;
  subscribe: <T extends WSEvent>(
    eventType: WSEventType,
    callback: EventCallback<T>,
  ) => () => void;
  unsubscribe: (eventType: WSEventType, callback: EventCallback) => void;
}

// Singleton WebSocket manager
class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions: Subscription[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private token: string | null = null;

  // Connection state listeners
  private stateListeners: Set<(connected: boolean) => void> = new Set();

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isAvailable(): boolean {
    return !!WS_URL;
  }

  addStateListener(listener: (connected: boolean) => void): () => void {
    this.stateListeners.add(listener);
    // Immediately call with current state
    listener(this.isConnected);
    return () => this.stateListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    const connected = this.isConnected;
    this.stateListeners.forEach((listener) => listener(connected));
  }

  async connect(): Promise<void> {
    if (!WS_URL) {
      console.log("[WS] WebSocket URL not configured, using polling fallback");
      return;
    }

    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;

    try {
      // Get fresh token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log("[WS] No auth session, cannot connect");
        this.isConnecting = false;
        return;
      }

      this.token = session.access_token;

      // Connect with token in query string
      const url = `${WS_URL}?token=${encodeURIComponent(this.token)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("[WS] Connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.notifyStateListeners();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent;
          this.handleMessage(data);
        } catch (err) {
          console.error("[WS] Failed to parse message:", err);
        }
      };

      this.ws.onclose = (event) => {
        console.log("[WS] Disconnected:", event.code, event.reason);
        this.isConnecting = false;
        this.ws = null;
        this.notifyStateListeners();

        // Don't reconnect if closed intentionally (code 1000) or auth failed (4001, 4002)
        if (event.code === 1000 || event.code === 4001 || event.code === 4002) {
          return;
        }

        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("[WS] Error:", error);
        this.isConnecting = false;
      };
    } catch (err) {
      console.error("[WS] Connection error:", err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[WS] Max reconnect attempts reached, giving up");
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(
        `[WS] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
      );
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff with max of 30 seconds
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, "User disconnected");
      this.ws = null;
    }

    this.notifyStateListeners();
  }

  subscribe<T extends WSEvent>(
    eventType: WSEventType,
    callback: EventCallback<T>,
  ): () => void {
    const subscription: Subscription = {
      eventType,
      callback: callback as EventCallback,
    };
    this.subscriptions.push(subscription);

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, callback as EventCallback);
  }

  unsubscribe(eventType: WSEventType, callback: EventCallback): void {
    this.subscriptions = this.subscriptions.filter(
      (sub) => !(sub.eventType === eventType && sub.callback === callback),
    );
  }

  private handleMessage(event: WSEvent): void {
    // Notify all matching subscribers
    this.subscriptions
      .filter((sub) => sub.eventType === event.type)
      .forEach((sub) => {
        try {
          sub.callback(event);
        } catch (err) {
          console.error(
            `[WS] Error in subscription callback for ${event.type}:`,
            err,
          );
        }
      });
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

/**
 * Hook to use WebSocket for real-time updates
 * Automatically connects on mount, disconnects on unmount
 * Falls back gracefully if WS_URL is not configured
 */
export function useWebSocket(): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState(wsManager.isConnected);
  const { mutate } = useSWRConfig();

  // Track connection state
  useEffect(() => {
    const unsubscribe = wsManager.addStateListener(setIsConnected);
    return unsubscribe;
  }, []);

  // Connect on mount, setup auth listener
  useEffect(() => {
    if (!wsManager.isAvailable) {
      return;
    }

    // Connect immediately
    wsManager.connect();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        wsManager.connect();
      } else if (event === "SIGNED_OUT") {
        wsManager.disconnect();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Setup default handlers for SWR cache invalidation
  useEffect(() => {
    if (!wsManager.isAvailable) return;

    // Invalidate run cache on run events
    const unsubRun = wsManager.subscribe<RunCompletedEvent>(
      "run:completed",
      (event) => {
        mutate(`/runs/${event.runId}`);
        mutate(
          (key) => typeof key === "string" && key.startsWith("/runs"),
          undefined,
          { revalidate: true },
        );
      },
    );

    // Invalidate job cache on job updates
    const unsubJob = wsManager.subscribe<JobUpdatedEvent>(
      "job:updated",
      (event) => {
        mutate(`/jobs/${event.jobId}`);
      },
    );

    // Invalidate job cache on schedule disabled
    const unsubSchedule = wsManager.subscribe<ScheduleDisabledEvent>(
      "schedule:disabled",
      (event) => {
        mutate(`/jobs/${event.jobId}`);
      },
    );

    // Invalidate notifications cache on new notification
    const unsubNotif = wsManager.subscribe<NotificationEvent>(
      "notification",
      () => {
        mutate("/notifications");
        mutate("/notifications?unreadOnly=true");
      },
    );

    return () => {
      unsubRun();
      unsubJob();
      unsubSchedule();
      unsubNotif();
    };
  }, [mutate]);

  const subscribe = useCallback(
    <T extends WSEvent>(
      eventType: WSEventType,
      callback: EventCallback<T>,
    ): (() => void) => {
      return wsManager.subscribe(eventType, callback);
    },
    [],
  );

  const unsubscribe = useCallback(
    (eventType: WSEventType, callback: EventCallback): void => {
      wsManager.unsubscribe(eventType, callback);
    },
    [],
  );

  return {
    isConnected,
    isAvailable: wsManager.isAvailable,
    subscribe,
    unsubscribe,
  };
}

/**
 * Check if WebSocket is available (WS_URL is configured)
 */
export function isWebSocketAvailable(): boolean {
  return wsManager.isAvailable;
}
