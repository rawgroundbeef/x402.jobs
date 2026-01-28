import { Suspense } from "react";
import ResourcesListPage from "@/components/pages/ResourcesListPage";

export default function Page() {
  return (
    <Suspense>
      <ResourcesListPage />
    </Suspense>
  );
}
