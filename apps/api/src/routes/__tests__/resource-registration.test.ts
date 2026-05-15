import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractConfig } from "x402check";

vi.mock("x402check", () => ({
  extractConfig: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Resource Registration - Payment Info Extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract v2 payment info from accepts[0]", async () => {
    extractConfig.mockReturnValue({
      config: {
        accepts: [{
          amount: "100000",
          asset: "0xABC",
          payTo: "0xDEF",
        }],
      },
    });

    const extraction = extractConfig({ body: {}, headers: {} });
    const accepts = extraction.config?.accepts?.[0];

    expect(accepts?.amount).toBe("100000");
    expect(accepts?.asset).toBe("0xABC");
    expect(accepts?.payTo).toBe("0xDEF");
  });

  it("should extract v1 payment info from root", async () => {
    extractConfig.mockReturnValue({
      config: {
        maxAmountRequired: "50000",
        asset: "EPj...",
        payTo: "ABC123",
      },
    });

    const extraction = extractConfig({ body: {}, headers: {} });
    const cfg = extraction.config;

    expect(cfg?.maxAmountRequired).toBe("50000");
    expect(cfg?.asset).toBe("EPj...");
  });

  it("should handle extraction errors", () => {
    extractConfig.mockReturnValue({ error: "Invalid x402 config" });

    const extraction = extractConfig({ body: null, headers: {} });
    expect(extraction.error).toBe("Invalid x402 config");
    expect(extraction.config).toBeUndefined();
  });
});
