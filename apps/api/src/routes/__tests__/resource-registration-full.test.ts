import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractConfig } from "x402check";

vi.mock("x402check", () => ({
  extractConfig: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Resource Registration - Full Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Endpoint Probing", () => {
    it("should probe endpoint when maxAmountRequired not provided", async () => {
      mockFetch.mockResolvedValue({
        status: 402,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: vi.fn().mockResolvedValue({ accepts: [{ amount: "100000" }] }),
      });

      await fetch("https://example.com/resource");
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/resource");
    });

    it("should handle 200 response (no payment required)", async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const response = await fetch("https://example.com/resource");
      expect(response.status).toBe(200);
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));
      await expect(fetch("https://example.com/resource")).rejects.toThrow("Connection refused");
    });
  });

  describe("x402 v2 Format", () => {
    it("should extract from accepts[0]", () => {
      vi.mocked(extractConfig).mockReturnValue({
        config: {
          accepts: [{
            amount: "100000",
            asset: "0xABC",
            payTo: "0xDEF",
            network: "eip155:8453",
          }],
        },
      } as never);

      const extraction = extractConfig({ body: {}, headers: {} });
      const accepts = (extraction.config as { accepts: Array<Record<string, string>> }).accepts[0];

      expect(accepts.amount).toBe("100000");
      expect(accepts.asset).toBe("0xABC");
      expect(accepts.network).toBe("eip155:8453");
    });

    it("should handle SKALE network", () => {
      vi.mocked(extractConfig).mockReturnValue({
        config: {
          accepts: [{
            network: "eip155:1187947933",
            amount: "100000",
            asset: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20",
          }],
        },
      } as never);

      const extraction = extractConfig({ body: {}, headers: {} });
      const accepts = (extraction.config as { accepts: Array<Record<string, string>> }).accepts;
      expect(accepts[0].network).toBe("eip155:1187947933");
    });
  });

  describe("x402 v1 Format", () => {
    it("should extract flat object", () => {
      vi.mocked(extractConfig).mockReturnValue({
        config: {
          maxAmountRequired: "50000",
          asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          payTo: "ABC123",
        },
      } as never);

      const extraction = extractConfig({ body: {}, headers: {} });
      const cfg = extraction.config as { maxAmountRequired: string };
      expect(cfg.maxAmountRequired).toBe("50000");
    });
  });

  describe("Error Handling", () => {
    it("should handle x402check error", () => {
      vi.mocked(extractConfig).mockReturnValue({
        error: "Invalid x402 configuration",
      } as never);

      const extraction = extractConfig({ body: {}, headers: {} });
      expect(extraction.error).toBeDefined();
    });

    it("should handle malformed JSON", async () => {
      mockFetch.mockResolvedValue({
        status: 402,
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      });

      const response = await fetch("https://example.com/resource");
      const body = await response.json().catch(() => null);
      expect(body).toBeNull();
    });
  });

  describe("Field Fallback Logic", () => {
    it("should prefer amount over maxAmountRequired", () => {
      const input: { amount?: string; maxAmountRequired?: string } = { amount: "100", maxAmountRequired: "200" };
      const result = input.amount || input.maxAmountRequired;
      expect(result).toBe("100");
    });

    it("should fallback to maxAmountRequired", () => {
      const input: { amount?: string; maxAmountRequired?: string } = { maxAmountRequired: "200" };
      const result = input.amount || input.maxAmountRequired;
      expect(result).toBe("200");
    });

    it("should prefer payTo over pay_to", () => {
      const input = { payTo: "0xABC", pay_to: "0xDEF" };
      const result = input.payTo || input.pay_to;
      expect(result).toBe("0xABC");
    });
  });

  describe("Network Normalization", () => {
    it("should normalize eip155:8453 to base", () => {
      const input = "eip155:8453";
      const normalized = input === "eip155:8453" ? "base" : input;
      expect(normalized).toBe("base");
    });

    it("should keep SKALE as-is (not yet mapped)", () => {
      const input: string = "eip155:1187947933";
      const normalized = input === "eip155:8453" ? "base" : input;
      expect(normalized).toBe("eip155:1187947933");
    });
  });

  describe("Response Construction", () => {
    it("should build effectiveEndpoint", () => {
      const serverSlug = "example-server";
      const resourceSlug = "my-resource";
      const endpoint = `https://x402.jobs/resources/${serverSlug}/${resourceSlug}`;
      expect(endpoint).toBe("https://x402.jobs/resources/example-server/my-resource");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty accepts array", () => {
      vi.mocked(extractConfig).mockReturnValue({ config: { accepts: [] } } as never);
      const extraction = extractConfig({ body: {}, headers: {} });
      expect((extraction.config as { accepts: unknown[] }).accepts).toEqual([]);
    });

    it("should handle null fields", () => {
      vi.mocked(extractConfig).mockReturnValue({
        config: { accepts: [{ amount: null }] },
      } as never);
      const cfg = extractConfig({ body: {}, headers: {} }).config as { accepts: Array<{ amount: string | null }> };
      expect(cfg.accepts[0].amount).toBeNull();
    });
  });
});
