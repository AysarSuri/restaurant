import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  ChefHat,
  ClipboardList,
  Grid,
  MenuSquare,
  Package,
  Bike,
  UsersRound,
  Receipt,
  LineChart,
  Table2,
  Wallet,
  LogOut,
  Building2,
  CreditCard,
  Settings,
  Phone,
  Clock3,
  Truck,
  ArrowLeftRight,
  Eraser,
  type LucideIcon,
} from "lucide-react";
import { getGetBranchesQueryOptions } from "@workspace/api-client-react";
import { useAuth, type UserRole } from "@/App";
import { Dialog, Button } from "@/components/ui-elements";
import { useI18n } from "@/i18n";

type HomeItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: UserRole[];
};

const HOME_ITEMS: HomeItem[] = [
  { href: "/pos", labelKey: "nav.pos", icon: ShoppingCart, roles: ["admin", "manager", "cashier"] },
  { href: "/cashier", labelKey: "nav.cashier", icon: Wallet, roles: ["admin", "manager", "cashier"] },
  { href: "/orders", labelKey: "nav.orders", icon: ClipboardList, roles: ["admin", "manager", "cashier"] },
  { href: "/tables", labelKey: "nav.tables", icon: Grid, roles: ["admin", "manager"] },
  { href: "/table-order", labelKey: "nav.tableOrder", icon: Table2, roles: ["admin", "manager", "table"] },
  { href: "/kds", labelKey: "nav.kds", icon: ChefHat, roles: ["admin", "manager", "kitchen"] },
  { href: "/drivers", labelKey: "nav.drivers", icon: Bike, roles: ["admin", "manager"] },
  { href: "/menu", labelKey: "nav.menu", icon: MenuSquare, roles: ["admin", "manager"] },
  { href: "/inventory", labelKey: "nav.inventory", icon: Package, roles: ["admin", "manager"] },
  { href: "/employees", labelKey: "nav.employees", icon: UsersRound, roles: ["admin", "manager"] },
  { href: "/shifts", labelKey: "nav.shifts", icon: Clock3, roles: ["admin", "manager"] },
  { href: "/suppliers", labelKey: "nav.suppliers", icon: Truck, roles: ["admin", "manager"] },
  { href: "/expenses", labelKey: "nav.expenses", icon: Receipt, roles: ["admin", "manager"] },
  { href: "/cash-movements", labelKey: "nav.cashMovements", icon: ArrowLeftRight, roles: ["admin", "manager"] },
  { href: "/branches", labelKey: "nav.branches", icon: Building2, roles: ["admin", "manager"] },
  { href: "/cards", labelKey: "nav.cards", icon: CreditCard, roles: ["admin", "manager"] },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, roles: ["admin", "manager"] },
  { href: "/system-reset", labelKey: "nav.systemReset", icon: Eraser, roles: ["admin"] },
  { href: "/delivery-contacts", labelKey: "nav.deliveryContacts", icon: Phone, roles: ["admin", "manager", "cashier"] },
  { href: "/reports", labelKey: "nav.reports", icon: LineChart, roles: ["admin", "manager"] },
];

function canAccess(role: UserRole | undefined, item: HomeItem) {
  if (!item.roles || item.roles.length === 0) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const items = HOME_ITEMS.filter((item) => canAccess(user?.role, item));

  useEffect(() => {
    if (
      canAccess(user?.role, {
        href: "/branches",
        labelKey: "nav.branches",
        icon: Building2,
        roles: ["admin", "manager"],
      })
    ) {
      void queryClient.prefetchQuery(getGetBranchesQueryOptions());
    }
  }, [queryClient, user?.role]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const goTo = (href: string) => {
    if (href === "/branches") {
      void queryClient.prefetchQuery(getGetBranchesQueryOptions());
    }
    navigate(href);
  };

  return (
    <div className="w-full">
      <Dialog isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} title={t("auth.logout")}>
        <div className="text-center py-2 space-y-5">
          <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto">
            <LogOut className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <p className="font-bold text-lg">{t("auth.logoutConfirm")}</p>
            <p className="text-muted-foreground text-sm mt-1">{t("auth.logoutHint")}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setLogoutOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" className="flex-1 gap-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4" /> {t("auth.logout")}
            </Button>
          </div>
        </div>
      </Dialog>

      <p className="mb-3 text-xs sm:text-sm font-semibold text-muted-foreground">
        {t("home.title")}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          return (
            <motion.button
              key={`${item.href}-${item.labelKey}`}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.35) }}
              onClick={() => goTo(item.href)}
              onPointerEnter={() => {
                if (item.href === "/branches") {
                  void queryClient.prefetchQuery(getGetBranchesQueryOptions());
                }
              }}
              className="
                group relative flex flex-col items-center justify-center gap-3
                min-h-[132px] sm:min-h-[150px] rounded-2xl border px-3 py-4
                bg-secondary/60 border-border/60 text-foreground
                transition-all duration-200 ease-out
                hover:-translate-y-1 hover:shadow-lg hover:border-primary/40 hover:bg-secondary
                active:scale-[0.97]
              "
            >
              <span
                className="
                  w-16 h-16 sm:w-[4.75rem] sm:h-[4.75rem] rounded-2xl
                  bg-primary text-primary-foreground
                  flex items-center justify-center shadow-md shadow-primary/25
                  transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3
                "
              >
                <Icon className="w-9 h-9 sm:w-10 sm:h-10" strokeWidth={2.25} />
              </span>
              <span className="text-[13px] sm:text-[15px] font-extrabold text-center leading-snug line-clamp-2">
                {label}
              </span>
            </motion.button>
          );
        })}

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(items.length * 0.03, 0.35) }}
          onClick={() => setLogoutOpen(true)}
          className="
            group relative flex flex-col items-center justify-center gap-3
            min-h-[132px] sm:min-h-[150px] rounded-2xl border px-3 py-4
            bg-secondary/60 border-border/60 text-foreground
            transition-all duration-200 ease-out
            hover:-translate-y-1 hover:shadow-lg hover:border-destructive/40 hover:bg-destructive/5
            active:scale-[0.97]
          "
        >
          <span
            className="
              w-16 h-16 sm:w-[4.75rem] sm:h-[4.75rem] rounded-2xl
              bg-rose-600 text-white
              flex items-center justify-center shadow-md shadow-rose-600/30
              transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3
            "
          >
            <LogOut className="w-9 h-9 sm:w-10 sm:h-10 text-white" strokeWidth={2.25} />
          </span>
          <span className="text-[13px] sm:text-[15px] font-extrabold text-center leading-snug line-clamp-2 text-rose-700 dark:text-rose-400">
            {t("auth.logout")}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
