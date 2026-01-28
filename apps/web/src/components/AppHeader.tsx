"use client";

import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { ChevronLeft, LogIn } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

interface AppHeaderProps {
  backHref?: string;
  showLogo?: boolean;
  children?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function AppHeader({
  backHref,
  showLogo = true,
  children,
  rightContent,
}: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-card px-4 py-2">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link href={backHref}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {showLogo && <Logo />}
          {children}
        </div>
        <div className="flex items-center gap-2">
          {rightContent}
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">
              <LogIn className="h-4 w-4 mr-1" />
              Login
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
