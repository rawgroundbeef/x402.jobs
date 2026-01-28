import ResourceDetailPage from "@/components/pages/ResourceDetailPage";

interface PageProps {
  params: Promise<{ serverSlug: string; resourceSlug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { serverSlug, resourceSlug } = await params;

  return (
    <ResourceDetailPage serverSlug={serverSlug} resourceSlug={resourceSlug} />
  );
}
