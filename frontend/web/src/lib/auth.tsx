"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { endpoints, tokens } from "./api";
import type { AccessibleWedding, AuthSession, User } from "./types";

interface AuthState {
  /** False until the stored session has been checked in the browser. */
  ready: boolean;
  user: User | null;
  weddings: AccessibleWedding[];
  signIn: (session: AuthSession) => void;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [weddings, setWeddings] = useState<AccessibleWedding[]>([]);

  const reload = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      setWeddings([]);
      setReady(true);
      return;
    }
    try {
      const me = await endpoints.me();
      setUser(me.user);
      setWeddings(me.weddings);
    } catch {
      setUser(null);
      setWeddings([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void reload());
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("ptf.")) void reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reload]);

  const signIn = useCallback(
    (session: AuthSession) => {
      tokens.set(session.accessToken, session.refreshToken);
      setUser(session.user);
      setWeddings(session.weddings);
      setReady(true);
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const refresh = tokens.refresh;
    if (refresh) await endpoints.logout(refresh).catch(() => undefined);
    tokens.clear();
    setUser(null);
    setWeddings([]);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(() => ({ ready, user, weddings, signIn, signOut, reload }), [ready, user, weddings, signIn, signOut, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
