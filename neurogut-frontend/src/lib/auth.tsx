"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if we have a token at all
    const token = typeof window !== "undefined" ? localStorage.getItem("neurogut_token") : null;

    if (!token) {
      // No token -- immediately set not-loading, no user
      setUser(null);
      setLoading(false);
      return;
    }

    // We have a token -- verify it's still valid
    api.getMe()
      .then((u) => {
        setUser(u);
        localStorage.setItem("neurogut_user", JSON.stringify(u));
      })
      .catch(() => {
        // Token invalid -- clear it
        setUser(null);
        api.clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const tok = await api.login(email, password);
    api.setToken(tok.access_token);
    const u = await api.getMe();
    setUser(u);
    localStorage.setItem("neurogut_user", JSON.stringify(u));
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
