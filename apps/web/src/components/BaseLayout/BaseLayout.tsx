"use client";

import { type ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Dropdown, DropdownItem } from "@x402jobs/ui/dropdown";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { JobputerChatButton } from "@/components/JobputerChatButton";
import { QuickAddButton } from "@/components/QuickAddButton";
import { SearchButton } from "@/components/SearchButton";
import { MyJobsButton } from "@/components/MyJobsButton";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { HackathonBanner, HackathonBadge } from "@/components/HackathonBanner";
import { RewardsBanner } from "@/components/RewardsBanner";
import { useModals } from "@/contexts/ModalContext";

const NAV_LINKS = [
  { href: "/jobs", label: "Jobs" },
  { href: "/resources", label: "Resources" },
  { href: "/servers", label: "Servers" },
  { href: "/developers", label: "API" },
];

const EARN_LINKS = [
  { href: "/rewards", label: "Rewards" },
  { href: "/hackathons", label: "Hackathons" },
  { href: "/bounties", label: "Bounties" },
];

export interface BaseLayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
  /** Mobile nav render function - receives close handler */
  mobileNav?: (onClose: () => void) => ReactNode;
  /** Max width for header and content (e.g., "max-w-6xl"). When set, content is centered. */
  maxWidth?: string;
  /** Show the $JOBS rewards line in the footer (homepage only) */
  showJobsFooter?: boolean;
}

export default function BaseLayout({
  children,
  headerActions,
  mobileNav,
  maxWidth,
  showJobsFooter = false,
}: BaseLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const { openSearch } = useModals();

  // Global keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openSearch]);

  const closeMobileNav = () => setMobileNavOpen(false);
  const containerClass = clsx(maxWidth, maxWidth && "mx-auto w-full");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Rewards Banner - site-wide announcement */}
      <RewardsBanner />

      {/* Hackathon Banner - shows above nav on all pages */}
      <HackathonBanner />

      <header className="py-5">
        <div
          className={clsx(
            "flex items-center justify-between px-6 w-full",
            containerClass,
          )}
        >
          <div className="flex items-center gap-4">
            <Logo />
            {/* Mobile hackathon badge - shown inline on mobile */}
            <HackathonBadge />
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <Button
                    key={link.href}
                    as={Link}
                    href={link.href}
                    variant="ghost"
                    className={clsx(isActive && "bg-primary/10 text-primary")}
                  >
                    {link.label}
                  </Button>
                );
              })}
              {/* Earn Dropdown */}
              <Dropdown
                trigger={
                  <Button
                    variant="ghost"
                    className={clsx(
                      "gap-1",
                      EARN_LINKS.some((link) =>
                        pathname.startsWith(link.href),
                      ) && "bg-primary/10 text-primary",
                    )}
                  >
                    Earn
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                }
                placement="bottom-start"
              >
                {EARN_LINKS.map((link) => (
                  <DropdownItem
                    key={link.href}
                    onClick={() => {}}
                    active={pathname.startsWith(link.href)}
                  >
                    <Link href={link.href} className="block w-full">
                      {link.label}
                    </Link>
                  </DropdownItem>
                ))}
              </Dropdown>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {headerActions}
            {/* Hide these action buttons on smaller screens */}
            <div className="hidden lg:flex items-center gap-1">
              <QuickAddButton />
              <JobputerChatButton />
              <SearchButton />
              <ThemeToggle />
            </div>
            <NotificationBell />
            <UserMenu />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div
          className={clsx(
            "lg:hidden border-b border-border px-4 py-3",
            containerClass,
          )}
        >
          <nav className="flex flex-col gap-1 mb-3">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Button
                  key={link.href}
                  as={Link}
                  href={link.href}
                  variant="ghost"
                  size="sm"
                  onClick={closeMobileNav}
                  className={clsx(
                    "justify-start",
                    isActive && "bg-primary/10 text-primary",
                  )}
                >
                  {link.label}
                </Button>
              );
            })}
            {/* Earn section */}
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2 mb-1 px-3">
              Earn
            </div>
            {EARN_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Button
                  key={link.href}
                  as={Link}
                  href={link.href}
                  variant="ghost"
                  size="sm"
                  onClick={closeMobileNav}
                  className={clsx(
                    "justify-start",
                    isActive && "bg-primary/10 text-primary",
                  )}
                >
                  {link.label}
                </Button>
              );
            })}
          </nav>

          {/* Action buttons - shown in mobile menu */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <MyJobsButton />
            <QuickAddButton />
            <JobputerChatButton />
            <SearchButton />
            <ThemeToggle />
          </div>

          {mobileNav && (
            <>
              <div className="border-t border-border my-3" />
              {mobileNav(closeMobileNav)}
            </>
          )}
        </div>
      )}

      <div
        className={clsx(
          containerClass,
          maxWidth && "px-6",
          "flex-1 flex flex-col",
        )}
      >
        {children}
      </div>

      {/* Footer */}
      <footer
        className={clsx(showJobsFooter ? "py-24 md:py-32" : "py-12 md:py-16")}
      >
        <div className={clsx("px-6 w-full text-center", containerClass)}>
          {/* Top line - $JOBS info (homepage only) */}
          {showJobsFooter && (
            <p className="text-base md:text-lg text-muted-foreground mb-10">
              $JOBS holders earn 50% of platform fees, paid monthly in USDC.{" "}
              <Link
                href="/rewards"
                className="font-semibold text-emerald-600 hover:text-emerald-500 hover:underline transition-colors"
              >
                Claim rewards →
              </Link>
            </p>
          )}

          {/* Bottom line - Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-x-4 sm:gap-y-2 text-sm text-muted-foreground">
            <a
              href="https://memeputer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              a <span className="font-semibold text-foreground">MEMEPUTER</span>{" "}
              product
            </a>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <a
              href="https://openfacilitator.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans hover:text-foreground transition-colors"
            >
              Powered by{" "}
              <span className="font-semibold text-foreground">
                OpenFacilitator
              </span>
            </a>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <a
              href="https://coinmarketcap.com/currencies/x402jobs/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:opacity-70 transition-opacity"
              title="View on CoinMarketCap"
            >
              $JOBS
            </a>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <a href="/docs" className="hover:text-foreground transition-colors">
              Docs
            </a>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/rawgroundbeef/x402jobs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:opacity-70 transition-opacity"
                title="GitHub"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://x.com/x402jobs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:opacity-70 transition-opacity"
                title="X"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://discord.gg/BUcC28x6BX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:opacity-70 transition-opacity"
                title="Discord"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
              <a
                href="https://t.me/x402jobs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:opacity-70 transition-opacity"
                title="Telegram"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
