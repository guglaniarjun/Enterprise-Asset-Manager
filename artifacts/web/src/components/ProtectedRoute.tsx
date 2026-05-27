import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({
  children,
  allowedRoles = [],
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
      return;
    }

    if (
      !isLoading &&
      user &&
      user.forcePasswordChange &&
      window.location.pathname !== "/change-password"
    ) {
      setLocation("/change-password");
      return;
    }

    if (!isLoading && user && allowedRoles.length > 0) {
      const hasRole = user.roles.some((r) => allowedRoles.includes(r.roleName));
      if (!hasRole) {
        // Redirect to a default dashboard if not allowed
        setLocation("/");
      }
    }
  }, [user, token, isLoading, setLocation, allowedRoles]);

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
