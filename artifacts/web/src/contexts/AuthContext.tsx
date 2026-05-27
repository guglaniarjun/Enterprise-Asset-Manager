import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("springfield_token"));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem("springfield_user");
    return stored ? JSON.parse(stored) : null;
  });

  const { data: me, isLoading: meLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (me) {
      setUser(me);
      localStorage.setItem("springfield_user", JSON.stringify(me));
    }
    if (isError) {
      logout();
    }
  }, [me, isError]);

  const login = (newToken: string, newUser: UserProfile) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("springfield_token", newToken);
    localStorage.setItem("springfield_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("springfield_token");
    localStorage.removeItem("springfield_refresh_token");
    localStorage.removeItem("springfield_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading: meLoading && !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
