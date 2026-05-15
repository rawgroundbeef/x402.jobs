/**
 * Wallet sweep helper — HIGH-03 / Phase 28 plan 28-07.
 *
 * The DELETE /api/user/account flow may need to drain a user's custodial
 * wallet to an external address before tombstoning the account. The full
 * implementation requires:
 *   1. Decrypt the user's Solana keypair AND Base private key.
 *   2. Construct an SPL-Token transferChecked instruction with the user's
 *      USDC ATA as source and the external recipient's ATA as destination
 *      (creating it if it doesn't exist).
 *   3. Submit on-chain and wait for confirmation.
 *   4. Repeat for Base (ERC-20 USDC transfer using ethers).
 *   5. Handle partial-success (Solana succeeded, Base failed) — refuse to
 *      proceed to soft-delete; surface to the user.
 *
 * That implementation is a non-trivial security-sensitive piece of work
 * — it signs with the user's funds and broadcasts to mainnet. Building it
 * inline in the DELETE handler risks a partial fix that's worse than the
 * 409 gate (which already closes the actual HIGH-03 attack: silent fund
 * loss on account deletion).
 *
 * SHIPPED IN THIS PLAN: the API surface (this module) + the 409 gate that
 * routes users to manual withdrawal. The actual broadcast is wired as a
 * "not implemented" failure that surfaces to the caller via the
 * `sweep_failed` 500 path. Once a v3.1 follow-up wires real on-chain
 * sweep, only this file changes — every caller continues calling
 * `sweepWalletsToAddress(userId, address)`.
 *
 * Tracking: see SUMMARY.md "Known Stubs" — file as v3.1 follow-up.
 */

export interface SweepResult {
  ok: boolean;
  /** Solana transaction signature (present if Solana leg succeeded). */
  solanaSignature?: string;
  /** Base transaction hash (present if Base leg succeeded). */
  baseTxHash?: string;
}

/**
 * Sweep the entire USDC balance from the user's custodial wallet
 * (Solana + Base) to the externally-provided withdrawal address.
 *
 * THROWS on any failure — callers must wrap in try/catch and treat
 * any throw as "do not proceed to soft-delete".
 *
 * @param _userId  - The user whose wallet should be drained.
 * @param _externalAddress - The destination address. Caller is responsible
 *   for validating the address shape (Solana base58 vs Base hex) before
 *   passing it in; we do not validate here because the validation rules
 *   are network-specific and the user provides a single string for both.
 */
export async function sweepWalletsToAddress(
  _userId: string,
  _externalAddress: string,
): Promise<SweepResult> {
  // STUB: real on-chain sweep is a v3.1 follow-up. The 409 balance gate
  // (DELETE /account when balance > $0.01 and no externalWithdrawalAddress)
  // already routes users to manual withdrawal. Posting an address today
  // surfaces this error and tells the user to withdraw manually first.
  throw new Error(
    "sweep_not_implemented: please withdraw your wallet funds manually before deleting your account",
  );
}
