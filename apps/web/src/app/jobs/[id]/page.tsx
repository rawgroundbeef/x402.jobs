import JobPage from "@/components/pages/JobPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <JobPage jobId={id} />;
}
