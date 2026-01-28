import { Metadata } from "next";
import { UserProfilePage } from "@/components/pages/UserProfilePage";

const API_URL =
  process.env.NEXT_PUBLIC_X402_JOBS_API_URL || "https://api.x402.jobs";

interface PageProps {
  params: Promise<{ username: string }>;
}

interface ProfileData {
  profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
  jobCount: number;
}

// Strip @ prefix if present (from /@username URL rewrite)
function cleanUsername(username: string): string {
  return username.startsWith("@") ? username.slice(1) : username;
}

async function getProfile(username: string): Promise<ProfileData | null> {
  try {
    const clean = cleanUsername(username);
    const res = await fetch(`${API_URL}/user/public/${clean}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username: rawUsername } = await params;
  const username = cleanUsername(rawUsername);
  const data = await getProfile(username);

  const displayName = data?.profile?.display_name || `@${username}`;
  const title = `${displayName} | x402.jobs`;
  const description =
    data?.profile?.bio ||
    `${displayName} has ${data?.jobCount || 0} public jobs on x402.jobs`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "x402.jobs",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { username: rawUsername } = await params;
  const username = cleanUsername(rawUsername);
  return <UserProfilePage username={username} />;
}
