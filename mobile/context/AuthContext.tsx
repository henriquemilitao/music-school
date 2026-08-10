import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { storage } from "../lib/storage";
import { api } from "../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      const savedToken = await storage.getItem("token");
      const savedUser = await storage.getItem("user");

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
      }
      setIsLoading(false);
    }
    loadStoredAuth();
  }, []);

  async function signIn(email: string, password: string) {
    const response = await api.post("/auth/login", { email, password });
    const { access_token, user: loggedUser } = response.data;

    await storage.setItem("token", access_token);
    await storage.setItem("user", JSON.stringify(loggedUser));

    api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(loggedUser);
  }

  async function signOut() {
    await storage.deleteItem("token");
    await storage.deleteItem("user");
    delete api.defaults.headers.common.Authorization;
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa ser usado dentro de um AuthProvider");
  }
  return context;
}
