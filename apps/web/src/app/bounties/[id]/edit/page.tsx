import HiringEditPage from "@/components/pages/HiringEditPage";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HiringEditPage id={id} />;
}
