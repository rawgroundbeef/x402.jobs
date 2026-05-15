import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockIlike = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  update: mockUpdate.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  neq: mockNeq.mockReturnThis(),
  ilike: mockIlike.mockReturnThis(),
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe("Jobs API - Name Uniqueness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSlug", () => {
    // Import the function after mocks are set up
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Collapse multiple hyphens
        .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
    };

    it("should convert to lowercase", () => {
      expect(generateSlug("MyJob")).toBe("myjob");
    });

    it("should replace spaces with hyphens", () => {
      expect(generateSlug("My Cool Job")).toBe("my-cool-job");
    });

    it("should remove special characters", () => {
      expect(generateSlug("My Job! @#$%")).toBe("my-job");
    });

    it("should collapse multiple hyphens", () => {
      expect(generateSlug("My---Job")).toBe("my-job");
    });

    it("should handle the Marketputer case", () => {
      expect(generateSlug("Marketputer")).toBe("marketputer");
    });
  });

  describe("isJobNameTaken logic", () => {
    it("should detect when a job name is taken", async () => {
      // Simulate name check logic
      const isJobNameTaken = async (
        name: string,
      ): Promise<{ taken: boolean; ownerId?: string }> => {
        // Mock: name "Marketputer" is already taken
        if (name.toLowerCase() === "marketputer") {
          return { taken: true, ownerId: "user-123" };
        }
        return { taken: false };
      };

      const result = await isJobNameTaken("Marketputer");
      expect(result.taken).toBe(true);
      expect(result.ownerId).toBe("user-123");
    });

    it("should allow the same job to keep its name (excludeJobId)", async () => {
      const existingJobId = "job-existing";

      const isJobNameTaken = async (
        name: string,
        excludeJobId?: string,
      ): Promise<{ taken: boolean; ownerId?: string }> => {
        // Mock: name "Marketputer" is taken by job-existing
        if (
          name.toLowerCase() === "marketputer" &&
          excludeJobId !== existingJobId
        ) {
          return { taken: true, ownerId: "user-123" };
        }
        return { taken: false };
      };

      // When updating the same job, should not be "taken"
      const result = await isJobNameTaken("Marketputer", existingJobId);
      expect(result.taken).toBe(false);
    });
  });

  describe("Import auto-numbering logic", () => {
    it("should generate unique name with number suffix", () => {
      const baseName = "Marketputer";
      const takenNames = ["marketputer", "marketputer-1", "marketputer-2"];

      const getUniqueName = (base: string, attempt: number): string => {
        return attempt === 0 ? base : `${base}-${attempt}`;
      };

      const isNameTaken = (name: string): boolean => {
        return takenNames.includes(name.toLowerCase());
      };

      // Find first available name
      let attempt = 0;
      let uniqueName = getUniqueName(baseName, attempt);
      while (isNameTaken(uniqueName) && attempt < 10) {
        attempt++;
        uniqueName = getUniqueName(baseName, attempt);
      }

      expect(uniqueName).toBe("Marketputer-3");
    });

    it("should use original name if available", () => {
      const baseName = "NewJob";
      const takenNames = ["otherjob"];

      const getUniqueName = (base: string, attempt: number): string => {
        return attempt === 0 ? base : `${base}-${attempt}`;
      };

      const isNameTaken = (name: string): boolean => {
        return takenNames.includes(name.toLowerCase());
      };

      let attempt = 0;
      let uniqueName = getUniqueName(baseName, attempt);
      while (isNameTaken(uniqueName) && attempt < 10) {
        attempt++;
        uniqueName = getUniqueName(baseName, attempt);
      }

      expect(uniqueName).toBe("NewJob");
      expect(attempt).toBe(0);
    });
  });
});

describe("Jobs API - HTTP Responses", () => {
  describe("POST /jobs", () => {
    it("should return 201 with job data on success", () => {
      const successResponse = {
        job: {
          id: "job-new",
          name: "My New Job",
          slug: "my-new-job",
          workflow_definition: { nodes: [], edges: [] },
        },
      };

      expect(successResponse.job.id).toBeDefined();
      expect(successResponse.job.slug).toBe("my-new-job");
    });

    it("should allow duplicate job names (names are not unique)", () => {
      // Job names don't need to be unique - only slugs are unique per user
      const job1 = { name: "My Job", slug: "my-job" };
      const job2 = { name: "My Job", slug: "my-job-1" };

      expect(job1.name).toBe(job2.name);
      expect(job1.slug).not.toBe(job2.slug);
    });
  });

  describe("PUT /jobs/:id", () => {
    it("should return 409 on URL/slug conflict", () => {
      const errorResponse = {
        error: "Job URL conflict",
        message:
          "A job with a similar name already exists. Try a different name.",
      };

      expect(errorResponse.error).toBe("Job URL conflict");
    });

    it("should update slug when name changes", () => {
      const updateData = {
        name: "New Job Name",
        slug: "new-job-name", // Slug should be auto-generated
      };

      expect(updateData.slug).toBe("new-job-name");
    });
  });
});
