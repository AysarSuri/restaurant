export const TABLE_STATUS_META: Record<
  string,
  {
    label: string;
    ring: string;
    glow: string;
    chip: string;
    card: string;
    filterActive: string;
    filterIdle: string;
    dot: string;
  }
> = {
  available: {
    label: "متاح",
    ring: "ring-emerald-500/70 border-emerald-500",
    glow: "from-emerald-500/45 via-emerald-400/15 to-transparent",
    chip: "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/40",
    card: "bg-emerald-500/10",
    filterActive: "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/35",
    filterIdle:
      "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
    dot: "bg-emerald-500",
  },
  occupied: {
    label: "مشغول",
    ring: "ring-rose-500/70 border-rose-500",
    glow: "from-rose-500/50 via-rose-400/15 to-transparent",
    chip: "bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/40",
    card: "bg-rose-500/10",
    filterActive: "bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/35",
    filterIdle:
      "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20",
    dot: "bg-rose-500",
  },
  reserved: {
    label: "محجوز",
    ring: "ring-amber-500/70 border-amber-500",
    glow: "from-amber-500/50 via-amber-400/20 to-transparent",
    chip: "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/40",
    card: "bg-amber-500/10",
    filterActive: "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/35",
    filterIdle:
      "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20",
    dot: "bg-amber-500",
  },
  cleaning: {
    label: "تنظيف",
    ring: "ring-sky-500/70 border-sky-500",
    glow: "from-sky-500/50 via-sky-400/15 to-transparent",
    chip: "bg-sky-500 text-white border-sky-600 shadow-sm shadow-sky-500/40",
    card: "bg-sky-500/10",
    filterActive: "bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-500/35",
    filterIdle:
      "bg-sky-500/10 border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20",
    dot: "bg-sky-500",
  },
};
