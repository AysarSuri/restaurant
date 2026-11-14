import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ChefHat,
  LogOut,
  Bell,
  Sun,
  Moon,
  Home,
  ArrowRight,
} from "lucide-react";
import { Dialog, Button } from "./ui-elements";
import { BranchSwitcher } from "./branch-switcher";
import { useTheme, useAuth } from "@/App";
import { useBranch } from "@/lib/branch-context";
import { useGetSettings } from "@workspace/api-client-react";

const PAGE_TITLES: Record<string, string> = {
  "/": "الصفحة الرئيسية",
  "/pos": "نقطة البيع",
  "/kds": "شاشة المطبخ",
  "/orders": "الطلبات",
  "/tables": "الطاولات",
  "/menu": "المنيو",
  "/inventory": "المخزون",
  "/customers": "العملاء",
  "/employees": "الموظفين",
  "/expenses": "المصاريف",
  "/branches": "الفروع",
  "/cards": "البطاقات",
  "/settings": "الإعدادات",
  "/reports": "التقارير",
  "/cashier": "شاشة الكاشير",
  "/table-order": "طلب الطاولة",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  manager: "مدير",
  cashier: "كاشير",
  kitchen: "مطبخ",
  table: "نادل",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { branchLabel } = useBranch();
  const { data: appSettings } = useGetSettings({
    query: { staleTime: 60_000, refetchOnWindowFocus: false },
  });
  const restaurantName = appSettings?.restaurantName?.trim() || "المطعم الذكي";
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isFullscreen = location === "/pos" || location === "/kds";
  const isHome = location === "/";
  const pageTitle = PAGE_TITLES[location] || "النظام";

  if (isFullscreen) {
    return <div className="min-h-app bg-background page-shell">{children}</div>;
  }

  return (
    <div className="flex min-h-app bg-background overflow-hidden page-shell">
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
            <Button variant="outline" className="flex-1" onClick={() => setLogoutOpen(false)}>إلغاء</Button>
            <Button variant="destructive" className="flex-1 gap-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4" /> تسجيل الخروج
            </Button>
          </div>
        </div>
      </Dialog>

      <main className="flex-1 flex flex-col h-app overflow-hidden relative min-w-0">
        <header className="h-14 md:h-16 xl:h-18 glass-panel border-b-0 border-x-0 rounded-none px-3 sm:px-4 md:px-6 xl:px-8 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!isHome ? (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 h-10 px-3 sm:px-4 rounded-full border-2 border-primary/40 bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors flex-shrink-0"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">الصفحة الرئيسية</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center gap-2 sm:gap-3 min-w-0"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
                  <ChefHat className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                </div>
                <div className="min-w-0 text-right">
                  <h1 className="text-base sm:text-lg font-bold text-foreground leading-none truncate">{restaurantName}</h1>
                  <p className="text-[10px] text-primary font-medium tracking-widest font-display uppercase">RMS 2026</p>
                </div>
              </button>
            )}

            {!isHome && (
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate me-2">
                {pageTitle}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <BranchSwitcher compact />
            <div className="hidden sm:block text-right me-1 md:me-2">
              <div className="text-xs md:text-sm font-semibold text-foreground">
                {new Date().toLocaleDateString("ar-IQ", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="text-[10px] md:text-xs text-primary font-display">
                {user?.name ?? ""} · {ROLE_LABELS[user?.role ?? ""] ?? ""} · {branchLabel}
              </div>
            </div>

            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
              className="relative flex items-center gap-1 h-9 px-1 rounded-full bg-secondary border border-border hover:border-primary/40 transition-all duration-300 overflow-hidden"
              style={{ width: "5rem" }}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className={`absolute top-1 w-7 h-7 rounded-full shadow-md flex items-center justify-center z-10
                  ${
                    theme === "dark"
                      ? "bg-gradient-to-br from-slate-700 to-slate-900 right-1"
                      : "bg-gradient-to-br from-amber-300 to-amber-500 left-1"
                  }`}
              >
                {theme === "dark" ? (
                  <Moon className="w-3.5 h-3.5 text-blue-300" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-white" />
                )}
              </motion.span>
              <Sun className="w-3.5 h-3.5 text-amber-400 ms-1.5 opacity-60" />
              <Moon className="w-3.5 h-3.5 text-slate-400 me-1.5 ms-auto opacity-60" />
            </button>

            <button className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-primary/20 hover:text-primary transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </button>

            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              title="تسجيل الخروج"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-amber-600 border-2 border-primary/30 flex items-center justify-center font-bold text-sm text-primary-foreground flex-shrink-0 hover:brightness-110 transition-all"
            >
              {user?.name?.charAt(0) ?? "م"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 xl:p-8 relative safe-pb">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 w-full max-w-[1920px] mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
