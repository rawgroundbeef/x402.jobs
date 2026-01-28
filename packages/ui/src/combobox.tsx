"use client";

import * as React from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { Input } from "./input";
import { cn } from "./lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  group?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  renderOption?: (option: ComboboxOption) => React.ReactNode;
  renderTrigger?: (
    selectedOption?: ComboboxOption,
    isOpen?: boolean,
  ) => React.ReactNode;
  renderFilters?: () => React.ReactNode;
}

/**
 * Combobox component that matches Input styling
 * Supports search, grouping, and custom rendering
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  disabled = false,
  className,
  searchable = false,
  searchPlaceholder = "Search...",
  renderOption,
  renderTrigger,
  renderFilters,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query) ||
        opt.description?.toLowerCase().includes(query),
    );
  }, [options, searchQuery, searchable]);

  // Group options
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, ComboboxOption[]> = {};
    filteredOptions.forEach((opt) => {
      const group = opt.group || "Other";
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(opt);
    });
    return groups;
  }, [filteredOptions]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
    ],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  const defaultTrigger = (
    <button
      type="button"
      ref={refs.setReference}
      {...getReferenceProps()}
      disabled={disabled}
      className={cn(
        "flex min-h-[36px] w-full items-center justify-between rounded-md border border-input bg-background dark:bg-black dark:border-zinc-800 px-3 py-2 text-sm ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        className={cn(!selectedOption && !value && "text-muted-foreground")}
      >
        {selectedOption ? selectedOption.label : value || placeholder}
      </span>
      <svg
        className="ml-2 h-4 w-4 shrink-0 opacity-50"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );

  return (
    <>
      {renderTrigger ? (
        <div ref={refs.setReference} {...getReferenceProps()}>
          {renderTrigger(selectedOption, isOpen)}
        </div>
      ) : (
        defaultTrigger
      )}

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 max-h-[400px] overflow-hidden flex flex-col bg-background dark:bg-black border border-input dark:border-zinc-800 rounded-md shadow-lg"
          >
            {/* Filters */}
            {renderFilters && (
              <div className="p-2 border-b border-input dark:border-zinc-800">
                {renderFilters()}
              </div>
            )}

            {/* Search Input */}
            {searchable && (
              <div className="p-2 border-b border-input dark:border-zinc-800">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsOpen(false);
                      setSearchQuery("");
                    }
                  }}
                />
              </div>
            )}

            {/* Options List */}
            <div className="overflow-y-auto max-h-[350px]">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No options found" : "No options available"}
                </div>
              ) : (
                Object.entries(groupedOptions).map(([group, groupOptions]) => (
                  <div key={group}>
                    {group !== "Other" &&
                      Object.keys(groupedOptions).length > 1 && (
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background dark:bg-black border-b border-input dark:border-zinc-800">
                          {group}
                        </div>
                      )}
                    {groupOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          !option.disabled && handleSelect(option.value)
                        }
                        disabled={option.disabled}
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm transition-colors",
                          option.value === value
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground",
                          option.disabled && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {renderOption ? (
                          renderOption(option)
                        ) : (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{option.label}</span>
                            {option.description && (
                              <span className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {option.description}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {filteredOptions.length > 0 && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t border-input dark:border-zinc-800 bg-muted dark:bg-zinc-900">
                {filteredOptions.length} option
                {filteredOptions.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
