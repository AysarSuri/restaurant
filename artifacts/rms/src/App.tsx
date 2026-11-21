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
import Shifts from "@/pages/shifts";
import Suppliers from "@/pages/suppliers";
import Expenses from "@/pages/expenses";
import CashMovements from "@/pages/cash-movements";
import Branches from "@/pages/branches";
import Cards from "@/pages/cards";
import Settings from "@/pages/settings";
import SystemReset from "@/pages/system-reset";
import DeliveryContacts from "@/pages/delivery-contacts";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import Cashier from "@/pages/cashier";
import TableOrder from "@/pages/table-order";
import { BranchProvider } from "@/lib/branch-context";
import { applyBrandPrimary } from "@/lib/brand-theme";
import { LocaleProvider } from "@/i18n";
import { EnterAsTab } from "@/components/enter-as-tab";
import { useGetSettings } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

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

function BrandThemeSync() {
  const { data } = useGetSettings({
    query: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  useEffect(() => {
    if (data?.themePrimary) applyBrandPrimary(data.themePrimary);
  }, [data?.themePrimary]);

  return null;
}

// ─── Auth ─────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "cashier" | "kitchen" | "table";

export interface AuthUser {
  name: string;
  role: UserRole;
  employeeId?: number;
  tableId?: number;
  tableNumber?: string;
  /** employee belongs to every branch (admin/manager or flag) */
  allBranches?: boolean;
  /** assigned branch ids when not allBranches */
  branchIds?: number[];
  /** active working scope: one branch or all (admin/manager) */
  selectedBranchId?: number | "all";
  branchName?: string;
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
    localStorage.removeItem("rms-branch");
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
  "/shifts": ["admin", "manager"],
  "/suppliers": ["admin", "manager"],
  "/expenses": ["admin", "manager"],
  "/cash-movements": ["admin", "manager"],
  "/branches": ["admin", "manager"],
  "/cards": ["admin", "manager"],
  "/settings": ["admin", "manager"],
  "/system-reset": ["admin"],
  "/delivery-contacts": ["admin", "manager", "cashier"],
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
      <Route path="/shifts" component={Shifts} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/cash-movements" component={CashMovements} />
      <Route path="/branches" component={Branches} />
      <Route path="/cards" component={Cards} />
      <Route path="/settings" component={Settings} />
      <Route path="/system-reset" component={SystemReset} />
      <Route path="/delivery-contacts" component={DeliveryContacts} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );

  if (isStandalone) return routes;

  return <Layout>{routes}</Layout>;
}

function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <BranchProvider>
              <TooltipProvider>
                <EnterAsTab />
                <BrandThemeSync />
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </BranchProvider>
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}

export default App;
