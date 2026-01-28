import { use } from "react";
import ServerDetailPage from "@/components/pages/ServerDetailPage";

export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <ServerDetailPage serverSlug={slug} />;
}
