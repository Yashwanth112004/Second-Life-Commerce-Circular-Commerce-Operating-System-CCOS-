import { createContext, useContext, useEffect, useState } from "react";
import { api, tokens } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tokens.access) {
      api
        .me()
        .then(setUser)
        .catch(() => tokens.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    tokens.set(res);
    const me = await api.me();
    setUser(me);
    return me;
  };

  const register = async (body) => {
    const res = await api.register(body);
    tokens.set(res);
    const me = await api.me();
    setUser(me);
    return me;
  };

  const logout = async () => {
    await api.logout();
    tokens.clear();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
