"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface SessionState {
  userId: string | null;
  username: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
}

interface AuthContextValue extends SessionState {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: SessionState = {
  userId: null,
  username: null,
  isLoaded: false,
  isSignedIn: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setState({
        userId: data.userId ?? null,
        username: data.username ?? null,
        isLoaded: true,
        isSignedIn: !!data.userId,
      });
    } catch {
      setState({ userId: null, username: null, isLoaded: true, isSignedIn: false });
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ userId: null, username: null, isLoaded: true, isSignedIn: false });
  }, []);

  useEffect(() => {
    // Intentional sync with an external system (the session cookie) on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthContext.Provider value={{ ...state, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used within an AuthProvider");
  return ctx;
}
