import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  RMS_FORCE_LOGOUT_EVENT,
  setAuthTokenGetter,
  setDeviceKeyGetter,
} from "@workspace/api-client-react";
import { getOrCreateDeviceKey } from "@/lib/device-id";
import { toast } from "@/hooks/use-toast";

import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import POS from "@/pages/pos";
import KDS from "@/pages/kds";
import Menu from "@/pages/menu";
import Tables from "@/pages/tables";
import Orders from "@/pages/orders";
import Inventory from "@/pages/inventory";
import Drivers from "@/pages/drivers";
import Employees from "@/pages/employees";
import Shifts from "@/pages/shifts";
import Suppliers from "@/pages/suppliers";
import Expenses from "@/pages/expenses";
import CashMovements from "@/pages/cash-movements";
import Vault from "@/pages/vault";
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
import { writeLoginBrandCache } from "@/lib/branding-cache";
import { LocaleProvider } from "@/i18n";
import { EnterAsTab } from "@/components/enter-as-tab";
import { useDeviceFormsFullscreen } from "@/hooks/use-device-forms-fullscreen";
import { useDeviceClickSound } from "@/hooks/use-device-click-sound";
import { VirtualNumericKeypadHost } from "@/components/virtual-numeric-keypad-host";
import { VirtualKeyboardHost } from "@/components/virtual-keyboard-host";
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

  useLayoutEffect(() => {
    if (data?.themePrimary) applyBrandPrimary(data.themePrimary);
  }, [data?.themePrimary]);

  useLayoutEffect(() => {
    if (!data) return;
    writeLoginBrandCache({
      restaurantName: data.restaurantName,
      logoUrl: data.logoUrl,
    });
  }, [data?.restaurantName, data?.logoUrl]);

  return null;
}

function FormsFullscreenSync() {
  const { user } = useAuth();
  useDeviceFormsFullscreen(Boolean(user));
  return null;
}

function ClickSoundSync() {
  const { user } = useAuth();
  useDeviceClickSound(Boolean(user));
  return null;
}

function VirtualNumericKeypadSync() {
  const { user } = useAuth();
  return <VirtualNumericKeypadHost active={Boolean(user)} />;
}

function VirtualKeyboardSync() {
  const { user } = useAuth();
  return <VirtualKeyboardHost active={Boolean(user)} />;
}

// ─── Auth ─────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "cashier" | "kitchen" | "table";

export type AuthMenuPermissions = {
  access: boolean;
  create: boolean;
  editNew: boolean;
  editOld: boolean;
  deleteNew: boolean;
  deleteOld: boolean;
};

export type AuthListPerm = {
  access: boolean;
  create: boolean;
  edit: "none" | "1d" | "2d" | "all";
  delete: "none" | "1d" | "2d" | "all";
};

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
  /** @deprecated prefer listPermissions.menu */
  menuPermissions?: AuthMenuPermissions;
  /** Per-list permissions for non-admin roles */
  listPermissions?: Partial<Record<string, AuthListPerm>>;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser, token?: string) => void;
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

const AUTH_TOKEN_KEY = "rms-token";

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("rms-user");
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!stored || !token) {
        localStorage.removeItem("rms-user");
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return null;
      }
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });
  const forceLogoutBusy = useRef(false);

  useEffect(() => {
    setAuthTokenGetter(() => getStoredAuthToken());
    setDeviceKeyGetter(() => getOrCreateDeviceKey());
    return () => {
      setAuthTokenGetter(null);
      setDeviceKeyGetter(null);
    };
  }, []);

  const login = (u: AuthUser, token?: string) => {
    setUser(u);
    localStorage.setItem("rms-user", JSON.stringify(u));
    if (token) setStoredAuthToken(token);
  };

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("rms-user");
    localStorage.removeItem("rms-branch");
    setStoredAuthToken(null);
    try {
      queryClient.clear();
    } catch {
      /* ignore */
    }
  }, []);

  const applyForceLogout = useCallback(
    (message?: string) => {
      if (forceLogoutBusy.current) return;
      forceLogoutBusy.current = true;
      logout();
      toast({
        title: message || "تم فتح وردية جديدة على جهاز آخر — أعد تسجيل الدخول",
        variant: "destructive",
      });
      window.setTimeout(() => {
        forceLogoutBusy.current = false;
      }, 1500);
    },
    [logout]
  );

  useEffect(() => {
    const onForce = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message?: string }>).detail;
      applyForceLogout(detail?.message);
    };
    window.addEventListener(RMS_FORCE_LOGOUT_EVENT, onForce);
    return () => window.removeEventListener(RMS_FORCE_LOGOUT_EVENT, onForce);
  }, [applyForceLogout]);

  // Poll so idle screens also leave when another device opens a shift
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const check = async () => {
      const token = getStoredAuthToken();
      if (!token || cancelled) return;
      try {
        const deviceKey = getOrCreateDeviceKey();
        const res = await fetch("/api/auth/session-check", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Device-Key": deviceKey,
            Accept: "application/json",
          },
        });
        if (cancelled) return;
        if (res.status === 401) {
          applyForceLogout("جلسة غير صالحة — أعد تسجيل الدخول");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          forceLogout?: boolean;
          message?: string | null;
        };
        if (data?.forceLogout) {
          applyForceLogout(
            data.message ||
              "تم فتح وردية جديدة على جهاز آخر — أعد تسجيل الدخول"
          );
        }
      } catch {
        /* offline / transient — retry next tick */
      }
    };

    void check();
    const id = window.setInterval(check, 4000);
    const onFocus = () => {
      void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user, applyForceLogout]);

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
  "/drivers": ["admin", "manager"],
  "/customers": ["admin", "manager"],
  "/employees": ["admin", "manager"],
  "/shifts": ["admin", "manager"],
  "/suppliers": ["admin", "manager"],
  "/expenses": ["admin", "manager"],
  "/cash-movements": ["admin", "manager"],
  "/vault": ["admin", "manager", "cashier"],
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
      if (user.role === "admin" || user.role === "manager") {
        const allowed = ROLE_ALLOWED[location];
        if (allowed && !allowed.includes(user.role)) {
          navigate(ROLE_DEFAULT_PATH[user.role] ?? "/");
        }
        return;
      }
      // Non-admin: allow route if role allows OR list permission grants access
      const pathKey = location.replace(/^\//, "") || "";
      const listKey =
        pathKey === "delivery-contacts"
          ? "delivery-contacts"
          : pathKey === "cash-movements"
            ? "cash-movements"
            : pathKey;
      const listOk = Boolean(
        user.listPermissions?.[listKey]?.access ||
          (listKey === "menu" && user.menuPermissions?.access)
      );
      const allowed = ROLE_ALLOWED[location];
      const roleOk = allowed ? allowed.includes(user.role) : true;
      if (!roleOk && !listOk) {
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
      <Route path="/drivers" component={Drivers} />
      <Route path="/customers" component={Drivers} />
      <Route path="/employees" component={Employees} />
      <Route path="/shifts" component={Shifts} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/cash-movements" component={CashMovements} />
      <Route path="/vault" component={Vault} />
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
                <FormsFullscreenSync />
                <ClickSoundSync />
                <VirtualNumericKeypadSync />
                <VirtualKeyboardSync />
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
