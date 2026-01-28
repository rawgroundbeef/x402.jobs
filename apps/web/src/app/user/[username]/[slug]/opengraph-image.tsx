import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "x402.jobs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const API_URL =
  process.env.NEXT_PUBLIC_X402_JOBS_API_URL || "https://api.x402.jobs";

interface JobData {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  avatar_url?: string;
  owner_username?: string;
  network?: string;
}

async function getJob(
  username: string,
  slug: string,
): Promise<JobData | null> {
  try {
    const res = await fetch(`${API_URL}/jobs/view/${username}/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.job;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const job = await getJob(username, slug);

  const jobPath = job
    ? `@${job.owner_username || username}/${job.slug || slug}`
    : `@${username}/${slug}`;
  const jobName = job?.name || "Job";
  const avatarUrl = job?.avatar_url;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 25% 25%, #1a1a2e 0%, transparent 50%), radial-gradient(circle at 75% 75%, #16213e 0%, transparent 50%)",
        }}
      >
        {/* Top bar with logo */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 60,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
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

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          {/* Job avatar or default icon */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              width={120}
              height={120}
              style={{
                borderRadius: 24,
                objectFit: "cover",
                border: "4px solid rgba(34, 197, 94, 0.3)",
              }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 24,
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "4px solid rgba(34, 197, 94, 0.3)",
              }}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          )}

          {/* Job path */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "system-ui",
              textAlign: "center",
              maxWidth: 900,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {jobPath}
          </div>

          {/* Job name if different from path */}
          {jobName && jobName !== jobPath && (
            <div
              style={{
                fontSize: 24,
                color: "#a1a1aa",
                fontFamily: "system-ui",
                textAlign: "center",
                maxWidth: 800,
              }}
            >
              {jobName}
            </div>
          )}
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#71717a",
            fontSize: 20,
            fontFamily: "system-ui",
          }}
        >
          Automated workflows powered by X402
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

