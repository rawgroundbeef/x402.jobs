import { redirect } from "next/navigation";

// Redirect old /discover URL to new /developers URL
export default function DiscoverRedirect() {
  redirect("/developers");
}
