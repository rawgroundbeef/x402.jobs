import { Request, Response, NextFunction } from "express";
import { getSupabase } from "../lib/supabase";
import { isAdminUser } from "../config";

// Extend Express Request to include ownership info
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      resource?: {
        id: string;
        server_id: string | null;
        verified_owner_id: string | null;
      };
      server?: {
        id: string;
        verified_owner_id: string | null;
        registered_by: string | null;
      };
      isAdmin?: boolean;
      isResourceOwner?: boolean;
      isServerOwner?: boolean;
    }
  }
}

/**
 * Middleware to check if the user can edit a resource.
 * User must be: admin, verified resource owner, or verified server owner.
 * Attaches resource info to req.resource.
 *
 * @param idParam - The name of the route parameter containing the resource ID (default: "id")
 */
export function requireResourceOwnership(idParam: string = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const resourceId = req.params[idParam];
      if (!resourceId) {
        return res.status(400).json({ error: "Resource ID is required" });
      }

      const supabase = getSupabase();

      // Get the resource with server info
      const { data: resource, error: fetchError } = await supabase
        .from("x402_resources")
        .select(
          "id, server_id, verified_owner_id, server:x402_servers(verified_owner_id)",
        )
        .eq("id", resourceId)
        .eq("is_active", true)
        .single();

      if (fetchError || !resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      // Check permissions
      const isAdmin = isAdminUser(userId);
      const isResourceOwner = resource.verified_owner_id === userId;
      const server = resource.server as { verified_owner_id?: string } | null;
      const isServerOwner = server?.verified_owner_id === userId;

      if (!isAdmin && !isResourceOwner && !isServerOwner) {
        return res.status(403).json({
          error:
            "Only admins, resource owners, or server owners can perform this action",
        });
      }

      // Attach info to request for use in route handler
      req.resource = {
        id: resource.id,
        server_id: resource.server_id,
        verified_owner_id: resource.verified_owner_id,
      };
      req.isAdmin = isAdmin;
      req.isResourceOwner = isResourceOwner;
      req.isServerOwner = isServerOwner;

      next();
    } catch (error) {
      console.error("Resource ownership middleware error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Middleware to check if the user can edit a server.
 * User must be: admin, verified owner, or registrant.
 * Attaches server info to req.server.
 *
 * @param idParam - The name of the route parameter containing the server ID (default: "id")
 */
export function requireServerOwnership(idParam: string = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const serverId = req.params[idParam];
      if (!serverId) {
        return res.status(400).json({ error: "Server ID is required" });
      }

      const supabase = getSupabase();

      // Get the server
      const { data: server, error: fetchError } = await supabase
        .from("x402_servers")
        .select("id, verified_owner_id, registered_by")
        .eq("id", serverId)
        .single();

      if (fetchError || !server) {
        return res.status(404).json({ error: "Server not found" });
      }

      // Check permissions
      const isAdmin = isAdminUser(userId);
      const isVerifiedOwner = server.verified_owner_id === userId;
      const isRegistrant = server.registered_by === userId;

      if (!isAdmin && !isVerifiedOwner && !isRegistrant) {
        return res.status(403).json({
          error: "Only admins or server owners can perform this action",
        });
      }

      // Attach info to request for use in route handler
      req.server = {
        id: server.id,
        verified_owner_id: server.verified_owner_id,
        registered_by: server.registered_by,
      };
      req.isAdmin = isAdmin;
      req.isServerOwner = isVerifiedOwner || isRegistrant;

      next();
    } catch (error) {
      console.error("Server ownership middleware error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
