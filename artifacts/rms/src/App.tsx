import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { createContext, useContext, useEffect, useState } from "react";

import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import POS from "@/pages/pos";
import KDS from "@/pages/kds";
import Menu from "@/pages/menu";
import Tables from "@/pages/tables";
import Orders from "@/pages/orders";
import Inventory from "@/pages/inventory";
import Customers from "@/pages/customers";
import Employees from "@/pages/employees";
import Expenses from "@/pages/expenses";
import Branches from "@/pages/branches";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import Cashier from "@/pages/cashier";
import TableOrder from "@/pages/table-order";

const queryClient = new QueryClient();

// ─── Theme ───────────────────────────────────────────────
type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("rms-theme") as Theme) ?? "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    localStorage.setItem("rms-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Auth ─────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "cashier" | "kitchen" | "table";

export interface AuthUser {
  name: string;
  role: UserRole;
  tableId?: number;
  tableNumber?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("rms-user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (u: AuthUser) => {
    setUser(u);
    localStorage.setItem("rms-user", JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("rms-user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Role-based redirect after login ──────────────────────
const ROLE_DEFAULT_PATH: Record<UserRole, string> = {
  admin: "/",
  manager: "/",
  cashier: "/",
  kitchen: "/",
  table: "/",
};

// Pages that bypass Layout (standalone fullscreen)
const STANDALONE_PATHS = ["/login", "/table-order", "/cashier", "/kds", "/pos"];

// Pages only accessible by certain roles
const ROLE_ALLOWED: Record<string, UserRole[]> = {
  "/": ["admin", "manager", "cashier", "kitchen", "table"],
  "/pos": ["admin", "manager", "cashier"],
  "/kds": ["admin", "manager", "kitchen"],
  "/cashier": ["admin", "manager", "cashier"],
  "/table-order": ["admin", "manager", "table"],
  "/menu": ["admin", "manager"],
  "/tables": ["admin", "manager"],
  "/orders": ["admin", "manager", "cashier"],
  "/inventory": ["admin", "manager"],
  "/customers": ["admin", "manager"],
  "/employees": ["admin", "manager"],
  "/expenses": ["admin", "manager"],
  "/branches": ["admin", "manager"],
  "/reports": ["admin", "manager"],
};

function Router() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  // If not logged in and not on login page → redirect to login
  useEffect(() => {
    if (!user && location !== "/login") {
      navigate("/login");
    }
  }, [user, location]);

  // If logged in and on login page → redirect to role default
  useEffect(() => {
    if (user && location === "/login") {
      navigate(ROLE_DEFAULT_PATH[user.role] ?? "/");
    }
  }, [user, location]);

  // If logged in but on a page not allowed for role → redirect
  useEffect(() => {
    if (user && location !== "/login") {
      const allowed = ROLE_ALLOWED[location];
      if (allowed && !allowed.includes(user.role)) {
        navigate(ROLE_DEFAULT_PATH[user.role] ?? "/");
      }
    }
  }, [user, location]);

  if (!user && location !== "/login") return null;

  const isStandalone = STANDALONE_PATHS.includes(location);

  const routes = (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/cashier" component={Cashier} />
      <Route path="/table-order" component={TableOrder} />
      <Route path="/kds" component={KDS} />
      <Route path="/pos" component={POS} />
      <Route path="/" component={Dashboard} />
      <Route path="/menu" component={Menu} />
      <Route path="/tables" component={Tables} />
      <Route path="/orders" component={Orders} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/customers" component={Customers} />
      <Route path="/employees" component={Employees} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/branches" component={Branches} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );

  if (isStandalone) return routes;

  return <Layout>{routes}</Layout>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
