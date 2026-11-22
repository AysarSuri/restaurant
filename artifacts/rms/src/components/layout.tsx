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
import { LanguageSwitcher } from "./language-switcher";
import { useTheme, useAuth } from "@/App";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { pageTitleKeys, roleLabelKeys } from "@/i18n/messages";
import { useGetSettings } from "@workspace/api-client-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { branchLabel } = useBranch();
  const { t, dateLocale, formatDate, usesYmdSlash } = useI18n();
  const { data: appSettings } = useGetSettings({
    query: { staleTime: 60_000, refetchOnWindowFocus: false },
  });
  const restaurantName = appSettings?.restaurantName?.trim() || t("app.name");
  const logoUrl = appSettings?.logoUrl?.trim() || "";
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isFullscreen = location === "/pos" || location === "/kds";
  const isHome = location === "/";
  const pageTitle = t(pageTitleKeys[location] || "app.system");

  if (isFullscreen) {
    return <div className="min-h-app bg-background page-shell">{children}</div>;
  }

  return (
    <div className="flex min-h-app bg-background overflow-hidden page-shell">
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
            <Button
              variant="outline"
              className="flex-1 min-h-12 touch-manipulation"
              onClick={() => setLogoutOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2 min-h-12 touch-manipulation"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" /> {t("auth.logout")}
            </Button>
          </div>
        </div>
      </Dialog>

      <main className="flex-1 flex flex-col h-app overflow-hidden relative min-w-0">
        {isHome ? (
          <header className="min-h-[4.25rem] md:min-h-[4.75rem] glass-panel border-b-0 border-x-0 rounded-none px-3 sm:px-4 md:px-6 xl:px-8 py-2 flex flex-wrap items-center justify-between gap-2 z-10 flex-shrink-0">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-3 min-w-0 min-h-12 touch-manipulation rounded-2xl pe-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0 overflow-hidden border border-primary/20">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={restaurantName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ChefHat className="w-6 h-6 text-primary-foreground" />
                )}
              </div>
              <div className="min-w-0 text-right">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-foreground leading-none truncate">
                  {restaurantName}
                </h1>
              </div>
            </button>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              <LanguageSwitcher className="!p-1 !gap-1" />
              <BranchSwitcher />
              <div className="hidden md:block text-right me-1">
                <div className="text-sm font-semibold text-foreground">
                  {(() => {
                    const d = new Date();
                    const weekday = d.toLocaleDateString(dateLocale, { weekday: "long" });
                    const day = String(d.getDate()).padStart(2, "0");
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const year = d.getFullYear();
                    const numeric = usesYmdSlash
                      ? formatDate(d)
                      : `${day}/${month}/${year}`;
                    return (
                      <>
                        {weekday}{" "}
                        <span className="font-display tabular-nums" dir="ltr">
                          {numeric}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <div className="text-xs text-primary font-display">
                  {user?.name ?? ""} · {t(roleLabelKeys[user?.role ?? ""] ?? "app.system")} ·{" "}
                  {branchLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                title={theme === "dark" ? t("theme.light") : t("theme.dark")}
                className="relative flex items-center gap-1 h-12 px-1.5 rounded-full bg-secondary border border-border hover:border-primary/40 transition-all duration-300 overflow-hidden touch-manipulation"
                style={{ width: "5.75rem" }}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={`absolute top-1.5 w-9 h-9 rounded-full shadow-md flex items-center justify-center z-10
                    ${
                      theme === "dark"
                        ? "bg-gradient-to-br from-slate-700 to-slate-900 right-1.5"
                        : "bg-gradient-to-br from-amber-300 to-amber-500 left-1.5"
                    }`}
                >
                  {theme === "dark" ? (
                    <Moon className="w-4 h-4 text-blue-300" />
                  ) : (
                    <Sun className="w-4 h-4 text-white" />
                  )}
                </motion.span>
                <Sun className="w-4 h-4 text-amber-400 ms-2 opacity-60" />
                <Moon className="w-4 h-4 text-slate-400 me-2 ms-auto opacity-60" />
              </button>

              <button
                type="button"
                className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-primary/20 hover:text-primary transition-colors relative touch-manipulation"
                aria-label={t("nav.home")}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-destructive rounded-full" />
              </button>

              <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                title={t("auth.logout")}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-amber-600 border-2 border-primary/30 flex items-center justify-center font-bold text-base text-primary-foreground flex-shrink-0 hover:brightness-110 transition-all touch-manipulation"
              >
                {user?.name?.charAt(0) ?? "?"}
              </button>
            </div>
          </header>
        ) : (
          <header className="min-h-14 h-14 md:h-16 glass-panel border-b-0 border-x-0 rounded-none px-3 sm:px-4 md:px-6 flex items-center gap-3 z-10 flex-shrink-0">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 min-h-12 h-12 px-4 sm:px-5 rounded-full border-2 border-primary/40 bg-primary/10 text-primary text-[15px] font-bold hover:bg-primary/20 transition-colors flex-shrink-0 touch-manipulation"
            >
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline">{t("nav.home")}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate">
              {pageTitle}
            </h2>
          </header>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 xl:p-8 relative safe-pb touch-ui">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 w-full max-w-[1920px] mx-auto touch-ui">{children}</div>
        </div>
      </main>
    </div>
  );
}
