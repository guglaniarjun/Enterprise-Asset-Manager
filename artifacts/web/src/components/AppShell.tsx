import React from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import {
  useListNotifications,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
  type NotificationItem,
} from "@workspace/api-client-react";
import { Bell, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const navItems = [
    { label: "Dashboard", href: `/dashboard/${user?.roles[0]?.roleName?.toLowerCase().replace(" ", "-") || "director"}`, roles: ["Director", "Super Admin", "Principal", "Coordinator", "Teacher"] },
    { label: "Logs", href: "/logs", roles: ["Director", "Principal", "Coordinator", "Super Admin"] },
    { label: "Missing Logs", href: "/logs/missing", roles: ["Director", "Principal", "Coordinator", "Super Admin"] },
    { label: "Compliance", href: "/logs/compliance", roles: ["Director", "Principal", "Super Admin"] },
    { label: "Syllabus", href: "/syllabus", roles: ["Teacher", "Coordinator"] },
    { label: "Syllabus Summary", href: "/syllabus/summary", roles: ["Director", "Principal", "Super Admin"] },
    { label: "Students", href: "/students", roles: ["Director", "Principal", "Coordinator", "Teacher", "Super Admin"] },
    { label: "Events", href: "/events", roles: ["Director", "Principal", "Coordinator", "Super Admin"] },
    { label: "Tasks", href: "/tasks", roles: ["Director", "Principal", "Coordinator", "Teacher", "Super Admin"] },
    { label: "Alerts", href: "/alerts", roles: ["Director", "Principal", "Coordinator", "Super Admin"] },
    { label: "Follow-ups", href: "/follow-ups", roles: ["Director", "Principal", "Coordinator", "Teacher", "Super Admin"] },
    { label: "Accountability", href: "/accountability", roles: ["Director", "Principal", "Super Admin"] },
    { label: "Users", href: "/admin/users", roles: ["Super Admin", "Tenant Admin"] },
  ];

  const allowedNavItems = navItems.filter(item => 
    user?.roles.some(r => item.roles.includes(r.roleName))
  );

  const qc = useQueryClient();
  const { data: notificationsData } = useListNotifications({ unreadOnly: true }, {
    query: {
      enabled: !!user,
      queryKey: getListNotificationsQueryKey({ unreadOnly: true }),
    }
  });
  const markRead = useMarkNotificationRead();

  const handleNotifClick = (n: NotificationItem) => {
    if (!n.isRead) {
      markRead.mutate({ id: n.id }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListNotificationsQueryKey({ unreadOnly: true }) });
          qc.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) });
        },
      });
    }
    if (n.relatedEntityType === "daily_log" && n.relatedEntityId) {
      setLocation(`/logs/${n.relatedEntityId}`);
    } else if (n.relatedEntityType === "syllabus") {
      setLocation("/syllabus");
    } else {
      setLocation("/notifications");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r transition-transform transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <span className="text-xl font-bold text-primary">Springfield</span>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {allowedNavItems.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
              <span className={`block px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location.startsWith(item.href) ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between h-16 px-4 bg-white border-b dark:bg-gray-800">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white hidden sm:block">Command Center</h1>
          </div>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  {notificationsData?.unreadCount ? (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5">
                      {notificationsData.unreadCount}
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notificationsData?.data?.length ? (
                  notificationsData.data.slice(0, 5).map(n => (
                    <DropdownMenuItem key={n.id} className="flex flex-col items-start p-3 cursor-pointer" onClick={() => handleNotifClick(n)}>
                      <span className="font-medium text-sm">{n.title}</span>
                      <span className="text-xs text-gray-500">{n.body}</span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center text-primary cursor-pointer" onClick={() => setLocation("/notifications")}>
                  View all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 px-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                    {user?.name?.charAt(0) || "U"}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main viewport */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
