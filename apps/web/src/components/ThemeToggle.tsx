"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { Dropdown, DropdownItem } from "@x402jobs/ui/dropdown";
import { useTheme } from "./ThemeProvider";

const themes = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render Sun on server/before mount to avoid hydration mismatch
  const CurrentIcon = mounted && resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Dropdown
      placement="bottom-end"
      className="w-36"
      trigger={
        <button className="p-2 rounded-lg hover:bg-accent transition-colors">
          <CurrentIcon className="h-5 w-5" />
          <span className="sr-only">Toggle theme</span>
        </button>
      }
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <DropdownItem
          key={value}
          onClick={() => setTheme(value)}
          active={theme === value}
        >
          <Icon className="h-4 w-4 mr-2" />
          <span className="flex-1">{label}</span>
          {theme === value && <Check className="h-4 w-4 text-primary ml-2" />}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
