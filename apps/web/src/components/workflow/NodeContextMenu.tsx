"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { Copy, Trash2, Settings2, ClipboardPaste } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId?: string;
  nodeType?: string;
  canPaste: boolean;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onConfigure?: () => void;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  nodeType,
  canPaste,
  onCopy,
  onPaste,
  onDelete,
  onConfigure,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Adjust position to keep menu in viewport
  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = x - rect.width;
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = y - rect.height;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    // Add listeners with a small delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const isNodeMenu = !!nodeId;
  const canCopy = isNodeMenu; // All node types can be copied
  const canDelete =
    isNodeMenu && nodeType !== "trigger" && nodeType !== "output";
  // All node types can be configured
  const canConfigure =
    isNodeMenu &&
    (nodeType === "resource" ||
      nodeType === "transform" ||
      nodeType === "trigger" ||
      nodeType === "output");

  // Check if we have any menu items to show
  const hasMenuItems = isNodeMenu
    ? canConfigure || canCopy || canPaste || canDelete
    : canPaste;

  // Don't show menu if nothing to show
  if (!hasMenuItems) {
    onClose();
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed z-50 min-w-[180px] bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-xl py-1"
        style={{ left: position.x, top: position.y }}
      >
        {isNodeMenu ? (
          <>
            {canConfigure && (
              <button
                onClick={() => {
                  onConfigure?.();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-foreground hover:bg-accent transition-colors"
              >
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                Configure
              </button>
            )}
            {canCopy && (
              <button
                onClick={() => {
                  onCopy?.();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-foreground hover:bg-accent transition-colors"
              >
                <Copy className="w-4 h-4 text-muted-foreground" />
                Copy
                <span className="ml-auto text-xs text-muted-foreground">
                  ⌘C
                </span>
              </button>
            )}
            {canPaste && (
              <button
                onClick={() => {
                  onPaste?.();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-foreground hover:bg-accent transition-colors"
              >
                <ClipboardPaste className="w-4 h-4 text-muted-foreground" />
                Paste
                <span className="ml-auto text-xs text-muted-foreground">
                  ⌘V
                </span>
              </button>
            )}
            {(canConfigure || canCopy || canPaste) && canDelete && (
              <div className="my-1 border-t border-border" />
            )}
            {canDelete && (
              <button
                onClick={() => {
                  onDelete?.();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
                <span className="ml-auto text-xs text-muted-foreground/70">
                  ⌫
                </span>
              </button>
            )}
          </>
        ) : (
          // Pane context menu (right-click on canvas)
          canPaste && (
            <button
              onClick={() => {
                onPaste?.();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-foreground hover:bg-accent transition-colors"
            >
              <ClipboardPaste className="w-4 h-4 text-muted-foreground" />
              Paste
              <span className="ml-auto text-xs text-muted-foreground">⌘V</span>
            </button>
          )
        )}
      </motion.div>
    </AnimatePresence>
  );
}
