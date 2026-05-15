# Security Policy

## Reporting a Vulnerability

**Please do not file public issues for security findings.**

Use one of:

1. **GitHub Private Vulnerability Reporting** (preferred):
   https://github.com/rawgroundbeef/x402.jobs/security/advisories/new

2. **Email:** security@x402.jobs

We aim to acknowledge reports within 3 business days and provide a
remediation plan within 7 business days.

## Scope

In scope: code under `apps/web/`, `apps/api/`, `packages/sdk/`,
`packages/ui/`.

Out of scope: third-party services x402.jobs integrates with
(Supabase, Helius, Inngest, Twitter); attacks requiring compromised
Supabase service-role credentials.

## Severity Classification

We use the standard CVSS v3.1 framework (Critical / High / Medium /
Low / Informational).

## Supply-Chain Hardening

This repo applies a 72-hour npm release-age gate via the root `.npmrc`
(`minimum-release-age=4320` minutes = 72 hours) to neutralize the bulk
of npm zero-day attack patterns (publish-malicious then publish-fix
then request-takedown — typically detected and removed within 24-48h).

Internal `@x402jobs/*` packages are exempted via
`minimum-release-age-exclude=@x402jobs/*` so we can publish urgent
fixes to our own SDK and consume them immediately.

A future maintainer who removes this gate is removing a documented
security control; please don't. See
`.planning/phases/30-supply-chain-hardening/30-CONVERGENCE.md` for the
rationale and rollback runbook.

## Encryption Keys

x402.jobs encrypts user wallet private keys (AES-256-GCM via
`WALLET_ENCRYPTION_SECRET`) and OAuth tokens (AES-256-CBC via
`INTEGRATION_ENCRYPTION_SECRET`) at rest in Supabase. Loss of either
key permanently locks out the corresponding user data.

## Known Unfixed Findings

None at public launch.

For transparency, the historical security review artifacts (Phase 28
internal review, 2026-05-12) are preserved at
`.planning/phases/28-security-review/` in this repo. All 7 Critical
and 12 High findings from that review were remediated before public
launch (CRITs in commits 282b070..991d370; HIGHs in commit c751857
shipped via api repo PR #32 on 2026-05-14).

## Honest Limitations

x402.jobs has not been audited by an external security firm. Our
internal Phase 28 review (agent-assisted) catches OWASP-class issues
and common auth/key handling bugs but does NOT match a domain-expert
human reviewer on protocol-level attacks (subtle EIP-3009 nonce
reuse, Solana PDA hijacking, MEV-style griefing). We welcome bug
bounty submissions in those areas.

## Coordination

We follow the OpenSSF Vulnerability Disclosures Working Group's
recommended coordination practices.
