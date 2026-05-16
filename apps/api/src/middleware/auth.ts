import { Request, Response, NextFunction } from "express";
import { getSupabase } from "../lib/supabase";

// Extend Express Request to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        /**
         * Unix timestamp (seconds) at which the JWT was issued.
         * Used by re-auth-required endpoints (e.g. POST /wallet/export-key,
         * HIGH-11) to require a freshly-minted token.
         * May be undefined for opaque/non-JWT tokens.
         */
        iat?: number;
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Attach user to request, including JWT iat (issued-at) so re-auth-gated
    // routes can require a freshly-minted token. Decoded best-effort — if
    // the token isn't a standard JWT, iat stays undefined and the caller's
    // re-auth check decides how to handle that (HIGH-11 / plan 28-05).
    req.user = {
      id: user.id,
      email: user.email,
      iat: decodeJwtIat(token),
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Extract the `iat` (issued-at) claim from a JWT bearer token without
 * verifying the signature. Signature verification is already done by
 * `supabase.auth.getUser(token)` upstream — this is purely a claim
 * extraction.
 *
 * Returns undefined for non-JWT tokens, malformed input, or missing iat.
 * Re-auth gates MUST treat undefined as "not fresh enough".
 */
function decodeJwtIat(token: string): number | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    // base64url → base64 → buffer → JSON.
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    return typeof payload.iat === "number" ? payload.iat : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Optional auth middleware - allows requests through even without auth,
 * but attaches user info if a valid token is provided.
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const {
        data: { user },
      } = await getSupabase().auth.getUser(token);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          iat: decodeJwtIat(token),
        };
      }
    }

    next();
  } catch {
    // Don't fail on auth errors, just continue without user
    next();
  }
}
