"use client";

import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/account", label: "Account" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/resources", label: "Resources" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/rewards", label: "Rewards" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/api-keys", label: "API Keys" },
  { href: "/dashboard/history", label: "History" },
];

export default function DashboardPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout navItems={NAV_ITEMS}>{children}</DashboardLayout>;
}
