import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "../types";
import { checkSession, logout as authLogout } from "../domain/auth";

interface SessionContextValue {
  session: Session | null;
  setSession: (session: Session | null) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSessionState(checkSession());
    setChecked(true);
  }, []);

  const setSession = useCallback((s: Session | null) => setSessionState(s), []);
  const logout = useCallback(() => {
    authLogout();
    setSessionState(null);
  }, []);

  if (!checked) return null;

  return <SessionContext.Provider value={{ session, setSession, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
