import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, ShoppingCart, ChefHat, MenuSquare, 
  Grid, ClipboardList, Package, Users, UsersRound, 
  Receipt, LineChart, LogOut, Bell, Sun, Moon
} from "lucide-react";
import { cn, Dialog, Button } from "./ui-elements";
import { useTheme, useAuth } from "@/App";

const NAV_ITEMS = [
  { href: "/", label: "لوحة القيادة", labelEn: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "نقطة البيع", labelEn: "POS", icon: ShoppingCart },
  { href: "/kds", label: "شاشة المطبخ", labelEn: "KDS", icon: ChefHat },
  { href: "/orders", label: "الطلبات", labelEn: "Orders", icon: ClipboardList },
  { href: "/tables", label: "الطاولات", labelEn: "Tables", icon: Grid },
  { href: "/menu", label: "المنيو", labelEn: "Menu", icon: MenuSquare },
  { href: "/inventory", label: "المخزون", labelEn: "Inventory", icon: Package },
  { href: "/customers", label: "العملاء", labelEn: "Customers", icon: Users },
  { href: "/employees", label: "الموظفين", labelEn: "Employees", icon: UsersRound },
  { href: "/expenses", label: "المصاريف", labelEn: "Expenses", icon: Receipt },
  { href: "/reports", label: "التقارير", labelEn: "Reports", icon: LineChart },
];

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
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Hide sidebar completely on POS and KDS for maximum screen space
  const isFullscreen = location === "/pos" || location === "/kds";

  if (isFullscreen) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 glass-panel border-r-0 border-l flex flex-col z-20 sticky top-0 h-screen">
        <div className="p-6 flex items-center space-x-4 space-x-reverse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <ChefHat className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-none mb-1">المطعم الذكي</h1>
            <p className="text-xs text-primary font-medium tracking-widest font-display uppercase">RMS 2026</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 group relative overflow-hidden",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-primary/10 border-l-4 border-primary rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn("w-5 h-5 me-3 relative z-10", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <div className="relative z-10">
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-[10px] opacity-70 font-display tracking-wide uppercase">{item.labelEn}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 space-y-2">
          {/* User info card */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/50">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-primary-foreground font-bold text-base flex-shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{user.name}</p>
                <p className="text-[11px] text-primary font-display">{ROLE_LABELS[user.role] ?? user.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setLogoutOpen(true)}
            className="w-full flex items-center px-4 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors group"
          >
            <LogOut className="w-5 h-5 me-3 group-hover:scale-110 transition-transform" />
            <div className="font-semibold text-sm">تسجيل الخروج</div>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
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
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header */}
        <header className="h-20 glass-panel border-b-0 border-x-0 rounded-none px-8 flex items-center justify-between z-10">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-foreground">
              {NAV_ITEMS.find(i => i.href === location)?.label || "النظام"}
            </h2>
          </div>
          <div className="flex items-center space-x-4 space-x-reverse">
            <div className="text-right me-4">
              <div className="text-sm font-semibold text-foreground">
                {new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="text-xs text-primary font-display">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' })}
              </div>
            </div>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-primary/20 hover:text-primary transition-colors"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-primary/20 hover:text-primary transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full"></span>
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-amber-600 border-2 border-primary/30 flex items-center justify-center font-bold text-sm text-primary-foreground">
              {user?.name?.charAt(0) ?? "م"}
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
