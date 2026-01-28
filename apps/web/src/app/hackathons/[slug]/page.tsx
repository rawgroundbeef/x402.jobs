import HackathonDetailPage from "@/components/pages/HackathonDetailPage";

export const metadata = {
  title: "Hackathon | x402.jobs",
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <HackathonDetailPage slug={slug} />;
}
