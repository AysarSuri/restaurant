import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  ChefHat,
  ClipboardList,
  Grid,
  MenuSquare,
  Package,
  Users,
  UsersRound,
  Receipt,
  LineChart,
  Table2,
  Wallet,
  LogOut,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { useAuth, type UserRole } from "@/App";
import { Dialog, Button } from "@/components/ui-elements";

type HomeItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
};

const HOME_ITEMS: HomeItem[] = [
  { href: "/pos", label: "نقطة البيع", icon: ShoppingCart, roles: ["admin", "manager", "cashier"] },
  { href: "/cashier", label: "شاشة الكاشير", icon: Wallet, roles: ["admin", "manager", "cashier"] },
  { href: "/orders", label: "الطلبات", icon: ClipboardList, roles: ["admin", "manager", "cashier"] },
  { href: "/tables", label: "الطاولات", icon: Grid, roles: ["admin", "manager"] },
  { href: "/table-order", label: "طلب الطاولة", icon: Table2, roles: ["admin", "manager", "table"] },
  { href: "/kds", label: "شاشة المطبخ", icon: ChefHat, roles: ["admin", "manager", "kitchen"] },
  { href: "/customers", label: "العملاء", icon: Users, roles: ["admin", "manager"] },
  { href: "/menu", label: "المنيو", icon: MenuSquare, roles: ["admin", "manager"] },
  { href: "/inventory", label: "المخزون", icon: Package, roles: ["admin", "manager"] },
  { href: "/employees", label: "الموظفين", icon: UsersRound, roles: ["admin", "manager"] },
  { href: "/expenses", label: "المصاريف", icon: Receipt, roles: ["admin", "manager"] },
  { href: "/branches", label: "الفروع", icon: Building2, roles: ["admin", "manager"] },
  { href: "/reports", label: "التقارير", icon: LineChart, roles: ["admin", "manager"] },
];

function canAccess(role: UserRole | undefined, item: HomeItem) {
  if (!item.roles || item.roles.length === 0) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const items = HOME_ITEMS.filter((item) => canAccess(user?.role, item));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="w-full">
      <Dialog isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} title="تسجيل الخروج">
        <div className="text-center py-2 space-y-5">
          <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto">
            <LogOut className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <p className="font-bold text-lg">هل تريد تسجيل الخروج؟</p>
            <p className="text-muted-foreground text-sm mt-1">سيتم إغلاق جلستك الحالية.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setLogoutOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" className="flex-1 gap-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4" /> تسجيل الخروج
            </Button>
          </div>
        </div>
      </Dialog>

      <div className="mb-4 sm:mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">الصفحة الرئيسية</h1>
          <p className="text-sm text-muted-foreground mt-1">اختر القسم للبدء</p>
        </div>
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors flex-shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={`${item.href}-${item.label}`}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.35) }}
              onClick={() => navigate(item.href)}
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
                  w-14 h-14 sm:w-16 sm:h-16 rounded-2xl
                  bg-primary text-primary-foreground
                  flex items-center justify-center shadow-md shadow-primary/25
                  transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3
                "
              >
                <Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.25} />
              </span>
              <span className="text-[13px] sm:text-[15px] font-extrabold text-center leading-snug line-clamp-2">
                {item.label}
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
              w-14 h-14 sm:w-16 sm:h-16 rounded-2xl
              bg-primary text-primary-foreground
              flex items-center justify-center shadow-md shadow-primary/25
              transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3
            "
          >
            <LogOut className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.25} />
          </span>
          <span className="text-[13px] sm:text-[15px] font-extrabold text-center leading-snug line-clamp-2">
            تسجيل الخروج
          </span>
        </motion.button>
      </div>
    </div>
  );
}
