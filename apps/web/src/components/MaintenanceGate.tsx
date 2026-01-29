"use client";

import { useEffect, useState } from "react";

// Set this to true to enable maintenance mode
const MAINTENANCE_MODE = false;

// localStorage key to bypass maintenance mode
const BYPASS_KEY = "x402_maintenance_bypass";

// Secret code to unlock (type this anywhere on the maintenance page)
const UNLOCK_CODE = "letmein";

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [isBlocked, setIsBlocked] = useState(true);
  const [keyBuffer, setKeyBuffer] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if maintenance mode is disabled
    if (!MAINTENANCE_MODE) {
      setIsBlocked(false);
      return;
    }

    // Check localStorage for bypass
    const bypass = localStorage.getItem(BYPASS_KEY);
    if (bypass === "true") {
      setIsBlocked(false);
      return;
    }

    // Check URL param for bypass (e.g., ?bypass=letmein)
    const params = new URLSearchParams(window.location.search);
    if (params.get("bypass") === UNLOCK_CODE) {
      localStorage.setItem(BYPASS_KEY, "true");
      setIsBlocked(false);
      // Remove the param from URL
      params.delete("bypass");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      return;
    }
  }, []);

  // Listen for unlock code typed on page
  useEffect(() => {
    if (!isBlocked) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      const newBuffer = (keyBuffer + e.key).slice(-UNLOCK_CODE.length);
      setKeyBuffer(newBuffer);

      if (newBuffer === UNLOCK_CODE) {
        localStorage.setItem(BYPASS_KEY, "true");
        setIsBlocked(false);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [isBlocked, keyBuffer]);

  // Don't render anything until mounted (avoid hydration mismatch)
  if (!mounted) {
    return null;
  }

  if (!isBlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">🚧</div>
        <h1 className="text-2xl font-bold text-white mb-4">
          Scheduled Maintenance
        </h1>
        <p className="text-gray-400 mb-6">
          We&apos;re performing a planned migration to improve x402.jobs.
          This should only take a few minutes.
        </p>
        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500">
            Follow{" "}
            <a
              href="https://x.com/x402jobs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              @x402jobs
            </a>
            {" "}for updates
          </p>
        </div>
        <div className="animate-pulse">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-sm">Migration in progress...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to clear bypass (call from console: clearMaintenanceBypass())
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).clearMaintenanceBypass = () => {
    localStorage.removeItem(BYPASS_KEY);
    window.location.reload();
  };
}
