import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  useGetTables,
  useUpdateTable,
  useCreateTable,
  useDeleteTable,
  useGetBranches,
  getGetTablesQueryKey,
  type RestaurantTableStatus,
  type RestaurantTable,
  RestaurantTableType as TableTypeEnum,
} from "@workspace/api-client-react";

type RestaurantTableType = (typeof TableTypeEnum)[keyof typeof TableTypeEnum];
import { Button, Dialog, Input } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { BranchSwitcher } from "@/components/branch-switcher";
import {
  Users,
  MapPin,
  Sparkles,
  Armchair,
  Plus,
  UserRound,
  DoorOpen,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { DiningTableIcon } from "@/components/dining-table-icon";
import { RoomIcon } from "@/components/room-icon";
import { TABLE_STATUS_META } from "@/lib/table-status";
import { useBranch } from "@/lib/branch-context";

type EntityType = RestaurantTableType;

const TYPE_TABS: {
  key: EntityType;
  label: string;
  icon: typeof Armchair;
}[] = [
  { key: "table", label: "طاولة", icon: Armchair },
  { key: "room", label: "غرفة", icon: DoorOpen },
  { key: "person", label: "أشخاص", icon: UserRound },
];

const TYPE_META: Record<
  EntityType,
  {
    label: string;
    labelPlural: string;
    addTitle: string;
    numberLabel: string;
    empty: string;
    capacityLabel: string;
    icon: typeof Armchair;
  }
> = {
  table: {
    label: "طاولة",
    labelPlural: "طاولات",
    addTitle: "إضافة طاولة",
    numberLabel: "رقم الطاولة",
    empty: "لا توجد طاولات في هذا التصنيف",
    capacityLabel: "مقاعد",
    icon: Armchair,
  },
  room: {
    label: "غرفة",
    labelPlural: "غرف",
    addTitle: "إضافة غرفة",
    numberLabel: "رقم الغرفة",
    empty: "لا توجد غرف في هذا التصنيف",
    capacityLabel: "سعة",
    icon: Armchair,
  },
  person: {
    label: "شخص",
    labelPlural: "أشخاص",
    addTitle: "إضافة شخص",
    numberLabel: "اسم الشخص",
    empty: "لا يوجد أشخاص في هذا التصنيف",
    capacityLabel: "سعة",
    icon: UserRound,
  },
};

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const EMPTY_TABLE_FORM = {
  number: "",
  capacity: "4",
  branchId: "",
  type: TableTypeEnum.table as EntityType,
  status: "available" as RestaurantTableStatus,
};

const STATUS_META = TABLE_STATUS_META;

function apiErrorMessage(err: any, fallback: string) {
  return (
    err?.data?.error ||
    err?.data?.message ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export default function Tables() {
  const { selectedBranchId, branchLabel } = useBranch();
  const { data: branches } = useGetBranches();
  const { data: tables, isLoading, refetch } = useGetTables({
    query: {
      queryKey: [...getGetTablesQueryKey(), selectedBranchId],
      staleTime: 1_000,
    },
  });
  const { mutate: updateTable, isPending: isUpdating } = useUpdateTable();
  const { mutate: createTable, isPending: isCreating } = useCreateTable();
  const { mutate: deleteTable, isPending: isDeleting } = useDeleteTable();

  const branchOptions = useMemo<ComboboxOption[]>(
    () =>
      (branches ?? []).map((b) => ({
        value: String(b.id),
        label: b.nameAr?.trim() || b.name || String(b.id),
        icon: Building2,
      })),
    [branches]
  );
  const [entityType, setEntityType] = useState<EntityType>("table");
  const [filter, setFilter] = useState<"all" | RestaurantTableStatus>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_TABLE_FORM);
  const [addError, setAddError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_TABLE_FORM);
  const [editError, setEditError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [searchId, setSearchId] = useState("");

  const typeMeta = TYPE_META[entityType];
  const TypeIcon = typeMeta.icon;
  const needsBranchPick = selectedBranchId === "all";

  const searchPlaceholder =
    entityType === "person"
      ? "ابحث باسم الشخص..."
      : entityType === "room"
        ? "ابحث برقم الغرفة..."
        : "ابحث برقم الطاولة...";

  /** Show seats for the selected branch only (same name OK on other branches) */
  const branchSeats = useMemo(() => {
    const list = tables ?? [];
    if (selectedBranchId === "all") return list;
    return list.filter((t) => t.branchId === selectedBranchId);
  }, [tables, selectedBranchId]);

  const typedTables = useMemo(() => {
    return branchSeats.filter((t) => (t.type ?? "table") === entityType);
  }, [branchSeats, entityType]);

  const typeCounts = useMemo(() => {
    const base = { table: 0, room: 0, person: 0 };
    for (const t of branchSeats) {
      const key = (t.type ?? "table") as EntityType;
      if (key in base) base[key] += 1;
    }
    return base;
  }, [branchSeats]);

  const searchOptions = useMemo<ComboboxOption[]>(() => {
    const allLabel =
      entityType === "person" ? "كل الأشخاص" : entityType === "room" ? "كل الغرف" : "كل الطاولات";
    const Icon = TYPE_TABS.find((t) => t.key === entityType)?.icon ?? Search;
    const items = [...typedTables].sort((a, b) =>
      String(a.number).localeCompare(String(b.number), "ar", { sensitivity: "base" })
    );
    return [
      { value: "", label: allLabel, subtitle: `${typedTables.length} عنصر`, icon: Icon },
      ...items.map((t) => {
        const statusLabel = STATUS_META[t.status]?.label ?? t.status;
        const location = t.location?.trim();
        return {
          value: String(t.id),
          label: String(t.number),
          subtitle: location ? `${statusLabel} · ${location}` : statusLabel,
          icon: Icon,
        };
      }),
    ];
  }, [typedTables, entityType]);

  const searchedTables = useMemo(() => {
    if (!searchId) return typedTables;
    return typedTables.filter((t) => String(t.id) === searchId);
  }, [typedTables, searchId]);

  const counts = useMemo(() => {
    const base = { all: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    for (const t of searchedTables) {
      base.all += 1;
      if (t.status in base) {
        (base as any)[t.status] += 1;
      }
    }
    return base;
  }, [searchedTables]);

  const filtered = useMemo(() => {
    let list = searchedTables;
    if (filter !== "all") {
      list = searchedTables.filter((t) => t.status === filter);
    }
    if (entityType !== "person") return list;
    return [...list].sort((a, b) =>
      String(a.number).localeCompare(String(b.number), "ar", { sensitivity: "base" })
    );
  }, [searchedTables, filter, entityType]);

  const personInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0]}${parts[1][0]}`;
  };

  const nextNumberForType = (type: EntityType, branchId?: string | number) => {
    const bid = branchId != null && branchId !== "" ? Number(branchId) : null;
    const pool =
      bid != null && Number.isFinite(bid)
        ? (tables ?? []).filter((t) => t.branchId === bid)
        : branchSeats;
    const nums = pool
      .filter((t) => (t.type ?? "table") === type)
      .map((t) => parseInt(String(t.number), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1);
  };

  const openAdd = () => {
    const isPerson = entityType === "person";
    const branchId = selectedBranchId === "all" ? "" : String(selectedBranchId);
    setAddForm({
      number: isPerson ? "" : nextNumberForType(entityType, branchId),
      capacity: isPerson ? "1" : "4",
      branchId,
      type: entityType,
      status: "available",
    });
    setAddError("");
    setAddOpen(true);
  };

  const handleTypeChangeInForm = (type: EntityType) => {
    const isPerson = type === "person";
    setAddForm((f) => ({
      ...f,
      type,
      number: isPerson ? "" : nextNumberForType(type, f.branchId),
      capacity: isPerson ? "1" : f.capacity || "4",
    }));
    setAddError("");
  };

  const openEdit = (table: RestaurantTable) => {
    setEditingTable(table);
    setEditForm({
      number: String(table.number ?? ""),
      capacity: String(table.capacity ?? 1),
      branchId: table.branchId != null ? String(table.branchId) : "",
      type: ((table.type as EntityType) || "table") as EntityType,
      status: (table.status as RestaurantTableStatus) || "available",
    });
    setEditError("");
    setEditOpen(true);
  };

  const openDelete = (table: RestaurantTable) => {
    setDeleteTarget(table);
    setDeleteError("");
  };

  const handleCreateTable = () => {
    const type = addForm.type;
    const labels = TYPE_META[type];
    const isPerson = type === "person";
    const number = addForm.number.trim().replace(/\s+/g, " ");
    const capacity = Number(addForm.capacity);
    const branchIdNum = Number(addForm.branchId);
    if (!Number.isFinite(branchIdNum) || branchIdNum <= 0) {
      setAddError("اختر الفرع التابع له");
      return;
    }
    if (!number) {
      setAddError(isPerson ? "اسم الشخص مطلوب" : `${labels.numberLabel} مطلوب`);
      return;
    }
    if (!capacity || capacity < 1) {
      setAddError("السعة يجب أن تكون رقمًا أكبر من صفر");
      return;
    }
    const targetKey = normalizeName(number);
    /** Duplicate only within the same branch + type — other branches may reuse the name */
    const duplicate = (tables ?? []).some(
      (t) =>
        (t.type ?? "table") === type &&
        t.branchId === branchIdNum &&
        normalizeName(String(t.number)) === targetKey
    );
    if (duplicate) {
      setAddError(
        isPerson
          ? "اسم الشخص مستخدم مسبقًا في هذا الفرع"
          : type === "room"
            ? "رقم الغرفة مستخدم مسبقًا في هذا الفرع"
            : "رقم الطاولة مستخدم مسبقًا في هذا الفرع"
      );
      return;
    }
    setAddError("");
    createTable(
      {
        data: {
          number,
          capacity,
          type,
          status: "available",
          branchId: branchIdNum,
        },
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          setEntityType(type);
          setFilter("all");
          refetch();
        },
        onError: (err: any) => {
          setAddError(apiErrorMessage(err, `تعذر إضافة ${labels.label}`));
        },
      }
    );
  };

  const handleSaveEdit = () => {
    if (!editingTable) return;
    const type = editForm.type;
    const labels = TYPE_META[type];
    const isPerson = type === "person";
    const number = editForm.number.trim().replace(/\s+/g, " ");
    const capacity = Number(editForm.capacity);
    if (!number) {
      setEditError(isPerson ? "اسم الشخص مطلوب" : `${labels.numberLabel} مطلوب`);
      return;
    }
    if (!capacity || capacity < 1) {
      setEditError("السعة يجب أن تكون رقمًا أكبر من صفر");
      return;
    }
    const targetKey = normalizeName(number);
    const branchId = editingTable.branchId ?? (typeof selectedBranchId === "number" ? selectedBranchId : null);
    const duplicate = branchSeats.some(
      (t) =>
        t.id !== editingTable.id &&
        (t.type ?? "table") === type &&
        (branchId == null || t.branchId === branchId) &&
        normalizeName(String(t.number)) === targetKey
    );
    if (duplicate) {
      setEditError(
        isPerson
          ? "اسم الشخص مستخدم مسبقًا في هذا الفرع"
          : type === "room"
            ? "رقم الغرفة مستخدم مسبقًا في هذا الفرع"
            : "رقم الطاولة مستخدم مسبقًا في هذا الفرع"
      );
      return;
    }
    setEditError("");
    updateTable(
      {
        id: editingTable.id,
        data: {
          number,
          capacity,
          type,
          status: editForm.status,
          branchId: branchId ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          setEditingTable(null);
          refetch();
        },
        onError: (err: any) => setEditError(apiErrorMessage(err, `تعذر تعديل ${labels.label}`)),
      }
    );
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleteError("");
    deleteTable(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          if (editingTable?.id === deleteTarget.id) {
            setEditOpen(false);
            setEditingTable(null);
          }
          refetch();
        },
        onError: (err: any) =>
          setDeleteError(apiErrorMessage(err, "تعذر الحذف")),
      }
    );
  };

  const editTypeMeta = TYPE_META[editForm.type];
  const EditTypeIcon = editTypeMeta.icon;
  const deleteTypeMeta = TYPE_META[((deleteTarget?.type as EntityType) || "table")];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-primary mb-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] font-display tracking-[0.2em] uppercase">Hall Floor</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">إدارة الطاولات</h2>
            <p className="text-sm text-muted-foreground mt-1">
              طاولات وغرف وأشخاص حسب الفرع · نفس الاسم مسموح في فرع آخر · {branchLabel}
            </p>
          </div>
          <BranchSwitcher />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-secondary/40 p-2 sm:p-2.5 shadow-sm space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="flex flex-1 min-w-0 p-1 rounded-xl bg-background/70 border border-border/50 gap-1">
            {TYPE_TABS.map(({ key, label, icon: Icon }) => {
              const active = entityType === key;
              const count = typeCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                onClick={() => {
                  setEntityType(key);
                  setFilter("all");
                  setSearchId("");
                }}
                  className={`flex-1 inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-2.5 sm:px-4 rounded-lg text-sm sm:text-base font-extrabold transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-l from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "opacity-100" : "opacity-70"}`} />
                  <span>{label}</span>
                  <span
                    className={`min-w-6 h-6 px-1.5 rounded-full inline-flex items-center justify-center text-[11px] font-display font-bold ${
                      active
                        ? "bg-white/25 text-primary-foreground"
                        : "bg-secondary text-muted-foreground border border-border/60"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 lg:w-[min(100%,28rem)] lg:flex-shrink-0">
            <ModernCombobox
              className="flex-1 min-w-0"
              value={searchId}
              onChange={(value) => {
                setSearchId(value);
                setFilter("all");
                if (value) {
                  const found = typedTables.find((t) => String(t.id) === value);
                  if (found) openEdit(found);
                }
              }}
              options={searchOptions}
              searchable
              searchPlaceholder={searchPlaceholder}
              placeholder={searchPlaceholder}
              label={undefined}
              icon={Search}
              emptyText="لا توجد نتائج"
            />
            <Button
              onClick={openAdd}
              className="rounded-xl h-12 px-5 gap-2 text-sm font-extrabold shadow-md shadow-primary/20 flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
              {typeMeta.addTitle}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "الكل", counts.all],
            ["available", "متاح", counts.available],
            ["occupied", "مشغول", counts.occupied],
            ["reserved", "محجوز", counts.reserved],
            ["cleaning", "تنظيف", counts.cleaning],
          ] as const
        ).map(([key, label, count]) => {
          const meta = key === "all" ? null : STATUS_META[key];
          const active =
            key === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
              : meta!.filterActive;
          const idle =
            key === "all"
              ? "bg-secondary/70 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              : meta!.filterIdle;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-2 h-9 px-3 rounded-full border text-xs font-bold transition-all ${
                filter === key ? active : idle
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  key === "all" ? "bg-current opacity-70" : meta!.dot
                } ${filter === key && key !== "all" ? "bg-white" : ""}`}
              />
              {label}
              <span className="font-display opacity-90">{count}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-20 text-center text-muted-foreground">
          {entityType === "room" ? (
            <RoomIcon className="w-24 h-auto mx-auto mb-3 opacity-60" />
          ) : (
            <TypeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          )}
          <p className="font-bold">{typeMeta.empty}</p>
          {filter === "all" && (
            <Button onClick={openAdd} className="rounded-full mt-4">
              <Plus className="w-4 h-4 me-1.5" />
              {typeMeta.addTitle}
            </Button>
          )}
        </div>
      ) : entityType === "person" ? (
        <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden shadow-sm">
          <div className="hidden sm:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_90px_110px_120px] gap-3 px-5 py-3 border-b border-border/60 bg-secondary/40 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            <span>الاسم</span>
            <span>الموقع</span>
            <span className="text-center">السعة</span>
            <span className="text-center">الحالة</span>
            <span className="text-center">إجراءات</span>
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map((person) => {
              const meta = STATUS_META[person.status] ?? STATUS_META.available;
              const name = String(person.number);
              return (
                <div
                  key={person.id}
                  className="px-4 sm:px-5 py-3.5 sm:py-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_90px_110px_120px] gap-2 sm:gap-3 items-center hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/90 to-amber-500 text-primary-foreground flex items-center justify-center text-sm font-extrabold shadow-md shadow-primary/20 flex-shrink-0">
                      {personInitials(name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {person.location || "بدون موقع"}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                    <span className="truncate">{person.location || "بدون موقع"}</span>
                  </div>

                  <div className="hidden sm:flex items-center justify-center gap-1 text-sm font-bold text-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="font-display">{person.capacity}</span>
                  </div>

                  <div className="flex sm:justify-center items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${meta.chip}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {meta.label}
                    </span>
                    <span className="sm:hidden text-xs text-muted-foreground font-bold">
                      سعة {person.capacity}
                    </span>
                  </div>

                  <div className="flex justify-end sm:justify-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-2.5 gap-1 font-bold"
                      onClick={() => openEdit(person)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      تعديل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => openDelete(person)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
          {filtered.map((table, idx) => {
            const meta = STATUS_META[table.status] ?? STATUS_META.available;
            return (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                whileHover={{ y: -6 }}
                className={`
                  group relative aspect-[4/5] rounded-[1.75rem] border-2 backdrop-blur-xl
                  overflow-hidden text-center shadow-lg shadow-black/5
                  ${meta.card} ${meta.ring}
                  transition-shadow duration-300 hover:shadow-xl
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${meta.glow}`} />

                <div className="relative z-10 h-full flex flex-col items-center justify-between p-4 sm:p-5">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${meta.chip}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    {meta.label}
                  </div>

                  <div className="relative w-full max-w-[11rem] sm:max-w-[13rem] mx-auto group-hover:scale-105 transition-transform duration-300">
                    {entityType === "table" ? (
                      <DiningTableIcon
                        number={table.number}
                        className="w-full h-auto drop-shadow-md"
                      />
                    ) : (
                      <RoomIcon
                        number={table.number}
                        className="w-full h-auto drop-shadow-md"
                      />
                    )}
                  </div>

                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-foreground">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-display">{table.capacity}</span>
                      <span className="text-muted-foreground font-medium">
                        {typeMeta.capacityLabel}
                      </span>
                    </div>
                    {table.location && (
                      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary/80" />
                        <span className="truncate max-w-[9rem]">{table.location}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1.5 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 gap-1 text-[11px] font-extrabold bg-background/80"
                        onClick={() => openEdit(table)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        تعديل
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-destructive border-destructive/35 bg-background/80 hover:bg-destructive/10"
                        onClick={() => openDelete(table)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={TYPE_META[addForm.type].addTitle}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-amber-500/5 to-transparent p-4 flex items-center gap-3">
            {addForm.type === "table" ? (
              <DiningTableIcon className="w-16 h-auto flex-shrink-0" />
            ) : addForm.type === "room" ? (
              <RoomIcon className="w-20 h-auto flex-shrink-0" />
            ) : (
              (() => {
                const Icon = TYPE_META[addForm.type].icon;
                return <Icon className="w-12 h-12 text-primary flex-shrink-0" />;
              })()
            )}
            <div className="min-w-0">
              <p className="font-bold text-foreground">
                {addForm.type === "person"
                  ? "شخص جديد"
                  : addForm.type === "room"
                    ? "غرفة جديدة"
                    : "طاولة جديدة"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {addForm.type === "person"
                  ? "أدخل اسم الشخص والسعة واختر الفرع التابع له"
                  : "اختر النوع والرقم والسعة والفرع التابع له"}
              </p>
            </div>
          </div>

          <div>
            <ModernCombobox
              value={addForm.branchId}
              onChange={(v) => {
                setAddForm((f) => ({
                  ...f,
                  branchId: v,
                  number: f.type === "person" ? f.number : nextNumberForType(f.type, v),
                }));
                if (addError) setAddError("");
              }}
              options={branchOptions}
              label="تابع فرع *"
              placeholder="اختر الفرع"
              icon={Building2}
              searchable
              searchPlaceholder="ابحث عن فرع..."
              emptyText="لا يوجد فرع"
              labelClassName="text-sm font-semibold"
              valueClassName="text-sm font-bold"
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              النوع <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["table", "طاولة"],
                  ["room", "غرفة"],
                  ["person", "شخص"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTypeChangeInForm(key)}
                  className={`h-11 rounded-xl border-2 text-sm font-bold transition-all ${
                    addForm.type === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              {TYPE_META[addForm.type].numberLabel}{" "}
              <span className="text-destructive">*</span>
            </label>
            {addForm.type === "person" ? (
              <>
                <Input
                  value={addForm.number}
                  onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))}
                  placeholder="احمد محمد"
                  className="placeholder:text-muted-foreground/25"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  لا يُسمح بأسماء مكررة
                </p>
              </>
            ) : (
              <>
                <Input
                  value={addForm.number}
                  readOnly
                  disabled
                  dir="ltr"
                  className="opacity-80 cursor-not-allowed font-display font-bold"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  يزداد تلقائياً حسب النوع ولا يمكن تعديله
                </p>
              </>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              السعة ({TYPE_META[addForm.type].capacityLabel}){" "}
              <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={1}
              noAmountPad
              value={addForm.capacity}
              onChange={(e) => setAddForm((f) => ({ ...f, capacity: e.target.value }))}
              dir="ltr"
              autoFocus={addForm.type !== "person"}
            />
          </div>

          {addError && <p className="text-sm font-semibold text-destructive">{addError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateTable} isLoading={isCreating}>
              <Plus className="w-4 h-4 me-1" />
              حفظ {TYPE_META[addForm.type].label}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingTable(null);
        }}
        title={`تعديل ${editTypeMeta.label}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-amber-500/5 to-transparent p-4 flex items-center gap-3">
            {editForm.type === "table" ? (
              <DiningTableIcon number={editForm.number} className="w-16 h-auto flex-shrink-0" />
            ) : editForm.type === "room" ? (
              <RoomIcon number={editForm.number} className="w-20 h-auto flex-shrink-0" />
            ) : (
              <EditTypeIcon className="w-12 h-12 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-foreground">تعديل {editTypeMeta.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                عدّل الرقم/الاسم والسعة والحالة
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              {editTypeMeta.numberLabel} <span className="text-destructive">*</span>
            </label>
            <Input
              value={editForm.number}
              onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
              placeholder={editForm.type === "person" ? "احمد محمد" : "1"}
              dir={editForm.type === "person" ? undefined : "ltr"}
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              السعة ({editTypeMeta.capacityLabel}) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={1}
              noAmountPad
              value={editForm.capacity}
              onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))}
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">الحالة</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["available", "occupied", "reserved", "cleaning"] as const).map((s) => {
                const m = STATUS_META[s];
                const active = editForm.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, status: s }))}
                    className={`h-10 rounded-xl border-2 text-xs font-bold transition-all ${
                      active ? m.chip + " scale-[1.02]" : m.filterIdle
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {editError ? (
            <p className="text-sm font-semibold text-destructive">{editError}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => {
                setEditOpen(false);
                setEditingTable(null);
              }}
            >
              إلغاء
            </Button>
            <Button onClick={handleSaveEdit} isLoading={isUpdating} className="gap-1.5">
              <Pencil className="w-4 h-4" />
              حفظ التعديل
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        title={`حذف ${deleteTypeMeta.label}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-bold text-[15px]">
              حذف {deleteTypeMeta.label} «{deleteTarget?.number}»؟
            </p>
            <p className="text-sm text-muted-foreground mt-1 font-semibold">
              لا يمكن التراجع — إن كانت مستخدمة في طلبات فسيُرفض الحذف
            </p>
          </div>
          {deleteError ? (
            <p className="text-sm font-bold text-destructive">{deleteError}</p>
          ) : null}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError("");
              }}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-1.5"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
            >
              <Trash2 className="w-4 h-4" />
              حذف
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
