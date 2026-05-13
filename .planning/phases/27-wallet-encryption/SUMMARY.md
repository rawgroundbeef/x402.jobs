---
phase: 27-wallet-encryption
milestone: v3.0
status: complete
shipped: 2026-05-12
target_codebase: x402jobs-api
note: This phase was executed ad-hoc on 2026-05-12 (no PLAN.md). SUMMARY.md is retroactive — the canonical record lives in commit messages on github.com/rawgroundbeef/x402-jobs-api.
---

# Phase 27 — Wallet Encryption (Summary)

## Goal

Fix at-rest storage of user wallet private keys. The existing `encrypted_private_key` column on `x402_user_wallets` was holding base64-encoded plaintext despite its name — a misleading column that fooled even the developer who wrote it.

## What was delivered

**Schema:**

- `migration 005`: added `solana_private_key_ciphertext` and `base_private_key_ciphertext` columns (nullable, additive)
- `migration 006`: dropped legacy `encrypted_private_key` and `base_encrypted_private_key` columns; flipped Solana ciphertext to `NOT NULL`; added `CHECK` constraint enforcing `base_address ↔ base_private_key_ciphertext` consistency

**Code:**

- `apps/api/src/lib/wallet-encryption.ts` — AES-256-GCM encrypt/decrypt module. Key derived from `WALLET_ENCRYPTION_SECRET` env var via SHA-256. Format: `iv_hex:tag_hex:ciphertext_hex`.
- `apps/api/src/lib/wallet-keys.ts` — `loadDecryptedUserWallet` helper. Reads ciphertext columns, decrypts, returns base64 of raw key material for downstream compatibility. Includes a runtime sanity check: re-derives pubkey/address from decrypted secret and throws on mismatch.
- `apps/api/src/inngest/functions/ensure-user-wallet.ts` — writer encrypts before insert; legacy plaintext writes removed.
- 17 reader call sites across `routes/{execute,runs,wallet,hiring,webhooks,ask-jobputer}.ts`, `inngest/functions/{run-scheduled-jobs,run-workflow/chain}.ts`, and `repositories/ChainRepository` updated to use the helper.
- `apps/api/src/index.ts` — boot guard refuses to start if `WALLET_ENCRYPTION_SECRET` is not set.

**Scripts:**

- `apps/api/scripts/backfill-wallet-encryption.ts` — idempotent migration of existing rows. Pre-flight dry-run verified all 1027 rows decoded and re-derived back to their stored addresses before any writes.
- `apps/api/scripts/backup-legacy-wallet-keys.ts` — pre-drop snapshot. Captured 1027 rows to `wallet-backup-<ts>.json` with SHA-256 `14245dfc60ebce9ec39c09c9024f70f30d01cf1e85bd17911792240826a6d58b`. File moved to offline 1Password vault before migration 006 ran.

**Tests:**

- `apps/api/src/lib/__tests__/wallet-encryption.test.ts` — 6 tests: round-trip raw bytes, round-trip utf-8 string, random IV uniqueness, tampered-ciphertext rejection (GCM auth tag), malformed-ciphertext rejection, wrong-length IV rejection.
- Existing 246-test suite passing through the migration.

## Key decisions

| Decision | Rationale |
|---|---|
| AES-256-GCM over AES-256-CBC | Authenticated encryption — silent tampering becomes a loud error. The existing `lib/instant/encrypt.ts` used CBC for integration tokens; wallets warrant the tighter guarantee. |
| Separate `WALLET_ENCRYPTION_SECRET` env var | Distinct from `INTEGRATION_ENCRYPTION_SECRET` so a compromise of one doesn't compromise the other. |
| Honest column names (`*_ciphertext` not `encrypted_*`) | The original mistake was an `encrypted_private_key` column holding plaintext. New names make their content unambiguous. |
| Dual-write during transition | Writer wrote to both old and new columns until migration 006; let us roll back code without orphaning new rows. |
| Read-time pubkey re-derivation | Defense in depth — catches wrong encryption secret, row corruption, encryption bugs. ~1ms per decrypt. |
| Boot guard on missing secret | Better to refuse start than 500 every payment-signing request. |
| Skip third-party custody KMS (Privy/Turnkey) | $100/mo cost + lateral move ("better custody" vs the actual destination of "no custody"). Non-custodial agent flow is the v3.1 destination. |
| Drop legacy columns immediately after backfill verification | Backup secured in 1Password first; backup + offline storage = real safety net while still eliminating the plaintext attack surface ASAP. |

## Verification

**Live end-to-end test 2026-05-12:**

- Triggered Base workflow from the canvas
- Logs confirmed `[BOOT] WALLET_ENCRYPTION_SECRET configured`
- Logs confirmed `[wallet-keys] decrypted Solana key for user 4e4efff6 (new path)`
- Logs confirmed `[wallet-keys] decrypted Base key for user 4e4efff6 (new path)`
- EIP-3009 signature created from decrypted Base key
- Platform fee of $0.05 charged successfully
- Workflow step executed; paid resource returned 200
- No `DECRYPT MISMATCH` errors thrown

**Backfill verification:** 1027/1027 rows. Zero pubkey mismatches, zero decode errors, zero write errors.

## Commits

In `github.com/rawgroundbeef/x402-jobs-api` (will move to monorepo in Phase 30):

- `0ef9cf7` — feat: encrypt wallet private keys at rest with AES-256-GCM
- `f417405` — feat(wallet): runtime pubkey sanity check + boot guard + positive logs
- `6d002c1` — feat(wallet): migration 006 + remove all legacy plaintext column references

## Carry-overs to future phases

- **Phase 29**: pnpm 10 + `.npmrc` will reduce the supply-chain attack surface that today's wallet encryption fix can't address (anything with `WALLET_ENCRYPTION_SECRET` in env is still exposed to malicious deps)
- **Phase 30 (monorepo merge)**: this code currently lives in the api repo; reference paths in this SUMMARY will need a find/replace from `~/Projects/x402jobs-api/` to `apps/api/` after merge
- **v3.1 (deferred)**: migrate human flow to passkey smart wallets — eliminates custody entirely. This phase's encryption is the interim fix.

## Limitations / known weaknesses

- Single encryption key under platform control — compromise of `WALLET_ENCRYPTION_SECRET` = compromise of all encrypted wallets. Mitigated by treating the secret as P1 (1Password backup), but the architectural ceiling is "you have to trust the platform's key custody." Non-custodial is the only structural fix.
- No HSM/KMS integration — the encryption secret lives in Railway env vars in plaintext at rest on Railway's infrastructure. Acceptable for current TVL (~$1-50/user, low four figures total platform float); revisit if scale warrants.
- Backup file (`wallet-backup-*.json`) lives temporarily on the dev machine in 1Password — should be deleted from local disk once confidence in new path is solid (recommend ~2 weeks).
