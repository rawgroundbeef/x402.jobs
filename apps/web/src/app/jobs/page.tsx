import { Suspense } from "react";
import JobsListPage from "@/components/pages/JobsListPage";

export default function Page() {
  return (
    <Suspense>
      <JobsListPage />
    </Suspense>
  );
}
