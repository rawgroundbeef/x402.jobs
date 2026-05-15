import { describe, it, expect } from "vitest";
import { dollarsToAtomicString } from "../usdc-amount";

describe("dollarsToAtomicString — HIGH-08 boundary cases", () => {
  it('converts 0.1 USDC to exactly "100000"', () => {
    // The smoking-gun case: prior `String(0.1 * 1_000_000)` produced
    // "100000.00000000001" (float drift). Math.round / bigint string
    // round-trip must land on "100000" exactly.
    expect(dollarsToAtomicString(0.1)).toBe("100000");
  });

  it('converts 0.01 USDC to "10000"', () => {
    expect(dollarsToAtomicString(0.01)).toBe("10000");
  });

  it('converts 1 USDC to "1000000"', () => {
    expect(dollarsToAtomicString(1)).toBe("1000000");
  });

  it('converts 999.99 USDC to "999990000"', () => {
    expect(dollarsToAtomicString(999.99)).toBe("999990000");
  });

  it('converts smallest representable atomic to "1"', () => {
    expect(dollarsToAtomicString(0.000001)).toBe("1");
  });

  it('converts 0 to "0"', () => {
    expect(dollarsToAtomicString(0)).toBe("0");
  });

  it("throws on negative input", () => {
    expect(() => dollarsToAtomicString(-1)).toThrow();
  });

  it("throws on Infinity", () => {
    expect(() => dollarsToAtomicString(Infinity)).toThrow();
  });

  it("throws on NaN", () => {
    expect(() => dollarsToAtomicString(NaN)).toThrow();
  });

  it("does NOT produce a decimal-containing string for fractional markup", () => {
    // Regression guard: prior code produced "123456.789..." style strings
    // which broke facilitator BigInt parsing. The output MUST be a string
    // of pure digits, with no '.' or scientific notation.
    const result = dollarsToAtomicString(0.123456789);
    expect(result).not.toContain(".");
    expect(/^\d+$/.test(result)).toBe(true);
  });

  it("handles a typical creator markup of 0.05 USDC without drift", () => {
    // 5 cents — a common markup. With raw float math:
    //   String(0.05 * 1_000_000) === "50000.00000000001"
    // The helper must return "50000".
    expect(dollarsToAtomicString(0.05)).toBe("50000");
  });

  it("handles fractional markup that previously produced float drift", () => {
    // 0.029 USDC = 29000 atomic units exactly.
    // String(0.029 * 1_000_000) === "28999.999999999996" (drift).
    expect(dollarsToAtomicString(0.029)).toBe("29000");
  });
});
