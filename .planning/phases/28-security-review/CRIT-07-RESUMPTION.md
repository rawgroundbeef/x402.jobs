---
phase: 28-security-review
finding: CRIT-07
status: in-progress
created: 2026-05-12
purpose: Self-contained plan to resume CRIT-07 (SSRF) work in a fresh session after context reset.
---

# CRIT-07 (SSRF) — Resumption Plan

## Where we are

**Branch:** `fix/crit-07-ssrf-block-private-ips` in `~/Projects/x402jobs-api`

**Branched off:** `main`, BEFORE PR #28 (CRIT-04) was merged. If #28 has merged by the time you resume, **rebase onto `origin/main` first** — there are no file conflicts (CRIT-04 touched `lib/usdc-transfer.ts` + dead-code deletions; CRIT-07 touches `lib/safe-fetch.ts` + `routes/upload.ts` + `routes/images.ts` + `routes/instant.ts`).

**Status of all 7 criticals:**

| PR | Critical | Status |
|---|---|---|
| #24 | CRIT-01 (workflow sandbox) | merged |
| (n/a) | CRIT-02 (honeypot) | closed by deletion (commit `282b070`) |
| #27 | CRIT-03 (API key hashing) | merged |
| #28 | CRIT-04 (fee wallet + dead-code) | open at pause; likely merged when you resume |
| #25 | CRIT-05 (jwt default) | merged |
| #26 | CRIT-06 (Helius webhook) | merged |
| — | **CRIT-07 (SSRF)** | **in progress, this plan** |

After CRIT-07 merges, all 7 criticals are closed. Next phase: triage the 12 Highs from `.planning/phases/28-security-review/REVIEW.md`.

## What CRIT-07 is

Three `fetch(...)` call sites accept a URL from user/creator input and fetch it server-side with **no SSRF protection**. An attacker can point those at:

- `169.254.169.254` (cloud metadata — AWS IMDS, would leak IAM creds)
- `127.0.0.1`, `localhost` (bypass auth on local services)
- `10.x`, `172.16-31.x`, `192.168.x` (private internal networks)
- IPv6 equivalents (`::1`, `fc00::/7`, `fe80::/10`)

The three sites:

| File | Line | Caller-controlled URL | Threat |
|---|---|---|---|
| `src/routes/upload.ts` | ~198 | `imageUrl` from auth'd POST body to `/upload/from-url` | Any auth user fetches metadata, downloads internal service responses |
| `src/routes/images.ts` | ~63 | `url` from auth'd POST body to `/images/cache` | Same as above |
| `src/routes/instant.ts` | ~820 | `resource.proxy_origin_url` configured by resource creator on instant proxy resources | Creator publishes a proxy resource pointing at `169.254.169.254` → caller pays → server fetches metadata → returns to creator-controlled response handling |

## What's already done (on disk in this branch, uncommitted)

### 1. `src/lib/safe-fetch.ts` — SSRF-safe fetch wrapper (~155 LOC)

**Exports:**
- `isPrivateIp(ip: string): boolean` — covers IPv4 (RFC 1918, loopback, link-local, CGNAT, multicast, reserved) AND IPv6 (`::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `::ffff:x.x.x.x` v4-mapped). Fail-closed on malformed input.
- `class SSRFError extends Error` — what gets thrown when the target is private.
- `safeFetch(rawUrl, init?: SafeFetchOptions): Promise<Response>` — resolves hostname via `dns.lookup({ all: true })`, checks every returned IP, requires `http:`/`https:` protocol, follows redirects manually (re-validates each hop, default max 5 hops).

**Known limitation documented in the file:** TOCTOU / DNS rebinding window between lookup and connect is not closed. Defending fully would require connecting to a vetted IP with a manual `Host:` header, which Node's fetch doesn't trivially support. Upfront check still closes the obvious attack paths.

### 2. `src/lib/__tests__/safe-fetch.test.ts` — Unit tests (~25 cases)

Pure tests for `isPrivateIp` (offline, deterministic). Covers:
- IPv4 blocked: 127/8, 169.254/16 (including 169.254.169.254 cloud metadata), 10/8, 172.16/12, 192.168/16, 100.64/10 CGNAT, 0/8, 224/4 multicast, 240/4 reserved, 255.255.255.255.
- IPv4 allowed: 1.1.1.1, 8.8.8.8, 142.250.x.x, 52.x.x.x, plus boundary-adjacent-to-private addresses.
- IPv6 blocked: `::1`, `::`, `fc00::1`, `fd12:...`, `fe80::1`, `ff00::1`, `::ffff:127.0.0.1`, `::ffff:169.254.169.254`.
- IPv6 allowed: Google DNS, Cloudflare DNS, `::ffff:8.8.8.8`.
- Malformed input fails closed (empty string, "not-an-ip", "999.999.999.999", short/long addresses, negative numbers).

The `safeFetch` function itself is NOT unit-tested (would require either real DNS or an injectable resolver — chose simpler scope: test the pure logic, trust the wrapper composition).

## What's left to do

### Step 1: Rebase if needed

```bash
cd ~/Projects/x402jobs-api
git fetch origin main
git rebase origin/main  # should be a no-op or trivial; no file overlap with #28
```

If you see conflicts: `safe-fetch.ts` and its test are new files — no conflict possible. The three call-site edits below are also outside any CRIT-04 territory. Any conflict is unexpected and worth investigating.

### Step 2: Apply `safeFetch` to the three call sites

**Pattern at each site:** add the import, replace `fetch(` with `safeFetch(`, wrap in try/catch to map `SSRFError` to a 400 response.

#### 2a. `src/routes/upload.ts`

**Current (around line 196-208):**

```ts
    console.log(`📥 [UPLOAD] Downloading image from URL: ${imageUrl}`);

    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "x402-jobs/1.0",
      },
    });

    if (!response.ok) {
      return res.status(400).json({
        error: `Failed to download image: ${response.status} ${response.statusText}`,
      });
    }
```

**Change to:**

1. Add import at top: `import { safeFetch, SSRFError } from "../lib/safe-fetch";`
2. Replace the fetch block with try/catch (preserving the existing post-fetch validation flow). Either wrap the existing `try` block's `fetch` call, or add an outer try/catch that handles `SSRFError` before falling through to the existing error path. Easiest minimal-diff version:

```ts
    console.log(`📥 [UPLOAD] Downloading image from URL: ${imageUrl}`);

    // Download the image (SSRF-safe: rejects private/loopback/link-local targets).
    let response: Response;
    try {
      response = await safeFetch(imageUrl, {
        headers: {
          "User-Agent": "x402-jobs/1.0",
        },
      });
    } catch (err) {
      if (err instanceof SSRFError) {
        console.warn(`[UPLOAD] SSRF blocked: ${err.message}`);
        return res.status(400).json({ error: "URL not allowed" });
      }
      throw err;
    }
```

Note the generic `"URL not allowed"` error — don't leak that it was blocked for being private (minor info leak otherwise that helps an attacker map the internal network).

#### 2b. `src/routes/images.ts`

**Current (around line 60-72):**

```ts
    // Download the image
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; X402Bot/1.0)",
        },
      });
    } catch (fetchError) {
      console.error("Failed to fetch image:", fetchError);
      return res.status(400).json({ error: "Failed to fetch image from URL" });
    }
```

**Change to:**

1. Add import: `import { safeFetch, SSRFError } from "../lib/safe-fetch";`
2. Replace `fetch(url, ...)` with `safeFetch(url, ...)` and add SSRF branch to the catch:

```ts
    // Download the image (SSRF-safe).
    let response: Response;
    try {
      response = await safeFetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; X402Bot/1.0)",
        },
      });
    } catch (fetchError) {
      if (fetchError instanceof SSRFError) {
        console.warn(`[Images] SSRF blocked: ${fetchError.message}`);
        return res.status(400).json({ error: "URL not allowed" });
      }
      console.error("Failed to fetch image:", fetchError);
      return res.status(400).json({ error: "Failed to fetch image from URL" });
    }
```

#### 2c. `src/routes/instant.ts`

**Current (around line 815-826):**

```ts
  // Make request to origin
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource.proxy_origin_url, {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
```

**Change to:**

1. Add import: `import { safeFetch, SSRFError } from "../lib/safe-fetch";`
2. Replace `fetch(...)` with `safeFetch(...)` and add SSRF handling to the catch block at the end of the function (around line 850-856 — there's already a `catch (error: any)` block; add an SSRFError branch):

```ts
    const response = await safeFetch(resource.proxy_origin_url, {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });
```

And in the existing catch at the bottom (~line 850):

```ts
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof SSRFError) {
      console.warn(`[Proxy] SSRF blocked: ${error.message}`);
      throw new Error("Proxy origin URL not allowed");
    }
    if (error.name === "AbortError") {
      throw new Error(`Proxy timeout after ${timeout}ms`);
    }
    throw error;
  }
```

Note: `instant.ts` throws errors rather than returning HTTP responses (it's called from a higher-level handler that maps errors to responses). Match the existing pattern — `throw new Error(...)`.

### Step 3: Verify

```bash
cd ~/Projects/x402jobs-api
pnpm typecheck 2>&1 | grep "error TS" | grep -v "resource-registration"  # should be empty
pnpm vitest run --exclude '**/resource-registration*' 2>&1 | tail -8  # should pass 285ish/285ish (260 + 25 new)
pnpm build 2>&1 | tail -3  # should succeed
```

Expected test count after this PR: 260 (post CRIT-04) + 25 (new safe-fetch tests) = **~285 tests**.

### Step 4: Commit + push + PR

```bash
cd ~/Projects/x402jobs-api
git add \
  src/lib/safe-fetch.ts \
  src/lib/__tests__/safe-fetch.test.ts \
  src/routes/upload.ts \
  src/routes/images.ts \
  src/routes/instant.ts
git commit -m "$(cat <<'EOF'
fix: block SSRF on user-supplied fetch targets (closes CRIT-07)

Three routes accepted a URL from user/creator input and fetched it
server-side with no SSRF protection: /upload/from-url, /images/cache, and
the instant-resource proxy executor. Attackers could point those at
169.254.169.254 (cloud metadata — AWS IMDS would leak IAM creds),
127.0.0.1 / localhost (bypass auth on local services), or RFC1918 private
ranges (probe internal infrastructure).

Adds src/lib/safe-fetch.ts:
  - isPrivateIp(ip): blocks IPv4 RFC1918 + loopback + link-local + CGNAT
    + multicast + reserved, plus IPv6 ::1, fc00::/7, fe80::/10, ff00::/8,
    and IPv4-mapped IPv6 (::ffff:x.x.x.x re-checks the embedded v4).
    Fails closed on malformed input.
  - safeFetch(url, init): resolves hostname via dns.lookup({ all: true }),
    rejects if any returned IP is private, enforces http(s) only, follows
    redirects manually (each hop re-validated, default max 5).
  - SSRFError type so callers can map the rejection to a generic 400.

Applied to all 3 sites. Error message at the route layer is the generic
"URL not allowed" — we don't leak that it was blocked for being private
(minor info leak otherwise).

25 unit tests for isPrivateIp cover IPv4 + IPv6 private ranges, public
addresses (including boundary cases adjacent to private), cloud metadata
specifically, IPv4-mapped IPv6 pointing at private v4, and malformed
input. Full suite: ~285 tests passing.

Known limitation: TOCTOU / DNS rebinding window between lookup and
connect is not closed. Defending fully would require connecting to a
vetted IP with a manual Host header, which Node's fetch doesn't
trivially support. The upfront check still closes the obvious attack
paths and matches the rigor proposed in the Phase 28 review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin fix/crit-07-ssrf-block-private-ips
gh pr create --base main --head fix/crit-07-ssrf-block-private-ips \
  --title "fix: block SSRF on user-supplied fetch targets (CRIT-07)" \
  --body "...standard PR body, see the pattern from PRs #24/#26/#28..."
```

### Step 5: After merge

- Mark task #15 (Triage + fix Critical/High findings) as **completed** — all 7 Criticals will be closed.
- Update `.planning/phases/28-security-review/REVIEW.md` frontmatter to reflect remediation status.
- Move on to the **12 Highs** (HIGH-01 through HIGH-12 in REVIEW.md). These are smaller individually but cluster nicely — could be batched into ~3-4 PRs by theme (e.g., "constant-time secret comparisons", "log redaction", "input validation").

## Heads-up gotchas

1. **The branch was created BEFORE PR #28 (CRIT-04) merged.** Definitely rebase first; no conflicts expected since CRIT-04 touched `lib/usdc-transfer.ts`, three Inngest function deletions, and route mount removals — none of which overlap with the CRIT-07 file set.

2. **`instant.ts` throws, doesn't return HTTP.** The proxy executor function (`executeProxy`) is called from a higher-level handler. Match the existing `throw new Error(...)` pattern — don't try to `res.status(400).json(...)` from inside it.

3. **The error message at the route layer should be generic.** Don't return "Refusing to fetch from private address 169.254.169.254" to the caller — that confirms there's an attempted-private-fetch detection AND maps the internal network from outside. Use "URL not allowed". The `SSRFError.message` is fine to log server-side (it's never sent to the client).

4. **The fix doesn't touch DB schema or env vars.** Pure code change. No migration. No `WALLET_ENCRYPTION_SECRET`-style boot guard needed. Just merge → Railway redeploys → done.

5. **Test count assertion:** if `pnpm vitest run` reports significantly fewer than ~285 tests, something is wrong (probably an import error in a test file). The new file adds 25 tests across describe blocks; the rest of the suite was at 260 after CRIT-04.

## File reference summary

**Already-written files in this branch (uncommitted):**
- `src/lib/safe-fetch.ts` — the helper (~155 LOC)
- `src/lib/__tests__/safe-fetch.test.ts` — tests (~120 LOC, ~25 cases)

**Files to edit (3 imports + 3 fetch-call replacements + error mapping):**
- `src/routes/upload.ts` — `/upload/from-url` endpoint
- `src/routes/images.ts` — `/images/cache` endpoint
- `src/routes/instant.ts` — `executeProxy` function (proxy resource type)

**Verification scripts:**
```bash
pnpm typecheck
pnpm vitest run --exclude '**/resource-registration*'
pnpm build
```

That's everything. Resume cleanly from a fresh session by reading this file first, then proceeding from Step 1.
