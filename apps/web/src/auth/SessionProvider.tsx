import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type Credentials } from "../api/client";
import type { User } from "../api/types";

export type SessionState =
  | { readonly status: "loading" }
  | { readonly status: "anonymous" }
  | { readonly status: "signedIn"; readonly user: User };

interface SessionValue {
  readonly state: SessionState;
  readonly signIn: (credentials: Credentials) => Promise<void>;
  readonly signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((user) => active && setState({ status: "signedIn", user }))
      .catch(() => active && setState({ status: "anonymous" }));
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (credentials: Credentials) => {
    setState({ status: "signedIn", user: await api.login(credentials) });
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setState({ status: "anonymous" });
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error("useSession needs a SessionProvider");
  return value;
}
