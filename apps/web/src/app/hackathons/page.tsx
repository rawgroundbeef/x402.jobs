// HACKATHONS PAGE DISABLED - not giving away more money
// import HackathonsListPage from "@/components/pages/HackathonsListPage";

// export const metadata = {
//   title: "Hackathons | x402.jobs",
//   description: "Compete monthly. Build the best jobs. Win prizes.",
// };

// export default function Page() {
//   return <HackathonsListPage />;
// }

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/");
}
