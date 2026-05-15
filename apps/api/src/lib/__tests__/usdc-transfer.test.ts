import { describe, it, expect } from "vitest";
import { usdcToMicroUnits, microUnitsToUsdcDisplay } from "../usdc-transfer";

describe("usdc-transfer helpers", () => {
  describe("usdcToMicroUnits (no float drift — Phase 28 CRIT-04)", () => {
    it("converts whole-dollar amounts", () => {
      expect(usdcToMicroUnits(1)).toBe(1_000_000n);
      expect(usdcToMicroUnits(100)).toBe(100_000_000n);
      expect(usdcToMicroUnits(1000)).toBe(1_000_000_000n);
    });

    it("converts decimal amounts that the old float math handled OK", () => {
      expect(usdcToMicroUnits(1.5)).toBe(1_500_000n);
      expect(usdcToMicroUnits(0.05)).toBe(50_000n);
      expect(usdcToMicroUnits(12.34)).toBe(12_340_000n);
    });

    it("converts the smallest representable USDC amount", () => {
      expect(usdcToMicroUnits(0.000001)).toBe(1n);
    });

    it("converts amounts whose float representation isn't exact", () => {
      // 0.1 * 1_000_000 = 99999.99999999999 in float — the old
      // implementation relied on Math.round to dodge this. The new path
      // routes through toFixed(6) which lands on "0.100000" deterministically.
      expect(usdcToMicroUnits(0.1)).toBe(100_000n);
      // 0.3 has the same float-representation gotcha as 0.1.
      expect(usdcToMicroUnits(0.3)).toBe(300_000n);
      // Common "round number that float gets wrong" cases.
      expect(usdcToMicroUnits(2.4)).toBe(2_400_000n);
      expect(usdcToMicroUnits(9.99)).toBe(9_990_000n);
    });

    it("truncates anything beyond 6 decimals (USDC precision)", () => {
      // toFixed(6) rounds, not truncates — so this rounds the 7th digit.
      expect(usdcToMicroUnits(0.0000004)).toBe(0n);
      expect(usdcToMicroUnits(0.0000006)).toBe(1n);
    });

    it("rejects negative, NaN, and Infinity", () => {
      expect(() => usdcToMicroUnits(-1)).toThrow(/Invalid USDC amount/);
      expect(() => usdcToMicroUnits(NaN)).toThrow(/Invalid USDC amount/);
      expect(() => usdcToMicroUnits(Infinity)).toThrow(/Invalid USDC amount/);
    });
  });

  describe("microUnitsToUsdcDisplay", () => {
    it("formats whole amounts with full precision", () => {
      expect(microUnitsToUsdcDisplay(1_000_000n)).toBe("1.000000");
      expect(microUnitsToUsdcDisplay(100_000_000n)).toBe("100.000000");
    });

    it("formats fractional amounts with leading zeros", () => {
      expect(microUnitsToUsdcDisplay(1n)).toBe("0.000001");
      expect(microUnitsToUsdcDisplay(50_000n)).toBe("0.050000");
      expect(microUnitsToUsdcDisplay(500_000n)).toBe("0.500000");
    });

    it("round-trips usdcToMicroUnits without loss", () => {
      for (const amount of [1, 1.5, 12.34, 0.000001, 999.99]) {
        expect(microUnitsToUsdcDisplay(usdcToMicroUnits(amount))).toBe(
          amount.toFixed(6),
        );
      }
    });
  });
});
