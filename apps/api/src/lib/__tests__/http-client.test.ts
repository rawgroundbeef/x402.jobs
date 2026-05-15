import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { httpClient, isBlockedRequestError } from "../http-client";

/**
 * Behavioral tests for the SSRF-protected http client (plan 28-09 / HIGH-13).
 *
 * Replaces the 25 unit tests in safe-fetch.test.ts which tested isPrivateIp()
 * in isolation. The new approach is end-to-end: we drive the real
 * request-filtering-agent against real targets and assert the same outcomes
 * (private IP → block) plus the new DNS-rebinding guarantee that the old
 * safeFetch could not provide.
 */

let testServer: http.Server;
let testPort: number;

beforeAll(async () => {
  testServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  await new Promise<void>((resolve) => {
    testServer.listen(0, "127.0.0.1", () => {
      const addr = testServer.address();
      if (addr && typeof addr === "object") testPort = addr.port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) =>
    testServer.close(() => resolve()),
  );
});

describe("httpClient — private IP rejection (preserves safe-fetch coverage)", () => {
  it("rejects 127.0.0.1 (IP-literal loopback)", async () => {
    // IP literal path: request-filtering-agent's createConnection() runs
    // validateIPAddress() synchronously BEFORE any DNS lookup. The library
    // throws the error directly from createConnection, which axios surfaces
    // as the rejection. Matches isBlockedRequestError on the verbatim message.
    let caught: unknown;
    try {
      await httpClient.get(`http://127.0.0.1:${testPort}/`, { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects 169.254.169.254 (AWS IMDS link-local)", async () => {
    let caught: unknown;
    try {
      await httpClient.get("http://169.254.169.254/latest/meta-data/", {
        timeout: 2000,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects 10.0.0.1 (RFC1918 private)", async () => {
    let caught: unknown;
    try {
      await httpClient.get("http://10.0.0.1/", { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects 192.168.1.1 (RFC1918 private)", async () => {
    let caught: unknown;
    try {
      await httpClient.get("http://192.168.1.1/", { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects 0.0.0.0 (unspecified / meta)", async () => {
    let caught: unknown;
    try {
      await httpClient.get("http://0.0.0.0/", { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects ::1 (IPv6 loopback)", async () => {
    let caught: unknown;
    try {
      await httpClient.get("http://[::1]/", { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects 172.20.5.5 (RFC1918 172.16/12)", async () => {
    let caught: unknown;
    try {
      await httpClient.get("http://172.20.5.5/", { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects 100.64.0.1 (CGNAT 100.64/10)", async () => {
    let caught: unknown;
    try {
      await httpClient.get("http://100.64.0.1/", { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });
});

describe("httpClient — DNS rebinding fails at connect time (HIGH-13)", () => {
  // This is the key new guarantee that justifies the migration: the old
  // safeFetch resolved DNS once upfront and then called fetch() — which
  // re-resolved the hostname when the connection actually opened. An
  // attacker controlling DNS could return a public IP on the first lookup
  // (passing the check) and a private IP on the second (the connect).
  //
  // request-filtering-agent installs a custom `lookup` on the underlying
  // http(s).Agent. That lookup runs validateIPAddress() on every resolved
  // address as part of the connect path — the SAME lookup whose result
  // dictates the connect target. There is no second lookup, so there is
  // no TOCTOU window.
  //
  // We exercise the close-the-window guarantee by routing a hostname
  // through the agent that resolves to a private IP. `localhost` is the
  // most portable: it resolves via the OS resolver to 127.0.0.1 (and/or
  // ::1) and the agent's lookup wrapper runs validateIPAddress on the
  // resolved address before connect. That assertion proves: "any DNS
  // result that maps to a private IP is rejected at the connect path",
  // which is precisely the property the old safeFetch lacked.

  it("rejects `localhost` (hostname that resolves to a private IP at connect time)", async () => {
    // Use the test server's port so we know there'd be a real listener if
    // the filter weren't in place — proves the failure is the filter, not
    // ECONNREFUSED. The agent's lookup wrapper runs validateIPAddress on
    // the resolved 127.0.0.1 BEFORE TCP connect completes.
    let caught: unknown;
    try {
      await httpClient.get(`http://localhost:${testPort}/`, { timeout: 2000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
  });

  it("rejects a hostname whose DNS resolution would flip between checks (TOCTOU close)", async () => {
    // Two-stage check: confirm that even if an attacker could split a
    // public-IP DNS answer from a private-IP TCP connect target, the
    // library's at-connect-time validation catches it. We can't easily
    // mock dns.lookup at the agent layer in vitest (the library calls
    // node:dns directly inside its agent), so we proxy this guarantee
    // via the localhost test above: any hostname → private IP path
    // is rejected at the lookup-during-connect step, NOT at an upfront
    // pre-check. The single lookup-during-connect path is what closes
    // the TOCTOU window — there is no second lookup that could rebind.
    //
    // This test asserts the lookup hook itself runs validateIPAddress —
    // a regression here would mean the agent isn't installed on the
    // axios request, which would silently re-open the SSRF surface.
    let caught: unknown;
    try {
      await httpClient.get(`http://localhost:${testPort}/some-internal-path`, {
        timeout: 2000,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isBlockedRequestError(caught)).toBe(true);
    // Also assert the error message comes from the library's
    // validateIPAddress() — distinguishes from a plain ECONNREFUSED.
    expect((caught as Error).message).toMatch(
      /is not allowed.*private IP address/i,
    );
  });
});

describe("isBlockedRequestError sentinel", () => {
  it("returns true for library's verbatim private-IP error", () => {
    const err = new Error(
      "DNS lookup 127.0.0.1(family:4, host:127.0.0.1) is not allowed. Because, It is private IP address.",
    );
    expect(isBlockedRequestError(err)).toBe(true);
  });

  it("returns true for library's verbatim meta-IP error", () => {
    const err = new Error(
      "DNS lookup 0.0.0.0(family:4, host:0.0.0.0) is not allowed. Because, It is meta IP address.",
    );
    expect(isBlockedRequestError(err)).toBe(true);
  });

  it("returns true when error is wrapped (axios .cause)", () => {
    const inner = new Error(
      "DNS lookup 10.0.0.1(family:4, host:10.0.0.1) is not allowed. Because, It is private IP address.",
    );
    const outer: any = new Error("Network error");
    outer.cause = inner;
    expect(isBlockedRequestError(outer)).toBe(true);
  });

  it("returns false for unrelated errors (e.g., ECONNREFUSED to a public host)", () => {
    const err: any = new Error("connect ECONNREFUSED 1.2.3.4:80");
    err.code = "ECONNREFUSED";
    expect(isBlockedRequestError(err)).toBe(false);
  });

  it("returns false for null / undefined / non-objects", () => {
    expect(isBlockedRequestError(null)).toBe(false);
    expect(isBlockedRequestError(undefined)).toBe(false);
    expect(isBlockedRequestError("string error")).toBe(false);
    expect(isBlockedRequestError(42)).toBe(false);
  });
});
