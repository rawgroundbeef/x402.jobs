import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ============================================================================
// HIGH-04 — Cross-user file planting prevention.
//
// These tests prove that the upload routes derive ownership exclusively from
// the authenticated user (`req.user!.id`), NOT from `userId` in the request
// body. Pre-fix, an attacker could POST `{ userId: 'victim-id' }` and write
// to the victim's storage namespace.
// ============================================================================

const ATTACKER_USER_ID = "user-A-authenticated";
const VICTIM_USER_ID = "user-B-victim";

// ============================================================================
// Mocks
// ============================================================================

// Capture file paths used in storage operations so the tests can assert which
// user-id was actually used for the namespace.
const capturedSignedUrlPaths: string[] = [];
const capturedUploadPaths: string[] = [];

function makeStorageMock() {
  const fromMock = {
    createSignedUploadUrl: vi.fn((filePath: string) => {
      capturedSignedUrlPaths.push(filePath);
      return Promise.resolve({
        data: { signedUrl: `https://signed.example/${filePath}` },
        error: null,
      });
    }),
    getPublicUrl: vi.fn((filePath: string) => ({
      data: { publicUrl: `https://public.example/${filePath}` },
    })),
    upload: vi.fn((filePath: string) => {
      capturedUploadPaths.push(filePath);
      return Promise.resolve({ data: { path: filePath }, error: null });
    }),
    list: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  return {
    storage: {
      from: () => fromMock,
    },
  };
}

let supabaseStub: ReturnType<typeof makeStorageMock>;

vi.mock("../../lib/supabase", () => ({
  getSupabase: () => supabaseStub,
}));

// HIGH-13 (28-09): /upload/from-url now uses httpClient (axios +
// request-filtering-agent) instead of native fetch + safeFetch. Stub the
// httpClient module so the test never dials real sockets.
const { httpClientMock } = vi.hoisted(() => ({
  httpClientMock: {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  },
}));
vi.mock("../../lib/http-client", async () => {
  const actual = await vi.importActual<typeof import("../../lib/http-client")>(
    "../../lib/http-client",
  );
  return {
    ...actual,
    httpClient: httpClientMock,
  };
});

// Import the router under test after mocks are installed.
import { uploadRouter } from "../upload";

// ============================================================================
// Test app helper — installs a fake auth middleware that injects `req.user`
// from a header, so each test can simulate "I am user-A".
// ============================================================================

function createTestApp(authenticatedUserId: string) {
  const app = express();
  app.use(express.json());
  // Fake auth: inject the authenticated user. Mirrors the production middleware
  // contract (req.user.id set by Supabase token verification).
  app.use((req, _res, next) => {
    req.user = { id: authenticatedUserId, email: "a@example.com" };
    next();
  });
  app.use("/upload", uploadRouter);
  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe("HIGH-04: upload routes ignore userId from body", () => {
  beforeEach(() => {
    capturedSignedUrlPaths.length = 0;
    capturedUploadPaths.length = 0;
    supabaseStub = makeStorageMock();

    // httpClient.get returns an axios-shaped response: data is a Buffer (image),
    // headers expose content-type and content-length.
    const pngBytes = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    ]);
    httpClientMock.get.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "image/png",
        "content-length": String(pngBytes.length),
      },
      data: pngBytes,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // /signed-url
  // --------------------------------------------------------------------------

  it("POST /upload/signed-url with attacker userId in body uses authenticated user (cross-user planting prevented)", async () => {
    const app = createTestApp(ATTACKER_USER_ID);
    const res = await request(app).post("/upload/signed-url").send({
      fileName: "evidence.png",
      fileType: "image/png",
      fileSize: 1024,
      uploadType: "user-avatar",
      userId: VICTIM_USER_ID, // <-- attacker plants a userId
    });

    expect(res.status).toBe(200);
    expect(capturedSignedUrlPaths.length).toBe(1);
    // Path must contain the authenticated user id, NOT the victim.
    expect(capturedSignedUrlPaths[0]).toContain(ATTACKER_USER_ID);
    expect(capturedSignedUrlPaths[0]).not.toContain(VICTIM_USER_ID);
  });

  it("POST /upload/signed-url with NO userId in body works and uses authenticated user", async () => {
    const app = createTestApp(ATTACKER_USER_ID);
    const res = await request(app).post("/upload/signed-url").send({
      fileName: "ok.png",
      fileType: "image/png",
      fileSize: 1024,
      uploadType: "resource-input",
    });

    expect(res.status).toBe(200);
    expect(capturedSignedUrlPaths[0]).toContain(ATTACKER_USER_ID);
  });

  // --------------------------------------------------------------------------
  // /from-url
  // --------------------------------------------------------------------------

  it("POST /upload/from-url with attacker userId in body uses authenticated user (cross-user planting prevented)", async () => {
    const app = createTestApp(ATTACKER_USER_ID);
    const res = await request(app).post("/upload/from-url").send({
      imageUrl: "https://example.com/img.png",
      uploadType: "user-avatar",
      userId: VICTIM_USER_ID, // <-- attacker plants a userId
    });

    expect(res.status).toBe(200);
    expect(capturedUploadPaths.length).toBe(1);
    expect(capturedUploadPaths[0]).toContain(ATTACKER_USER_ID);
    expect(capturedUploadPaths[0]).not.toContain(VICTIM_USER_ID);
  });
});
