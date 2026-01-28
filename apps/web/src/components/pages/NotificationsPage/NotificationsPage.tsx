"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Spinner } from "@x402jobs/ui/spinner";
import { Card } from "@x402jobs/ui/card";
import { authenticatedFetcher, authenticatedFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Check,
  Inbox,
} from "lucide-react";
import clsx from "clsx";

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

const notificationIcons: Record<string, React.ReactNode> = {
  submission_received: <Inbox className="w-5 h-5 text-blue-500" />,
  submission_approved: <CheckCircle className="w-5 h-5 text-green-500" />,
  submission_rejected: <XCircle className="w-5 h-5 text-red-500" />,
  changes_requested: <AlertCircle className="w-5 h-5 text-amber-500" />,
  job_transferred: <ArrowRight className="w-5 h-5 text-purple-500" />,
};

export default function NotificationsPage() {
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const { data, isLoading, mutate } = useSWR<NotificationsResponse>(
    "/notifications",
    authenticatedFetcher,
  );

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await authenticatedFetch(`/notifications/${notificationId}/read`, {
        method: "POST",
      });
      mutate();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      await authenticatedFetch("/notifications/read-all", {
        method: "POST",
      });
      mutate();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Mark all read
              </>
            )}
          </Button>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">
            No notifications yet. When someone submits to your job request or
            reviews your submission, you&apos;ll see it here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const icon = notificationIcons[notification.type] || (
    <Bell className="w-5 h-5 text-gray-500" />
  );

  const content = (
    <Card
      className={clsx(
        "p-4 transition-colors",
        notification.read
          ? "bg-card opacity-60"
          : "bg-card border-l-4 border-l-blue-500",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <p
            className={clsx(
              "font-medium",
              notification.read ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {notification.title}
          </p>
          {notification.message && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {formatRelativeTime(notification.created_at)}
          </p>
        </div>
        {!notification.read && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            className="flex-shrink-0"
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );

  if (notification.link) {
    return (
      <Link
        href={notification.link}
        onClick={() => {
          if (!notification.read) {
            onMarkAsRead(notification.id);
          }
        }}
        className="block hover:opacity-90 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
