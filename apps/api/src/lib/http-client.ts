import axios, { AxiosInstance } from "axios";
import { useAgent } from "request-filtering-agent";

/**
 * SSRF-protected HTTP client. Replaces the custom safeFetch wrapper from
 * CRIT-07 / plan 28-09 (HIGH-13).
 *
 * request-filtering-agent installs an http(s).Agent that rejects connections
 * to non-unicast IPs (private/loopback/link-local/meta) AT CONNECT TIME —
 * after DNS resolution but before the TCP connect completes. This closes the
 * DNS-rebinding / TOCTOU window that an upfront `dns.lookup()` (as used by the
 * old safeFetch) leaves open.
 *
 * Filter behavior with `{ allowPrivateIPAddress: false, allowMetaIPAddress: false }`:
 *   - Blocks anything ipaddr.js does not classify as "unicast", which includes:
 *     - RFC1918 private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *     - CGNAT: 100.64.0.0/10
 *     - Loopback: 127.0.0.0/8, ::1
 *     - Link-local: 169.254.0.0/16 (incl. AWS IMDS at 169.254.169.254), fe80::/10
 *     - Multicast: 224.0.0.0/4, ff00::/8
 *     - Reserved: 240.0.0.0/4, 255.255.255.255
 *     - Unique local (IPv6): fc00::/7
 *   - Blocks meta/unspecified: 0.0.0.0, ::
 *
 * The library does NOT expose a separate `allowLoopbackAddress` option — loopback
 * is grouped under the non-unicast block. Verified against
 * node_modules/request-filtering-agent/lib/request-filtering-agent.js
 * (range !== "unicast" check at line 80).
 */
function makeHttpClient(): AxiosInstance {
  const instance = axios.create({
    timeout: 30_000,
    maxRedirects: 5,
    // Don't throw on 4xx/5xx — caller decides via response.status. The custom
    // safeFetch never threw on HTTP errors either; preserve that contract.
    validateStatus: () => true,
  });

  // Inject the request-filtering agent per-request based on URL scheme.
  // `useAgent(url, ...)` returns either RequestFilteringHttpAgent or
  // RequestFilteringHttpsAgent depending on the URL. We set both
  // httpAgent and httpsAgent so axios always picks the right one even if
  // a redirect crosses schemes (axios re-applies the same agent config).
  instance.interceptors.request.use((config) => {
    const url = config.url;
    if (!url) return config;
    const agent = useAgent(url, {
      allowPrivateIPAddress: false,
      allowMetaIPAddress: false,
    });
    config.httpAgent = agent;
    config.httpsAgent = agent;
    return config;
  });

  return instance;
}

export const httpClient: AxiosInstance = makeHttpClient();

/**
 * Sentinel error class for "URL pointed at a private address and was refused".
 * The library throws Node-level connection errors at connect time; we keep a
 * dedicated class so callers can `throw new BlockedRequestError(...)` when
 * synthesizing the failure (currently unused — the check is via
 * `isBlockedRequestError` below — but exported for symmetry with the old
 * `SSRFError` API).
 */
export class BlockedRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedRequestError";
  }
}

/**
 * Determine whether an error thrown by axios was caused by
 * request-filtering-agent rejecting the target IP.
 *
 * The library's `validateIPAddress` returns an `Error` whose message contains
 * the substrings "is not allowed" + ("private IP address" or "meta IP address").
 * That error surfaces through axios as `err.cause` or as the message of the
 * outer AxiosError (depending on Node/axios version and how the agent
 * propagates), so we match on substrings across both.
 *
 * We also match `ECONNREFUSED`-style codes only when the message string
 * contains the library's signature phrase, to avoid false positives on
 * legitimately-refused-connections to public hosts.
 */
export function isBlockedRequestError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; cause?: unknown };
  const messages: string[] = [];
  if (typeof e.message === "string") messages.push(e.message);
  if (e.cause && typeof e.cause === "object") {
    const c = e.cause as { message?: string };
    if (typeof c.message === "string") messages.push(c.message);
  }
  for (const m of messages) {
    // Library's verbatim error text: "DNS lookup <ip>(...) is not allowed.
    // Because, It is private IP address." (and the meta variant).
    if (
      /is not allowed.*private IP address/i.test(m) ||
      /is not allowed.*meta IP address/i.test(m) ||
      /is not allowed.*defined in denyIPAddressList/i.test(m)
    ) {
      return true;
    }
  }
  return false;
}
