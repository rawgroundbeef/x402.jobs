"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@x402jobs/ui/utils";
import BaseLayout from "@/components/BaseLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  User,
  Wallet,
  Gift,
  Bell,
  MoreHorizontal,
  Briefcase,
  Puzzle,
  History,
  X,
  Loader2,
  LayoutDashboard,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  exact?: boolean;
}

interface DashboardNavProps {
  navItems: NavItem[];
  onItemClick?: () => void;
}

/** Reusable nav list for dashboard-style sidebars */
export function DashboardNav({ navItems, onItemClick }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Bottom tab configuration
const PRIMARY_TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/rewards", label: "Rewards", icon: Gift },
  { href: "/dashboard/notifications", label: "Notifs", icon: Bell },
];

const MORE_ITEMS = [
  { href: "/dashboard/account", label: "Account", icon: User },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/integrations", label: "Integrations", icon: Puzzle },
  { href: "/dashboard/history", label: "History", icon: History },
];

interface BottomTabsProps {
  onMoreClick: () => void;
}

function BottomTabs({ onMoreClick }: BottomTabsProps) {
  const pathname = usePathname();

  // Check if current path is in "More" items
  const isMoreActive = MORE_ITEMS.some((item) =>
    pathname.startsWith(item.href),
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border md:hidden z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {PRIMARY_TABS.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 min-w-[60px] rounded-lg transition-colors",
                isActive
                  ? "text-[#10b981]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className={cn(
            "flex flex-col items-center gap-1 p-2 min-w-[60px] rounded-lg transition-colors",
            isMoreActive
              ? "text-[#10b981]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

function MoreSheet({ isOpen, onClose }: MoreSheetProps) {
  const pathname = usePathname();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 md:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-2xl z-50 md:hidden animate-in slide-in-from-bottom duration-200">
        <div className="p-4">
          {/* Handle */}
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />

          {/* Menu items */}
          <nav className="space-y-1">
            {MORE_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary/10 text-[#10b981]"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                </Link>
              );
            })}
          </nav>

          {/* Cancel button */}
          <button
            onClick={onClose}
            className="w-full mt-4 p-4 text-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>

        {/* Safe area padding for phones with home indicator */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </>
  );
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
}

export default function DashboardLayout({
  children,
  navItems,
}: DashboardLayoutProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </BaseLayout>
    );
  }

  // Don't render dashboard content if not authenticated
  if (!user) {
    return (
      <BaseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout>
      <div className="grid gap-6 md:grid-cols-[200px,1fr] items-start">
        {/* Desktop sidebar */}
        <div className="hidden md:block px-6 py-3">
          <DashboardNav navItems={navItems} />
        </div>

        {/* Main content - add bottom padding on mobile for tab bar */}
        <div className="px-4 md:px-0 md:pr-6 py-3 pb-24 md:pb-3">
          {children}
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <BottomTabs onMoreClick={() => setIsMoreOpen(true)} />

      {/* More sheet */}
      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </BaseLayout>
  );
}
