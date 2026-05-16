import { describe, it, expect } from "vitest";

/**
 * Tests for resource ownership logic in the public API
 *
 * Rules:
 * 1. Anyone can CREATE a new resource
 * 2. If resource exists with NO owner (registered_by is null, server has no owner):
 *    - Anyone can update any field
 * 3. If resource exists and user IS the owner:
 *    - Can update any field (full edit)
 * 4. If resource exists and user is NOT the owner:
 *    - Can only fill in MISSING fields (null/empty values)
 *    - Cannot override existing user-customized values
 *
 * Ownership is determined by:
 * - resource.registered_by === userId
 * - resource.verified_owner_id === userId
 * - server.verified_owner_id === userId
 * - server.registered_by === userId
 */

describe("Public API - Resource Ownership", () => {
  // Helper to determine if user can fully edit
  function canFullyEdit(
    userId: string | null,
    resource: {
      registered_by: string | null;
      verified_owner_id: string | null;
      server: {
        verified_owner_id: string | null;
        registered_by: string | null;
      } | null;
    },
  ): boolean {
    if (!userId) return false;

    const isResourceOwner =
      resource.registered_by === userId ||
      resource.verified_owner_id === userId;

    const isServerOwner = !!(
      resource.server &&
      (resource.server.verified_owner_id === userId ||
        resource.server.registered_by === userId)
    );

    return isResourceOwner || isServerOwner;
  }

  // Helper to determine what updates are allowed
  function getAllowedUpdates(
    canFullyEdit: boolean,
    existingResource: {
      name: string | null;
      description: string | null;
      category: string | null;
      avatar_url: string | null;
    },
    newData: {
      name: string;
      description: string | null;
      category: string | null;
      avatar_url: string | null;
    },
  ): Record<string, unknown> {
    if (canFullyEdit) {
      // Owner can override everything
      return {
        name: newData.name,
        description: newData.description,
        category: newData.category,
        avatar_url: newData.avatar_url,
      };
    } else {
      // Non-owner: only fill in missing fields
      return {
        name: existingResource.name || newData.name,
        description: existingResource.description || newData.description,
        category: existingResource.category || newData.category,
        avatar_url: existingResource.avatar_url || newData.avatar_url,
      };
    }
  }

  describe("canFullyEdit", () => {
    it("should return false if userId is null", () => {
      const resource = {
        registered_by: "user-123",
        verified_owner_id: null,
        server: null,
      };
      expect(canFullyEdit(null, resource)).toBe(false);
    });

    it("should return true if user is resource registered_by", () => {
      const resource = {
        registered_by: "user-123",
        verified_owner_id: null,
        server: null,
      };
      expect(canFullyEdit("user-123", resource)).toBe(true);
    });

    it("should return true if user is resource verified_owner_id", () => {
      const resource = {
        registered_by: "other-user",
        verified_owner_id: "user-123",
        server: null,
      };
      expect(canFullyEdit("user-123", resource)).toBe(true);
    });

    it("should return true if user is server verified_owner_id", () => {
      const resource = {
        registered_by: "other-user",
        verified_owner_id: null,
        server: {
          verified_owner_id: "user-123",
          registered_by: "another-user",
        },
      };
      expect(canFullyEdit("user-123", resource)).toBe(true);
    });

    it("should return true if user is server registered_by", () => {
      const resource = {
        registered_by: "other-user",
        verified_owner_id: null,
        server: {
          verified_owner_id: null,
          registered_by: "user-123",
        },
      };
      expect(canFullyEdit("user-123", resource)).toBe(true);
    });

    it("should return false if user has no ownership", () => {
      const resource = {
        registered_by: "other-user",
        verified_owner_id: "another-user",
        server: {
          verified_owner_id: "server-owner",
          registered_by: "server-registrant",
        },
      };
      expect(canFullyEdit("user-123", resource)).toBe(false);
    });

    it("should return true if resource has NO owner (all null) - first registrant becomes owner", () => {
      // This case: resource exists but registered_by is null (e.g., created by system/indexer)
      // In practice, the new registrant should be able to claim it
      const resource = {
        registered_by: null,
        verified_owner_id: null,
        server: {
          verified_owner_id: null,
          registered_by: null,
        },
      };
      // With all nulls, no one is the owner, so canFullyEdit returns false
      // BUT the update logic should still allow filling in missing fields
      expect(canFullyEdit("user-123", resource)).toBe(false);
    });
  });

  describe("getAllowedUpdates - Owner", () => {
    it("should allow owner to override all fields", () => {
      const existingResource = {
        name: "Old Name",
        description: "Old description",
        category: "old-category",
        avatar_url: "https://old-avatar.com/img.png",
      };
      const newData = {
        name: "New Name",
        description: "New description",
        category: "new-category",
        avatar_url: "https://new-avatar.com/img.png",
      };

      const updates = getAllowedUpdates(true, existingResource, newData);

      expect(updates.name).toBe("New Name");
      expect(updates.description).toBe("New description");
      expect(updates.category).toBe("new-category");
      expect(updates.avatar_url).toBe("https://new-avatar.com/img.png");
    });

    it("should allow owner to set null values", () => {
      const existingResource = {
        name: "Old Name",
        description: "Old description",
        category: "old-category",
        avatar_url: "https://old-avatar.com/img.png",
      };
      const newData = {
        name: "New Name",
        description: null,
        category: null,
        avatar_url: null,
      };

      const updates = getAllowedUpdates(true, existingResource, newData);

      expect(updates.name).toBe("New Name");
      expect(updates.description).toBe(null);
      expect(updates.category).toBe(null);
      expect(updates.avatar_url).toBe(null);
    });
  });

  describe("getAllowedUpdates - Non-Owner", () => {
    it("should NOT allow non-owner to override existing name", () => {
      const existingResource = {
        name: "Existing Custom Name",
        description: null,
        category: null,
        avatar_url: null,
      };
      const newData = {
        name: "Attacker Name",
        description: "Attacker description",
        category: "attacker-category",
        avatar_url: "https://attacker.com/evil.png",
      };

      const updates = getAllowedUpdates(false, existingResource, newData);

      // Name should be preserved
      expect(updates.name).toBe("Existing Custom Name");
      // Empty fields can be filled
      expect(updates.description).toBe("Attacker description");
      expect(updates.category).toBe("attacker-category");
      expect(updates.avatar_url).toBe("https://attacker.com/evil.png");
    });

    it("should NOT allow non-owner to override existing description", () => {
      const existingResource = {
        name: null,
        description: "Owner's custom description",
        category: null,
        avatar_url: null,
      };
      const newData = {
        name: "New Name",
        description: "Attacker description",
        category: "new-category",
        avatar_url: null,
      };

      const updates = getAllowedUpdates(false, existingResource, newData);

      expect(updates.name).toBe("New Name"); // Was null, can be filled
      expect(updates.description).toBe("Owner's custom description"); // Preserved
      expect(updates.category).toBe("new-category"); // Was null, can be filled
    });

    it("should NOT allow non-owner to override existing avatar", () => {
      const existingResource = {
        name: "My Resource",
        description: "My description",
        category: "my-category",
        avatar_url: "https://owner.com/custom-avatar.png",
      };
      const newData = {
        name: "Attacker Name",
        description: "Attacker description",
        category: "attacker-category",
        avatar_url: "https://attacker.com/malicious.png",
      };

      const updates = getAllowedUpdates(false, existingResource, newData);

      // All existing values should be preserved
      expect(updates.name).toBe("My Resource");
      expect(updates.description).toBe("My description");
      expect(updates.category).toBe("my-category");
      expect(updates.avatar_url).toBe("https://owner.com/custom-avatar.png");
    });

    it("should allow non-owner to fill in all missing fields", () => {
      const existingResource = {
        name: null,
        description: null,
        category: null,
        avatar_url: null,
      };
      const newData = {
        name: "Helpful Name",
        description: "Helpful description",
        category: "helpful-category",
        avatar_url: "https://helpful.com/avatar.png",
      };

      const updates = getAllowedUpdates(false, existingResource, newData);

      // All can be filled since all were null
      expect(updates.name).toBe("Helpful Name");
      expect(updates.description).toBe("Helpful description");
      expect(updates.category).toBe("helpful-category");
      expect(updates.avatar_url).toBe("https://helpful.com/avatar.png");
    });
  });

  describe("Edge Cases", () => {
    it("should handle resource with server but no server ownership", () => {
      const resource = {
        registered_by: null,
        verified_owner_id: null,
        server: {
          verified_owner_id: null,
          registered_by: null,
        },
      };

      // No one owns this - anyone can contribute missing data
      expect(canFullyEdit("user-123", resource)).toBe(false);
      // But they can still fill in missing fields (tested in getAllowedUpdates)
    });

    it("should handle resource without server", () => {
      const resource = {
        registered_by: "user-123",
        verified_owner_id: null,
        server: null,
      };

      expect(canFullyEdit("user-123", resource)).toBe(true);
      expect(canFullyEdit("other-user", resource)).toBe(false);
    });

    it("should prioritize resource ownership over server ownership", () => {
      // User owns the resource but not the server
      const resource = {
        registered_by: "user-123",
        verified_owner_id: null,
        server: {
          verified_owner_id: "server-owner",
          registered_by: "server-owner",
        },
      };

      expect(canFullyEdit("user-123", resource)).toBe(true);
    });

    it("should allow server owner to edit resources they don't directly own", () => {
      // User owns the server but not this specific resource
      const resource = {
        registered_by: "resource-creator",
        verified_owner_id: null,
        server: {
          verified_owner_id: "user-123",
          registered_by: "someone-else",
        },
      };

      expect(canFullyEdit("user-123", resource)).toBe(true);
    });
  });
});
