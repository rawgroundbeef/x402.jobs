import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkResourceReachable,
  validateResourcesReachable,
} from "../preflight";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkResourceReachable", () => {
    it("should return reachable for 200 response", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await checkResourceReachable(
        { resourceUrl: "https://api.example.com/resource" },
        5000,
      );

      expect(result.reachable).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should return reachable for 402 response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 402 });

      const result = await checkResourceReachable(
        { resourceUrl: "https://api.example.com/resource" },
        5000,
      );

      expect(result.reachable).toBe(true);
    });

    it("should return unreachable for 404 response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      const result = await checkResourceReachable(
        { resourceUrl: "https://api.example.com/resource" },
        5000,
      );

      expect(result.reachable).toBe(false);
      expect(result.reason).toBe("404");
    });

    it("should return unreachable for 500 response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await checkResourceReachable(
        { resourceUrl: "https://api.example.com/resource" },
        5000,
      );

      expect(result.reachable).toBe(false);
      expect(result.reason).toBe("500");
    });

    it("should return unreachable on network error", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await checkResourceReachable(
        { resourceUrl: "https://api.example.com/resource" },
        5000,
      );

      expect(result.reachable).toBe(false);
      expect(result.reason).toBe("ECONNREFUSED");
    });

    it("should return unreachable on timeout", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const result = await checkResourceReachable(
        { resourceUrl: "https://api.example.com/resource" },
        5000,
      );

      expect(result.reachable).toBe(false);
      expect(result.reason).toBe("timeout");
    });

    it("should return reachable when no URL provided", async () => {
      const result = await checkResourceReachable(
        { resourceName: "Test Resource" },
        5000,
      );

      expect(result.reachable).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should use HEAD method for the request", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await checkResourceReachable(
        { resourceUrl: "https://api.example.com/resource" },
        5000,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/resource",
        expect.objectContaining({ method: "HEAD" }),
      );
    });
  });

  describe("validateResourcesReachable", () => {
    it("should return success when all resources are reachable", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await validateResourcesReachable(
        [
          { resourceUrl: "https://api1.example.com", resourceName: "API 1" },
          { resourceUrl: "https://api2.example.com", resourceName: "API 2" },
        ],
        5000,
      );

      expect(result.success).toBe(true);
      expect(result.unreachable).toHaveLength(0);
    });

    it("should return failure when some resources are unreachable", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await validateResourcesReachable(
        [
          { resourceUrl: "https://api1.example.com", resourceName: "API 1" },
          { resourceUrl: "https://api2.example.com", resourceName: "API 2" },
        ],
        5000,
      );

      expect(result.success).toBe(false);
      expect(result.unreachable).toHaveLength(1);
      expect(result.unreachable[0]).toBe("API 2 (503)");
    });

    it("should return failure when all resources are unreachable", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await validateResourcesReachable(
        [
          { resourceUrl: "https://api1.example.com", resourceName: "API 1" },
          { resourceUrl: "https://api2.example.com", resourceName: "API 2" },
        ],
        5000,
      );

      expect(result.success).toBe(false);
      expect(result.unreachable).toHaveLength(2);
    });

    it("should return success for empty resource list", async () => {
      const result = await validateResourcesReachable([], 5000);

      expect(result.success).toBe(true);
      expect(result.unreachable).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should use URL as name when resourceName not provided", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      const result = await validateResourcesReachable(
        [{ resourceUrl: "https://api.example.com/test" }],
        5000,
      );

      expect(result.unreachable[0]).toBe("https://api.example.com/test (404)");
    });

    it("should handle mixed reachable and unreachable resources", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: false, status: 402 }); // 402 is reachable

      const result = await validateResourcesReachable(
        [
          { resourceUrl: "https://api1.example.com", resourceName: "Good API" },
          { resourceUrl: "https://api2.example.com", resourceName: "Bad API" },
          { resourceUrl: "https://api3.example.com", resourceName: "Paid API" },
        ],
        5000,
      );

      expect(result.success).toBe(false);
      expect(result.unreachable).toHaveLength(1);
      expect(result.unreachable[0]).toBe("Bad API (Network error)");
    });

    it("should skip resources without URL", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await validateResourcesReachable(
        [
          { resourceName: "No URL Resource" },
          { resourceUrl: "https://api.example.com", resourceName: "With URL" },
        ],
        5000,
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
