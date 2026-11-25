import React, { forwardRef } from "react";
import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- BUTTON ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "ghost-primary";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      default: "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border-2 border-border bg-transparent hover:border-primary hover:text-primary",
      ghost: "bg-transparent hover:bg-secondary text-foreground",
      "ghost-primary": "bg-transparent hover:bg-primary/10 text-primary",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20",
    };
    const sizes = {
      default: "h-11 px-6 py-2",
      sm: "h-9 px-4 text-sm",
      lg: "h-14 px-8 text-lg",
      icon: "h-11 w-11 flex items-center justify-center p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="me-2 h-5 w-5 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// --- CARD ---
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-panel rounded-2xl overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

// --- INPUT ---
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Force on-screen amount keypad when device setting is on */
  amountPad?: boolean;
  /** Never open amount keypad (capacity, seats, etc.) */
  noAmountPad?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, amountPad, noAmountPad, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-12 w-full rounded-xl border-2 border-border bg-background/50 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          className
        )}
        ref={ref}
        data-amount-pad={amountPad ? "true" : undefined}
        data-no-amount-pad={noAmountPad ? "true" : undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-12 w-full rounded-xl border-2 border-border bg-background/50 px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 appearance-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Select.displayName = "Select";

// --- BADGE ---
export function Badge({ className, variant = "default", children, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "success" | "warning" | "destructive" | "outline" | "secondary" }) {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "border-border text-foreground",
    secondary: "bg-secondary text-secondary-foreground border-transparent",
  };
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)} {...props}>
      {children}
    </div>
  );
}

// --- DIALOG ---
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  /** Use overlay when nesting above another dialog */
  layer?: "base" | "overlay";
  /** Hide title + close header (e.g. custom chrome inside children) */
  hideHeader?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title = "",
  children,
  maxWidth = "max-w-lg",
  layer = "base",
  hideHeader = false,
}: DialogProps) {
  const backdropZ = layer === "overlay" ? "z-[70]" : "z-50";
  const panelZ = layer === "overlay" ? "z-[80]" : "z-[60]";

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn("fixed inset-0 bg-black/80 backdrop-blur-sm", backdropZ)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "fixed inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none",
              panelZ
            )}
          >
            <div
              className={cn(
                "w-full glass-panel rounded-2xl p-4 sm:p-5 max-h-[min(92vh,880px)] overflow-y-auto overscroll-contain pointer-events-auto shadow-2xl",
                maxWidth
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {!hideHeader && (
                <div className="flex justify-between items-center gap-3 mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-xl font-bold leading-tight tracking-tight">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full min-h-11 min-w-11 p-2.5 hover:bg-secondary transition-colors flex-shrink-0 touch-manipulation inline-flex items-center justify-center"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// --- TABLE ---
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto rounded-xl border border-border bg-card">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b border-border bg-secondary/50", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border transition-colors hover:bg-secondary/30 data-[state=selected]:bg-secondary", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-12 px-4 text-start align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />;
}
