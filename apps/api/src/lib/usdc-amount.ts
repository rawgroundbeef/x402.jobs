import { usdcToMicroUnits } from "./usdc-transfer";

/**
 * Convert a USDC dollar amount (number) to an atomic-unit string suitable
 * for downstream facilitator BigInt parsing.
 *
 * Closes HIGH-08 (Phase 28 security review). The prior pattern
 *   `String(expectedAmount * 1_000_000)`
 * produced decimal-containing strings (e.g. "100000.00000000001" for
 * `0.1`, "28999.999999999996" for `0.029`) because IEEE-754 float
 * multiplication is not exact for most decimal inputs. Facilitator-side
 * BigInt parsing then threw on the embedded `.`, surfacing as opaque
 * payment failures.
 *
 * Implementation: delegates to `usdcToMicroUnits` (introduced by CRIT-04
 * in `lib/usdc-transfer.ts`), which performs a `toFixed(6)` string
 * round-trip and parses each side as `BigInt` — no float arithmetic on
 * the precision-critical path. Stronger than `Math.round(x * 1_000_000)`
 * because the rounding boundary is applied in decimal, not binary,
 * representation.
 *
 * 1 USDC = 1,000,000 atomic units (USDC has 6 decimals).
 *
 * @param dollars - USDC amount as a decimal number (e.g. 12.50 for $12.50)
 * @returns Atomic-unit string (always `/^\d+$/`, never contains a `.`)
 * @throws TypeError if `dollars` is not a finite number
 * @throws RangeError if `dollars` is negative
 */
export function dollarsToAtomicString(dollars: number): string {
  if (typeof dollars !== "number" || !Number.isFinite(dollars)) {
    throw new TypeError(
      `dollarsToAtomicString: expected finite number, got ${dollars}`,
    );
  }
  if (dollars < 0) {
    throw new RangeError(
      `dollarsToAtomicString: negative amount not allowed: ${dollars}`,
    );
  }
  return usdcToMicroUnits(dollars).toString();
}
