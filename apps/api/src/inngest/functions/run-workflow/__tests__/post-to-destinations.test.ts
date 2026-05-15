import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getFieldValue,
  extractFields,
  postToTelegram,
  postToX,
  postToDestinations,
} from "../post-to-destinations";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Twitter API
vi.mock("twitter-api-v2", () => ({
  TwitterApi: vi.fn().mockImplementation(() => ({
    v1: {
      uploadMedia: vi.fn().mockResolvedValue("mock-media-id"),
    },
    v2: {
      tweet: vi.fn().mockResolvedValue({ data: { id: "mock-tweet-id" } }),
    },
  })),
}));

// Helper to create mock Supabase client
function createMockSupabase(overrides: {
  failedEvents?: { id: string }[];
  job?: {
    workflow_definition: unknown;
    user_id: string;
  } | null;
  telegramConfig?: {
    bot_token: string;
    default_chat_id: string;
    is_enabled: boolean;
  } | null;
  xTokens?: {
    access_token: string;
    access_secret: string;
  } | null;
}) {
  const defaults = {
    failedEvents: [],
    job: null,
    telegramConfig: null,
    xTokens: null,
  };
  const config = { ...defaults, ...overrides };

  return {
    from: vi.fn((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === "x402_job_run_events") {
        chain.limit = vi.fn().mockResolvedValue({ data: config.failedEvents });
      } else if (table === "x402_jobs") {
        chain.single = vi.fn().mockResolvedValue({ data: config.job });
      } else if (table === "x402_user_telegram_configs") {
        chain.single = vi
          .fn()
          .mockResolvedValue({ data: config.telegramConfig });
      } else if (table === "x402_user_x_tokens") {
        chain.single = vi.fn().mockResolvedValue({ data: config.xTokens });
      }

      return chain;
    }),
  };
}

describe("post-to-destinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getFieldValue", () => {
    it("should get top-level field", () => {
      const obj = { name: "test", value: 123 };
      expect(getFieldValue(obj, "name")).toBe("test");
      expect(getFieldValue(obj, "value")).toBe(123);
    });

    it("should get nested field", () => {
      const obj = { response: { data: { imageUrl: "https://example.com" } } };
      expect(getFieldValue(obj, "response.data.imageUrl")).toBe(
        "https://example.com",
      );
    });

    it("should return undefined for missing field", () => {
      const obj = { name: "test" };
      expect(getFieldValue(obj, "missing")).toBeUndefined();
      expect(getFieldValue(obj, "missing.nested")).toBeUndefined();
    });

    it("should handle null in path", () => {
      const obj = { response: null };
      expect(getFieldValue(obj, "response.data")).toBeUndefined();
    });
  });

  describe("extractFields", () => {
    it("should extract from configured fields", () => {
      const output = {
        customImage: "https://img.com/1.png",
        customCaption: "Hello world",
      };
      const result = extractFields(output, "customImage", "customCaption");
      expect(result.imageUrl).toBe("https://img.com/1.png");
      expect(result.caption).toBe("Hello world");
    });

    it("should fall back to common image fields", () => {
      expect(
        extractFields({ imageUrl: "https://img.com/1.png" }).imageUrl,
      ).toBe("https://img.com/1.png");
      expect(
        extractFields({ image_url: "https://img.com/2.png" }).imageUrl,
      ).toBe("https://img.com/2.png");
      expect(
        extractFields({ artifactUrl: "https://img.com/3.png" }).imageUrl,
      ).toBe("https://img.com/3.png");
      expect(extractFields({ url: "https://img.com/4.png" }).imageUrl).toBe(
        "https://img.com/4.png",
      );
    });

    it("should fall back to common caption fields", () => {
      expect(extractFields({ caption: "Cap 1" }).caption).toBe("Cap 1");
      expect(extractFields({ text: "Cap 2" }).caption).toBe("Cap 2");
      expect(extractFields({ message: "Cap 3" }).caption).toBe("Cap 3");
      expect(extractFields({ content: "Cap 4" }).caption).toBe("Cap 4");
      expect(extractFields({ tweet: "Cap 5" }).caption).toBe("Cap 5");
    });

    it("should handle string output starting with http as imageUrl", () => {
      const result = extractFields("https://example.com/image.png");
      expect(result.imageUrl).toBe("https://example.com/image.png");
      expect(result.caption).toBeUndefined();
    });

    it("should handle plain string output as caption", () => {
      const result = extractFields("Hello world");
      expect(result.caption).toBe("Hello world");
      expect(result.imageUrl).toBeUndefined();
    });

    it("should handle null/undefined", () => {
      expect(extractFields(null)).toEqual({});
      expect(extractFields(undefined)).toEqual({});
    });

    it("should extract nested fields", () => {
      const output = {
        response: {
          data: {
            imageUrl: "https://nested.com/img.png",
          },
        },
      };
      const result = extractFields(output, "response.data.imageUrl");
      expect(result.imageUrl).toBe("https://nested.com/img.png");
    });
  });

  describe("postToTelegram", () => {
    it("should post photo with caption", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await postToTelegram("bot-token", "chat-123", {
        imageUrl: "https://example.com/img.png",
        caption: "Test caption",
      });

      expect(result.success).toBe(true);
      expect(result.destination).toBe("telegram");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botbot-token/sendPhoto",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("chat-123"),
        }),
      );
    });

    it("should truncate long captions to 1024 chars", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      });

      const longCaption = "a".repeat(2000);
      await postToTelegram("bot-token", "chat-123", {
        imageUrl: "https://example.com/img.png",
        caption: longCaption,
      });

      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs).toBeDefined();
      const callBody = JSON.parse((callArgs[1] as RequestInit).body as string);
      expect(callBody.caption.length).toBeLessThanOrEqual(1024);
      expect(callBody.caption.endsWith("...")).toBe(true);
    });

    it("should send text-only message when no image", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await postToTelegram("bot-token", "chat-123", {
        caption: "Text only message",
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botbot-token/sendMessage",
        expect.any(Object),
      );
    });

    it("should return error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: false, description: "Bot blocked by user" }),
      });

      const result = await postToTelegram("bot-token", "chat-123", {
        caption: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Bot blocked by user");
    });

    it("should return error when no content to post", async () => {
      const result = await postToTelegram("bot-token", "chat-123", {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No content to post");
    });

    it("should handle fetch errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await postToTelegram("bot-token", "chat-123", {
        caption: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("postToX", () => {
    const twitterConfig = { apiKey: "key", apiSecret: "secret" };
    const xTokens = { access_token: "token", access_secret: "secret" };

    it("should post tweet with text", async () => {
      const result = await postToX(twitterConfig, xTokens, {
        caption: "Hello X!",
      });

      expect(result.success).toBe(true);
      expect(result.destination).toBe("x");
      expect(result.details?.tweetId).toBe("mock-tweet-id");
    });

    it("should attempt media upload when image provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        headers: new Headers({ "content-type": "image/png" }),
      });

      const result = await postToX(twitterConfig, xTokens, {
        imageUrl: "https://example.com/img.png",
        caption: "Image tweet",
      });

      // The tweet should succeed (mock returns valid data)
      expect(result.destination).toBe("x");
      // Verify fetch was called for the image
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/img.png");
    });

    it("should handle long captions", async () => {
      const longCaption = "a".repeat(500);
      const result = await postToX(twitterConfig, xTokens, {
        caption: longCaption,
      });

      // Should still attempt to post (caption gets truncated internally)
      expect(result.destination).toBe("x");
    });

    it("should handle errors gracefully", async () => {
      // Create a mock that throws
      const { TwitterApi } = await import("twitter-api-v2");
      vi.mocked(TwitterApi).mockImplementationOnce(() => {
        throw new Error("Auth failed");
      });

      const result = await postToX(twitterConfig, xTokens, {
        caption: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Auth failed");
    });
  });

  describe("postToDestinations", () => {
    it("should skip posting when run has failures", async () => {
      const mockSupabase = createMockSupabase({
        failedEvents: [{ id: "failed-event-1" }],
      });

      const results = await postToDestinations({
        supabase: mockSupabase as any,
        runId: "run-123",
        jobId: "job-123",
        outputs: {},
      });

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should skip when no workflow definition", async () => {
      const mockSupabase = createMockSupabase({
        failedEvents: [],
        job: null,
      });

      const results = await postToDestinations({
        supabase: mockSupabase as any,
        runId: "run-123",
        jobId: "job-123",
        outputs: {},
      });

      expect(results).toEqual([]);
    });

    it("should skip when no output nodes", async () => {
      const mockSupabase = createMockSupabase({
        failedEvents: [],
        job: {
          workflow_definition: { nodes: [], edges: [] },
          user_id: "user-123",
        },
      });

      const results = await postToDestinations({
        supabase: mockSupabase as any,
        runId: "run-123",
        jobId: "job-123",
        outputs: {},
      });

      expect(results).toEqual([]);
    });

    it("should post to Telegram when configured", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      });

      const mockSupabase = createMockSupabase({
        failedEvents: [],
        job: {
          workflow_definition: {
            nodes: [
              {
                id: "output-1",
                type: "output",
                data: {
                  outputConfig: {
                    destinations: [{ type: "telegram", enabled: true }],
                  },
                },
              },
            ],
            edges: [{ source: "resource-1", target: "output-1" }],
          },
          user_id: "user-123",
        },
        telegramConfig: {
          bot_token: "test-bot-token",
          default_chat_id: "chat-123",
          is_enabled: true,
        },
      });

      const results = await postToDestinations({
        supabase: mockSupabase as any,
        runId: "run-123",
        jobId: "job-123",
        outputs: {
          "resource-1": { caption: "Hello from resource" },
        },
      });

      expect(results.length).toBe(1);
      expect(results[0]?.destination).toBe("telegram");
      expect(results[0]?.success).toBe(true);
    });

    it("should skip X posting when twitter not configured", async () => {
      const mockSupabase = createMockSupabase({
        failedEvents: [],
        job: {
          workflow_definition: {
            nodes: [
              {
                id: "output-1",
                type: "output",
                data: {
                  outputConfig: {
                    destinations: [{ type: "x", enabled: true }],
                  },
                },
              },
            ],
            edges: [{ source: "resource-1", target: "output-1" }],
          },
          user_id: "user-123",
        },
        xTokens: {
          access_token: "token",
          access_secret: "secret",
        },
      });

      const results = await postToDestinations({
        supabase: mockSupabase as any,
        runId: "run-123",
        jobId: "job-123",
        outputs: {
          "resource-1": { caption: "Hello" },
        },
        // twitterConfig not provided
      });

      // Should not post because twitterConfig is missing
      expect(results).toEqual([]);
    });

    it("should skip output node when source output is missing", async () => {
      const mockSupabase = createMockSupabase({
        failedEvents: [],
        job: {
          workflow_definition: {
            nodes: [
              {
                id: "output-1",
                type: "output",
                data: {
                  outputConfig: {
                    destinations: [{ type: "telegram", enabled: true }],
                  },
                },
              },
            ],
            edges: [{ source: "resource-1", target: "output-1" }],
          },
          user_id: "user-123",
        },
        telegramConfig: {
          bot_token: "test-bot-token",
          default_chat_id: "chat-123",
          is_enabled: true,
        },
      });

      const results = await postToDestinations({
        supabase: mockSupabase as any,
        runId: "run-123",
        jobId: "job-123",
        outputs: {
          // resource-1 output is missing
        },
      });

      expect(results).toEqual([]);
    });
  });
});
