import { Metadata } from "next";
import PublicJobPage from "@/components/pages/PublicJobPage";

const API_URL =
  process.env.NEXT_PUBLIC_X402_JOBS_API_URL || "https://api.x402.jobs";

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
}

interface JobData {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  avatar_url?: string;
  owner_username?: string;
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const job = await getJob(username, slug);

  const jobPath = `@${job?.owner_username || username}/${job?.slug || slug}`;
  const title = job ? `${jobPath} | x402.jobs` : "Job | x402.jobs";
  const description =
    job?.description || `Automated workflow on x402.jobs`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "x402.jobs",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { username, slug } = await params;
  return <PublicJobPage username={username} slug={slug} />;
}
