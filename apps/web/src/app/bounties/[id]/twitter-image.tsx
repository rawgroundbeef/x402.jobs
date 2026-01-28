import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Job Request on x402.jobs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const API_URL =
  process.env.NEXT_PUBLIC_X402_JOBS_API_URL || "https://api.x402.jobs";

interface RequestData {
  id: string;
  title: string;
  description?: string;
  bounty_amount: string;
  status: string;
  escrow_status: string;
  tags?: string[];
  creator_username?: string;
}

async function getRequest(id: string): Promise<RequestData | null> {
  try {
    const res = await fetch(`${API_URL}/bounties/requests/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.request;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getRequest(id);

  const title = request?.title || "Job Request";
  const bounty = request?.bounty_amount
    ? `$${parseFloat(request.bounty_amount).toFixed(0)}`
    : "";
  const status =
    request?.escrow_status === "funded"
      ? "FUNDED"
      : request?.status?.toUpperCase() || "";
  const tags = request?.tags?.slice(0, 3) || [];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 25% 25%, #1a1a2e 0%, transparent 50%), radial-gradient(circle at 75% 75%, #16213e 0%, transparent 50%)",
          padding: 60,
        }}
      >
        {/* Top bar with logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Lightning bolt icon */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#ffffff",
                fontFamily: "system-ui",
              }}
            >
              x402.jobs
            </span>
          </div>

          {/* Status badge */}
          {status && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor:
                  status === "FUNDED"
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(251, 191, 36, 0.2)",
                color: status === "FUNDED" ? "#22c55e" : "#fbbf24",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 600,
                fontFamily: "system-ui",
              }}
            >
              {status === "FUNDED" && (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
              {status}
            </div>
          )}
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 24,
          }}
        >
          {/* Bounty amount */}
          {bounty && (
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: "#22c55e",
                fontFamily: "system-ui",
              }}
            >
              {bounty}
            </div>
          )}

          {/* Title */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "system-ui",
              maxWidth: 900,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {title}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 12 }}>
              {tags.map((tag, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    color: "#a1a1aa",
                    padding: "8px 16px",
                    borderRadius: 6,
                    fontSize: 18,
                    fontFamily: "system-ui",
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#71717a",
            fontSize: 20,
            fontFamily: "system-ui",
          }}
        >
          Job Request • Post bounties, get jobs built
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
