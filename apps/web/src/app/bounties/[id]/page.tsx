import { Metadata } from "next";
import HiringDetailPage from "@/components/pages/HiringDetailPage";

const API_URL =
  process.env.NEXT_PUBLIC_X402_JOBS_API_URL || "https://api.x402.jobs";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://x402.jobs";

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const request = await getRequest(id);

  if (!request) {
    return {
      title: "Job Request Not Found | x402.jobs",
      description: "This job request could not be found.",
    };
  }

  const bounty = `$${parseFloat(request.bounty_amount).toFixed(0)}`;
  const statusText =
    request.escrow_status === "funded" ? "Funded" : request.status;
  const title = `${bounty} Bounty: ${request.title} | x402.jobs`;
  const description =
    request.description ||
    `${bounty} bounty for "${request.title}". Status: ${statusText}. Post bounties, get jobs built on x402.jobs.`;

  return {
    title,
    description,
    keywords: request.tags?.join(", "),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/bounties/${id}`,
      siteName: "x402.jobs",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <HiringDetailPage id={id} />;
}
