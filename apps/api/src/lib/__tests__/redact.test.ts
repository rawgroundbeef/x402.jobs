import { describe, it, expect } from "vitest";
import { redactPayer, hashSignature } from "../redact";

// ============================================================================
// HIGH-12 — redactPayer / hashSignature unit tests.
// ============================================================================

describe("HIGH-12 redactPayer", () => {
  it("truncates a long address to first 6 + ... + last 4", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    expect(redactPayer(addr)).toBe("0x1234...5678");
  });

  it("returns null unchanged", () => {
    expect(redactPayer(null)).toBeNull();
  });

  it("returns undefined unchanged", () => {
    expect(redactPayer(undefined)).toBeUndefined();
  });

  it("returns a short string (<= 12 chars) unchanged", () => {
    expect(redactPayer("short")).toBe("short");
    expect(redactPayer("abcdefghijkl")).toBe("abcdefghijkl"); // exactly 12
  });
});

describe("HIGH-12 hashSignature", () => {
  it("returns 16 lowercase hex chars for a non-empty input", () => {
    const sig = "abc";
    const out = hashSignature(sig);
    expect(typeof out).toBe("string");
    expect(out).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for the same input", () => {
    const a = hashSignature("hello");
    const b = hashSignature("hello");
    expect(a).toBe(b);
  });

  it("returns null unchanged", () => {
    expect(hashSignature(null)).toBeNull();
  });
});
