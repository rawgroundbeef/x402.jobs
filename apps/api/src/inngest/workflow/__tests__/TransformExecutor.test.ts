import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeTransform, type TransformContext } from "../TransformExecutor";
import type { WorkflowTransform } from "../types";

describe("TransformExecutor", async () => {
  // Silence console output during tests
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe("getTransformInput (via sourceNodeId)", async () => {
    it("should get input from sourceNodeId when specified", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "extract",
        sourceNodeId: "resource-1",
        config: { path: "data.value" },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": { data: { value: "correct-value" } },
          "resource-2": { data: { value: "wrong-value" } },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe("correct-value");
    });

    it("should handle missing sourceNodeId gracefully", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "extract",
        // No sourceNodeId - should use fallback
        config: { path: "value" },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": { value: "only-value" },
        },
      };

      const result = await executeTransform(transform, ctx);

      // Without sourceNodeId, it uses the last entry in outputs
      // This is the fallback behavior we're testing
      expect(result.success).toBe(true);
    });
  });

  describe("extract transform", async () => {
    it("should extract a simple path from an object", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "extract",
        sourceNodeId: "resource-1",
        config: { path: "artifactUrl" },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": {
            jobId: "job-123",
            state: "succeeded",
            artifactUrl: "https://example.com/image.png",
            response: "Your PFP is ready!",
          },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe("https://example.com/image.png");
    });

    it("should extract nested path", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "extract",
        sourceNodeId: "resource-1",
        config: { path: "data.items[0].name" },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": {
            data: {
              items: [{ name: "first" }, { name: "second" }],
            },
          },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe("first");
    });

    it("should return undefined for missing path", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "extract",
        sourceNodeId: "resource-1",
        config: { path: "nonexistent.path" },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": { data: "value" },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBeUndefined();
    });

    it("should fail gracefully when input is a string instead of object", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "extract",
        sourceNodeId: "resource-1",
        config: { path: "artifactUrl" },
      };

      const ctx: TransformContext = {
        outputs: {
          // This is what was happening before the fix - getting a string instead of object
          "resource-1": "A masterpiece-quality prompt text...",
        },
      };

      const result = await executeTransform(transform, ctx);

      // Should not crash, but output will be undefined
      expect(result.success).toBe(true);
      expect(result.output).toBeUndefined();
    });
  });

  describe("code transform", async () => {
    it("should execute JavaScript code on input", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "code",
        sourceNodeId: "resource-1",
        config: { code: "return input.value * 2;" },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": { value: 21 },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe(42);
    });

    it("should handle JSON parsing in code", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "code",
        sourceNodeId: "resource-1",
        config: {
          code: `
            const parsed = JSON.parse(input.response);
            return parsed.data.items.map(item => item.title);
          `,
        },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": {
            response: JSON.stringify({
              data: {
                items: [{ title: "First" }, { title: "Second" }],
              },
            }),
          },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toEqual(["First", "Second"]);
    });

    it("should handle code errors gracefully", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "code",
        sourceNodeId: "resource-1",
        config: { code: "throw new Error('Intentional error');" },
      };

      const ctx: TransformContext = {
        outputs: { "resource-1": {} },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Intentional error");
    });

    // The following tests assert the security boundaries of the isolated-vm
    // sandbox. If any of these start passing where the user-supplied code
    // actually gets a value (instead of failing), the sandbox is broken and
    // CRIT-01 from the Phase 28 security review has been reintroduced.
    describe("sandbox isolation (CRIT-01 regression guards)", () => {
      const runCode = async (code: string) => {
        return await executeTransform(
          {
            nodeId: "t",
            transformType: "code",
            sourceNodeId: "r",
            config: { code },
          },
          { outputs: { r: {} } },
        );
      };

      it("blocks access to process / process.env", async () => {
        const result = await runCode(
          "return typeof process === 'undefined' ? 'blocked' : process.env;",
        );
        expect(result.success).toBe(true);
        expect(result.output).toBe("blocked");
      });

      it("blocks access to require", async () => {
        const result = await runCode(
          "return typeof require === 'undefined' ? 'blocked' : 'leaked';",
        );
        expect(result.success).toBe(true);
        expect(result.output).toBe("blocked");
      });

      it("blocks access to global / globalThis host objects", async () => {
        // globalThis exists in the isolate but its surface is empty — no Node
        // globals reachable through it.
        const result = await runCode(
          "return typeof globalThis.process === 'undefined' && typeof globalThis.require === 'undefined' ? 'blocked' : 'leaked';",
        );
        expect(result.success).toBe(true);
        expect(result.output).toBe("blocked");
      });

      it("blocks access to fetch / setTimeout / setInterval", async () => {
        const result = await runCode(
          "return [typeof fetch, typeof setTimeout, typeof setInterval].every(t => t === 'undefined') ? 'blocked' : 'leaked';",
        );
        expect(result.success).toBe(true);
        expect(result.output).toBe("blocked");
      });

      it("times out runaway loops", async () => {
        const result = await runCode("while(true){}");
        expect(result.success).toBe(false);
        expect(result.error?.toLowerCase()).toMatch(
          /time|script execution timed out/,
        );
      }, 10000); // vitest timeout for the test itself; sandbox internal timeout is 5s
    });
  });

  describe("combine transform", async () => {
    it("should combine outputs from multiple nodes", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-combine",
        transformType: "combine",
        config: {
          combineFields: [
            { fieldName: "imageUrl", sourceNodeId: "transform-extract-url" },
            {
              fieldName: "captions",
              sourceNodeId: "transform-format-captions",
            },
          ],
        },
      };

      const ctx: TransformContext = {
        outputs: {
          "transform-extract-url": "https://example.com/image.png",
          "transform-format-captions": "1. Caption one\n2. Caption two",
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        imageUrl: "https://example.com/image.png",
        captions: "1. Caption one\n2. Caption two",
      });
    });

    it("should handle missing source nodes gracefully", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-combine",
        transformType: "combine",
        config: {
          combineFields: [
            { fieldName: "imageUrl", sourceNodeId: "missing-node" },
            { fieldName: "captions", sourceNodeId: "transform-captions" },
          ],
        },
      };

      const ctx: TransformContext = {
        outputs: {
          "transform-captions": "Some captions",
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        imageUrl: null,
        captions: "Some captions",
      });
    });

    it("should extract nested paths from combined fields", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-combine",
        transformType: "combine",
        config: {
          combineFields: [
            {
              fieldName: "url",
              sourceNodeId: "resource-1",
              sourcePath: "data.artifactUrl",
            },
          ],
        },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": {
            data: { artifactUrl: "https://example.com/artifact.png" },
          },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        url: "https://example.com/artifact.png",
      });
    });
  });

  describe("template transform", async () => {
    it("should replace placeholders in template using {{input.field}} syntax", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "template",
        sourceNodeId: "resource-1",
        config: {
          template: "Hello, {{input.name}}! Your score is {{input.score}}.",
        },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": { name: "Alice", score: 100 },
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Hello, Alice! Your score is 100.");
    });

    it("should replace {{input}} with the full input", async () => {
      const transform: WorkflowTransform = {
        nodeId: "transform-1",
        transformType: "template",
        sourceNodeId: "resource-1",
        config: { template: "Result: {{input}}" },
      };

      const ctx: TransformContext = {
        outputs: {
          "resource-1": "hello world",
        },
      };

      const result = await executeTransform(transform, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Result: hello world");
    });
  });
});
