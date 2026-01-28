"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Dropdown, DropdownItem, DropdownDivider } from "@x402jobs/ui/dropdown";
import { authenticatedFetcher, authenticatedFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket, NotificationEvent } from "@/hooks/useWebSocket";
import clsx from "clsx";

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

interface NotificationsCountResponse {
  count: number;
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Module-level set to track processed notifications across component remounts
// This prevents infinite loops when job refresh causes component remount
const processedNotificationIds = new Set<string>();

export function NotificationBell() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const { mutate: globalMutate } = useSWRConfig();

  // WebSocket for real-time notifications
  const { isAvailable: wsAvailable, subscribe } = useWebSocket();

  // Fetch unread count (for badge) - less frequent polling when WS is available
  const { data: countData, mutate: mutateCount } =
    useSWR<NotificationsCountResponse>(
      user ? "/notifications/unread-count" : null,
      authenticatedFetcher,
      { refreshInterval: wsAvailable ? 60000 : 30000 },
    );

  // Fetch recent notifications (for dropdown) - less frequent polling when WS is available
  const { data: notificationsData, mutate: mutateNotifications } =
    useSWR<NotificationsResponse>(
      user ? "/notifications?limit=5" : null,
      authenticatedFetcher,
      { refreshInterval: wsAvailable ? 60000 : 30000 },
    );

  const unreadCount = countData?.count || 0;
  const notifications = useMemo(
    () => notificationsData?.notifications || [],
    [notificationsData?.notifications],
  );

  // Handle new notification from WebSocket
  const handleWsNotification = useCallback(
    (event: NotificationEvent) => {
      console.log(
        "[NotificationBell] Received notification via WebSocket:",
        event.notification,
      );

      // Refresh notifications list and count
      mutateNotifications();
      mutateCount();

      // If it's a schedule paused notification, refresh job data
      if (event.notification.type === "schedule_paused_low_balance") {
        console.log(
          "[NotificationBell] Schedule paused notification via WS, refreshing job data",
        );
        globalMutate(
          (key) => typeof key === "string" && key.startsWith("/jobs"),
          undefined,
          { revalidate: true },
        );
      }
    },
    [mutateNotifications, mutateCount, globalMutate],
  );

  // Subscribe to WebSocket notification events
  useEffect(() => {
    if (!wsAvailable || !user) return;

    const unsubscribe = subscribe<NotificationEvent>(
      "notification",
      handleWsNotification,
    );
    return unsubscribe;
  }, [wsAvailable, user, subscribe, handleWsNotification]);

  // Fallback: When we see a new schedule_paused_low_balance notification via polling, refresh job data
  useEffect(() => {
    if (!notifications.length) return;

    for (const notification of notifications) {
      // Skip if we've already processed this notification (uses module-level set to survive remounts)
      if (processedNotificationIds.has(notification.id)) continue;
      processedNotificationIds.add(notification.id);

      // If it's a schedule paused notification, invalidate job caches
      if (
        notification.type === "schedule_paused_low_balance" &&
        !notification.read
      ) {
        console.log(
          "[NotificationBell] Schedule paused notification detected (polling), refreshing job data",
        );
        // Invalidate all job-related caches to refresh the UI
        globalMutate(
          (key) => typeof key === "string" && key.startsWith("/jobs"),
          undefined,
          { revalidate: true },
        );
      }
    }
  }, [notifications, globalMutate]);

  // Mark single notification as read
  const handleMarkRead = async (
    e: React.MouseEvent,
    notificationId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMarkingRead(notificationId);
    try {
      await authenticatedFetch(`/notifications/${notificationId}/read`, {
        method: "POST",
      });
      mutateNotifications();
      mutateCount();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    } finally {
      setMarkingRead(null);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await authenticatedFetch("/notifications/read-all", { method: "POST" });
      mutateNotifications();
      mutateCount();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      authenticatedFetch(`/notifications/${notification.id}/read`, {
        method: "POST",
      }).then(() => {
        mutateNotifications();
        mutateCount();
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Don't show if not logged in or still loading
  if (authLoading || !user) {
    return null;
  }

  return (
    <Dropdown
      placement="bottom-end"
      className="w-80"
      trigger={
        <button
          className="relative p-1.5 rounded hover:bg-accent transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={clsx(
                "absolute -top-0.5 -right-0.5 flex items-center justify-center",
                "min-w-[16px] h-[16px] px-1 text-[10px] font-bold",
                "bg-red-500 text-white rounded-full",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-semibold text-sm">Notifications</span>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <DropdownDivider />

      {/* Notifications list */}
      <div className="max-h-[320px] overflow-y-auto py-1">
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownItem
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={clsx(
                "!py-2.5 !px-3",
                !notification.read && "bg-accent/30",
              )}
            >
              <div className="flex items-start gap-2.5 w-full">
                {/* Unread indicator */}
                <div
                  className={clsx(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    notification.read ? "bg-transparent" : "bg-blue-500",
                  )}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={clsx(
                      "text-sm font-medium truncate",
                      notification.read && "text-muted-foreground",
                    )}
                  >
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>

                {/* Mark as read button - using div to avoid nested button issue */}
                {!notification.read && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleMarkRead(e, notification.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleMarkRead(
                          e as unknown as React.MouseEvent,
                          notification.id,
                        );
                      }
                    }}
                    className={clsx(
                      "p-1 hover:bg-accent rounded transition-colors flex-shrink-0 cursor-pointer",
                      markingRead === notification.id && "pointer-events-none",
                    )}
                    title="Mark as read"
                  >
                    <Check
                      className={clsx(
                        "h-3.5 w-3.5 text-muted-foreground",
                        markingRead === notification.id && "animate-pulse",
                      )}
                    />
                  </div>
                )}
              </div>
            </DropdownItem>
          ))
        )}
      </div>

      <DropdownDivider />

      {/* Footer */}
      <DropdownItem as={Link} href="/dashboard/notifications" variant="muted">
        <span className="flex-1">View all notifications</span>
        <ExternalLink className="h-3.5 w-3.5 ml-2" />
      </DropdownItem>
    </Dropdown>
  );
}
