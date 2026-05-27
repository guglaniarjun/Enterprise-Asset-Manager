import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
  type NotificationItem,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck } from "lucide-react";
import { format } from "date-fns";

function relatedHref(n: NotificationItem): string | null {
  if (!n.relatedEntityType || !n.relatedEntityId) return null;
  if (n.relatedEntityType === "daily_log") return `/logs/${n.relatedEntityId}`;
  if (n.relatedEntityType === "syllabus") return `/syllabus`;
  if (n.relatedEntityType === "student_event") return `/events`;
  return null;
}

export default function NotificationsList() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { data, isLoading } = useListNotifications({}, {
    query: { queryKey: getListNotificationsQueryKey({}) },
  });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["listNotifications"] });
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) });
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey({ unreadOnly: true }) });
  };

  const handleClick = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate({ id: n.id }, { onSuccess: invalidate });
    const href = relatedHref(n);
    if (href) setLocation(href);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notifications
        </h1>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.unreadCount || markAll.isPending}
          onClick={() => markAll.mutate(undefined, { onSuccess: invalidate })}
        >
          <CheckCheck className="w-4 h-4 mr-2" /> Mark all as read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {data?.unreadCount ? `${data.unreadCount} unread` : "All caught up"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : !data?.data?.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            data.data.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={`w-full text-left p-3 rounded-md border transition-colors hover:bg-muted/50 ${
                  n.isRead ? "bg-background" : "bg-primary/5 border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{n.title}</span>
                      {!n.isRead && <Badge variant="secondary" className="text-[10px]">NEW</Badge>}
                      <Badge variant="outline" className="text-[10px] capitalize">{n.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(n.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
