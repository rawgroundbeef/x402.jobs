/**
 * WebSocket Connection Manager
 * Manages WebSocket connections for real-time updates to users
 */

import { WebSocket, WebSocketServer } from "ws";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

// Event types that can be broadcast to clients
export type WSEventType =
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

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  connectedAt: Date;
}

/**
 * Manages WebSocket connections by user ID
 * Allows broadcasting events to specific users
 */
class ConnectionManagerClass {
  private clients: Map<WebSocket, ConnectedClient> = new Map();
  private userConnections: Map<string, Set<WebSocket>> = new Map();
  private wss: WebSocketServer | null = null;

  /**
   * Initialize the WebSocket server
   */
  initialize(wss: WebSocketServer): void {
    this.wss = wss;
    console.log("🔌 WebSocket ConnectionManager initialized");
  }

  /**
   * Authenticate a WebSocket connection using the token
   * Returns the userId if valid, null otherwise
   */
  async authenticate(token: string): Promise<string | null> {
    try {
      // Create a Supabase client with the user's token
      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        },
      );

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        console.log("[WS] Auth failed:", error?.message || "No user");
        return null;
      }

      return user.id;
    } catch (err) {
      console.error("[WS] Auth error:", err);
      return null;
    }
  }

  /**
   * Register a new WebSocket connection
   */
  registerConnection(ws: WebSocket, userId: string): void {
    const client: ConnectedClient = {
      ws,
      userId,
      connectedAt: new Date(),
    };

    this.clients.set(ws, client);

    // Track by user ID for broadcasting
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(ws);

    console.log(
      `[WS] Client connected: ${userId} (total: ${this.clients.size})`,
    );
  }

  /**
   * Remove a WebSocket connection
   */
  removeConnection(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    // Remove from user connections
    const userSockets = this.userConnections.get(client.userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        this.userConnections.delete(client.userId);
      }
    }

    this.clients.delete(ws);
    console.log(
      `[WS] Client disconnected: ${client.userId} (total: ${this.clients.size})`,
    );
  }

  /**
   * Send a message to a specific WebSocket
   */
  sendToClient(ws: WebSocket, event: WSEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /**
   * Broadcast an event to a specific user (all their connections)
   */
  broadcastToUser(userId: string, event: WSEvent): void {
    const userSockets = this.userConnections.get(userId);
    if (!userSockets || userSockets.size === 0) {
      // User not connected, that's fine
      return;
    }

    const payload = JSON.stringify(event);
    let sentCount = 0;

    for (const ws of userSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(
        `[WS] Broadcast to ${userId}: ${event.type} (${sentCount} connections)`,
      );
    }
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcastToAll(event: WSEvent): void {
    const payload = JSON.stringify(event);
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
        sentCount++;
      }
    }

    console.log(`[WS] Broadcast to all: ${event.type} (${sentCount} clients)`);
  }

  /**
   * Get connection stats
   */
  getStats(): { totalConnections: number; uniqueUsers: number } {
    return {
      totalConnections: this.clients.size,
      uniqueUsers: this.userConnections.size,
    };
  }

  /**
   * Check if a user is connected
   */
  isUserConnected(userId: string): boolean {
    const userSockets = this.userConnections.get(userId);
    if (!userSockets) return false;

    // Check if at least one socket is actually open
    for (const ws of userSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  /**
   * Handle ping/pong for connection health
   */
  setupHeartbeat(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(interval);
      }
    }, 30000); // Ping every 30 seconds

    ws.on("close", () => clearInterval(interval));
  }
}

// Export singleton instance
export const ConnectionManager = new ConnectionManagerClass();

/**
 * Helper function to broadcast from anywhere in the codebase
 * Safe to call even if user is not connected
 */
export function broadcastToUser(userId: string, event: WSEvent): void {
  ConnectionManager.broadcastToUser(userId, event);
}

/**
 * Helper to broadcast run events
 */
export function broadcastRunEvent(
  userId: string,
  runId: string,
  jobId: string,
  type: "run:started" | "run:step" | "run:completed",
  data?: Record<string, unknown>,
): void {
  broadcastToUser(userId, {
    type,
    runId,
    jobId,
    ...data,
  });
}

/**
 * Helper to broadcast schedule events
 */
export function broadcastScheduleEvent(
  userId: string,
  jobId: string,
  type: "schedule:disabled",
  reason: string,
): void {
  broadcastToUser(userId, {
    type,
    jobId,
    reason,
  });
}

/**
 * Helper to broadcast notification events
 */
export function broadcastNotification(
  userId: string,
  notification: Record<string, unknown>,
): void {
  broadcastToUser(userId, {
    type: "notification",
    notification,
  });
}
