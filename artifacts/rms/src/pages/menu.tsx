import React, { useMemo, useRef, useState } from "react";
import {
  useGetMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useGetMenuCategories,
  useCreateMenuCategory,
  useUpdateMenuCategory,
  useDeleteMenuCategory,
  useGetBranches,
  useGetItemUnits,
  useCreateItemUnit,
  getGetItemUnitsQueryKey,
  type MenuCategory,
  type MenuItem,
  type ItemUnit,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CrudTable } from "@/components/crud-table";
import { Dialog, Input, Button } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import {
  BadgeDollarSign,
  Building2,
  Check,
  CircleSlash,
  Eye,
  EyeOff,
  FolderPlus,
  ImagePlus,
  Lock,
  Package,
  Pencil,
  Plus,
  Star,
  Tags,
  Trash2,
  X,
} from "lucide-react";

const LOCKED_MINOR_UNIT = "عدد";

const CATEGORY_IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
const CATEGORY_IMAGE_MAX = 4 * 1024 * 1024;

type CategoryFormState = {
  nameAr: string;
  name: string;
  imageUrl: string;
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  nameAr: "",
  name: "",
  imageUrl: "",
};

async function readCategoryImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("اختر ملف صورة فقط");
  }
  if (file.size > CATEGORY_IMAGE_MAX) {
    throw new Error("حجم الصورة كبير جداً (الحد 4MB)");
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
}

function CategoryImageThumb({
  src,
  alt,
  className = "w-12 h-12",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${className} rounded-xl object-cover border border-border/50 bg-secondary/40 flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 border border-border/40`}
    >
      <Tags className="w-5 h-5" />
    </div>
  );
}

export default function Menu() {
  const { data: items, isLoading, refetch } = useGetMenuItems();
  const { data: categories, refetch: refetchCategories } = useGetMenuCategories();
  const { data: branches } = useGetBranches({
    query: { staleTime: 60_000, refetchOnMount: false },
  });
  const queryClient = useQueryClient();
  const { mutate: create } = useCreateMenuItem();
  const { mutate: update } = useUpdateMenuItem();
  const { mutate: remove } = useDeleteMenuItem();
  const { mutate: createCategory, isPending: isCreatingCategory } = useCreateMenuCategory();
  const { mutate: updateCategory, isPending: isUpdatingCategory } = useUpdateMenuCategory();
  const { mutate: deleteCategory, isPending: isDeletingCategory } = useDeleteMenuCategory();
  const { data: itemUnits } = useGetItemUnits();
  const { mutate: createItemUnit, isPending: isCreatingUnit } = useCreateItemUnit();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [editForm, setEditForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [categoryError, setCategoryError] = useState("");
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [newUnitNameAr, setNewUnitNameAr] = useState("");
  const [newUnitNameEn, setNewUnitNameEn] = useState("");
  const [unitError, setUnitError] = useState("");
  const addImageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState("");
  const [filterItemId, setFilterItemId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [filterFavorite, setFilterFavorite] = useState<"all" | "favorite" | "normal">("all");

  const [formData, setFormData] = useState({
    nameAr: "",
    name: "",
    price: "" as string | number,
    costMode: "none" as "none" | "with",
    cost: 0,
    majorUnit: "",
    subunitQty: 1,
    categoryId: 0,
    isAvailable: true,
    isFavorite: false,
    allBranches: true,
    branchIds: [] as number[],
    imageUrl: "",
  });
  const itemImageInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo<ComboboxOption[]>(() => {
    return (categories ?? []).map((c) => ({
      value: String(c.id),
      label: c.nameAr,
      subtitle: c.name?.trim() || "تصنيف أصناف",
      icon: Tags,
    }));
  }, [categories]);

  const filterCategoryOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "", label: "كل التصنيفات", subtitle: "بدون فلتر", icon: Tags },
      ...categoryOptions,
    ],
    [categoryOptions]
  );

  const filterBranchOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "", label: "كل الفروع", subtitle: "بدون فلتر", icon: Building2 },
      {
        value: "all",
        label: "جميع الفروع",
        subtitle: "أصناف متاحة لكل الفروع",
        icon: Building2,
      },
      ...(branches ?? []).map((b) => ({
        value: String(b.id),
        label: b.name,
        subtitle: "فرع محدد",
        icon: Building2,
      })),
    ],
    [branches]
  );

  const filterVisibilityOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "all", label: "الكل", subtitle: "ظاهر ومخفي", icon: Eye },
      { value: "visible", label: "ظاهر", subtitle: "يظهر في البيع", icon: Eye },
      { value: "hidden", label: "مخفي", subtitle: "مخفي من البيع", icon: EyeOff },
    ],
    []
  );

  const filterFavoriteOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "all", label: "الكل", subtitle: "مفضل وعادي", icon: Star },
      { value: "favorite", label: "مفضل", subtitle: "في المفضلة فقط", icon: Star },
      { value: "normal", label: "عادي", subtitle: "غير مفضل", icon: Star },
    ],
    []
  );

  const filterItemOptions = useMemo<ComboboxOption[]>(() => {
    const sorted = [...(items ?? [])].sort((a, b) =>
      (a.nameAr || "").localeCompare(b.nameAr || "", "ar")
    );
    return [
      {
        value: "",
        label: "كل الأصناف",
        subtitle: "عرض بدون اختيار صنف",
        icon: Package,
      },
      ...sorted.map((item) => ({
        value: String(item.id),
        label: item.nameAr,
        subtitle: item.name?.trim() || categories?.find((c) => c.id === item.categoryId)?.nameAr || "صنف",
        icon: Package,
      })),
    ];
  }, [items, categories]);

  const filteredItems = useMemo(() => {
    const list = items ?? [];
    return list.filter((item) => {
      if (filterItemId && String(item.id) !== filterItemId) return false;
      if (filterCategoryId && String(item.categoryId) !== filterCategoryId) return false;
      if (filterBranchId === "all") {
        if (!(item.allBranches !== false || !(item.branchIds?.length))) return false;
      } else if (filterBranchId) {
        const branchId = Number(filterBranchId);
        const isAll = item.allBranches !== false || !(item.branchIds?.length);
        if (!isAll && !(item.branchIds ?? []).includes(branchId)) return false;
      }
      if (filterVisibility === "visible" && !item.isAvailable) return false;
      if (filterVisibility === "hidden" && item.isAvailable) return false;
      if (filterFavorite === "favorite" && item.isFavorite !== true) return false;
      if (filterFavorite === "normal" && item.isFavorite === true) return false;
      return true;
    });
  }, [
    items,
    filterItemId,
    filterCategoryId,
    filterBranchId,
    filterVisibility,
    filterFavorite,
  ]);

  const costModeOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: "none",
        label: "بدون تكلفة",
        subtitle: "لا يُسجَّل سعر تكلفة للصنف",
        icon: CircleSlash,
      },
      {
        value: "with",
        label: "تكلفة",
        subtitle: "تفاصيل الوحدات وتكلفة العدد",
        icon: BadgeDollarSign,
      },
    ],
    []
  );

  const majorUnitOptions = useMemo<ComboboxOption[]>(() => {
    const fromDb = (itemUnits ?? []).map((u) => ({
      value: u.nameAr,
      label: u.nameAr,
      subtitle: u.name?.trim() || undefined,
      icon: Package,
    }));
    const hasMinorAsMajor = fromDb.some((u) => u.value === LOCKED_MINOR_UNIT);
    if (hasMinorAsMajor) return fromDb;
    return [
      {
        value: LOCKED_MINOR_UNIT,
        label: LOCKED_MINOR_UNIT,
        subtitle: "نفس الوحدة الصغرى",
        icon: Package,
      },
      ...fromDb,
    ];
  }, [itemUnits]);

  const isSameUnit =
    formData.costMode === "with" &&
    formData.majorUnit.trim() === LOCKED_MINOR_UNIT;

  const handleOpen = (item?: MenuItem) => {
    setFormError("");
    if (item) {
      const hasCost =
        item.cost != null && item.cost !== "" && Number(item.cost) > 0;
      setEditing(item);
      setFormData({
        nameAr: item.nameAr,
        name: item.name,
        price: Number(item.price) || 0,
        costMode: hasCost ? "with" : "none",
        cost: hasCost ? Number(item.cost) : 0,
        majorUnit: item.majorUnit?.trim() || "",
        subunitQty:
          (item.majorUnit?.trim() || "") === LOCKED_MINOR_UNIT
            ? 1
            : Math.max(1, Number(item.subunitQty) || 1),
        categoryId: item.categoryId,
        isAvailable: item.isAvailable,
        isFavorite: item.isFavorite === true,
        allBranches: item.allBranches !== false || !(item.branchIds?.length),
        branchIds: item.branchIds ?? [],
        imageUrl: item.imageUrl || "",
      });
    } else {
      setEditing(null);
      setFormData({
        nameAr: "",
        name: "",
        price: "",
        costMode: "none",
        cost: 0,
        majorUnit: "",
        subunitQty: 1,
        categoryId: categories?.[0]?.id || 0,
        isAvailable: true,
        isFavorite: false,
        allBranches: true,
        branchIds: [],
        imageUrl: "",
      });
    }
    setIsOpen(true);
  };

  const openAddUnitDialog = () => {
    setNewUnitNameAr("");
    setNewUnitNameEn("");
    setUnitError("");
    setIsUnitDialogOpen(true);
  };

  const handleCreateUnit = () => {
    const nameAr = newUnitNameAr.trim();
    if (!nameAr) {
      setUnitError("اسم الوحدة مطلوب");
      return;
    }
    setUnitError("");
    createItemUnit(
      { data: { nameAr, name: newUnitNameEn.trim() || undefined } },
      {
        onSuccess: (created: ItemUnit) => {
          queryClient.setQueryData<ItemUnit[]>(getGetItemUnitsQueryKey(), (prev) => [
            ...(prev ?? []),
            created,
          ]);
          setFormData((f) => ({ ...f, majorUnit: created.nameAr }));
          setIsUnitDialogOpen(false);
        },
        onError: (err: any) => {
          setUnitError(err?.data?.message || err?.message || "تعذر إضافة الوحدة");
        },
      }
    );
  };

  const toggleBranch = (id: number) => {
    setFormData((f) => {
      const exists = f.branchIds.includes(id);
      const branchIds = exists ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id];
      return { ...f, allBranches: false, branchIds };
    });
    setFormError("");
  };

  const selectAllBranches = () => {
    setFormData((f) => ({ ...f, allBranches: true, branchIds: [] }));
    setFormError("");
  };

  const isDuplicateName = (nameAr: string, name: string, excludeId?: number) => {
    const ar = nameAr.trim().toLowerCase();
    const en = name.trim().toLowerCase();
    return (items ?? []).some((item) => {
      if (excludeId != null && item.id === excludeId) return false;
      return (
        item.nameAr.trim().toLowerCase() === ar ||
        item.name.trim().toLowerCase() === en
      );
    });
  };

  const toggleItemFlag = (
    item: MenuItem,
    patch: { isAvailable?: boolean; isFavorite?: boolean }
  ) => {
    update(
      {
        id: item.id,
        data: {
          categoryId: item.categoryId,
          name: item.name,
          nameAr: item.nameAr,
          nameKu: item.nameKu ?? "",
          description: item.description ?? "",
          descriptionAr: item.descriptionAr ?? "",
          price: item.price,
          cost: item.cost,
          imageUrl: item.imageUrl ?? undefined,
          isAvailable: patch.isAvailable ?? item.isAvailable,
          isFavorite: patch.isFavorite ?? item.isFavorite === true,
          allBranches: item.allBranches !== false,
          branchIds: item.branchIds ?? [],
          preparationTime: item.preparationTime,
          calories: item.calories,
          sortOrder: item.sortOrder,
        },
      },
      { onSuccess: () => refetch() }
    );
  };

  const handleSubmit = () => {
    if (!formData.nameAr.trim() || !formData.name.trim()) {
      setFormError("الاسم العربي والإنجليزي مطلوبان");
      return;
    }
    if (!formData.categoryId) {
      setFormError("اختر التصنيف");
      return;
    }
    if (!formData.allBranches && formData.branchIds.length === 0) {
      setFormError("اختر جميع الفروع أو فرعاً واحداً على الأقل");
      return;
    }
    if (isDuplicateName(formData.nameAr, formData.name, editing?.id)) {
      setFormError("اسم الصنف مكرر — اختر اسماً عربياً أو إنجليزياً مختلفاً");
      return;
    }
    if (formData.costMode === "with") {
      if (!formData.majorUnit.trim()) {
        setFormError("اختر الوحدة الكبرى");
        return;
      }
      const subunitQty =
        formData.majorUnit.trim() === LOCKED_MINOR_UNIT
          ? 1
          : Math.floor(Number(formData.subunitQty));
      if (!(subunitQty >= 1)) {
        setFormError("عدد الكمية الفرعية يجب أن يكون 1 أو أكثر");
        return;
      }
      if (!(Number(formData.cost) > 0)) {
        setFormError("أدخل تكلفة بوحدة الصغرى (عدد)");
        return;
      }
    }
    setFormError("");

    const withCost = formData.costMode === "with";
    const data = {
      nameAr: formData.nameAr.trim(),
      name: formData.name.trim(),
      price:
        formData.price === "" || formData.price === null
          ? 0
          : Number(formData.price) || 0,
      cost: withCost ? Number(formData.cost) : null,
      majorUnit: withCost ? formData.majorUnit.trim() : null,
      subunitQty: withCost
        ? formData.majorUnit.trim() === LOCKED_MINOR_UNIT
          ? 1
          : Math.floor(Number(formData.subunitQty))
        : null,
      categoryId: formData.categoryId,
      isAvailable: formData.isAvailable,
      isFavorite: formData.isFavorite,
      allBranches: formData.allBranches,
      branchIds: formData.allBranches ? [] : formData.branchIds,
      imageUrl: formData.imageUrl || undefined,
      nameKu: "",
      description: "",
      descriptionAr: "",
    };

    const onError = (err: any) =>
      setFormError(err?.data?.message || err?.message || "تعذر الحفظ");

    if (editing) {
      update(
        { id: editing.id, data },
        { onSuccess: () => { setIsOpen(false); refetch(); }, onError }
      );
    } else {
      create(
        { data },
        { onSuccess: () => { setIsOpen(false); refetch(); }, onError }
      );
    }
  };

  const pickItemImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readCategoryImageFile(file);
      setFormData((f) => ({ ...f, imageUrl: dataUrl }));
      setFormError("");
    } catch (err: any) {
      setFormError(err?.message || "تعذر رفع الصورة");
    }
  };

  const openCategoryManager = () => {
    setShowAddCategory(false);
    setEditingCategoryId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryError("");
    setIsCategoryOpen(true);
  };

  const startEditCategory = (cat: MenuCategory) => {
    setShowAddCategory(false);
    setEditingCategoryId(cat.id);
    setEditForm({
      nameAr: cat.nameAr,
      name: cat.name,
      imageUrl: cat.imageUrl || "",
    });
    setCategoryError("");
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditForm(EMPTY_CATEGORY_FORM);
  };

  const pickCategoryImage = async (
    file: File | undefined,
    target: "add" | "edit"
  ) => {
    if (!file) return;
    try {
      const dataUrl = await readCategoryImageFile(file);
      if (target === "add") {
        setCategoryForm((f) => ({ ...f, imageUrl: dataUrl }));
      } else {
        setEditForm((f) => ({ ...f, imageUrl: dataUrl }));
      }
      setCategoryError("");
    } catch (err: any) {
      setCategoryError(err?.message || "تعذر رفع الصورة");
    }
  };

  const handleCreateCategory = () => {
    const nameAr = categoryForm.nameAr.trim();
    const name = categoryForm.name.trim() || nameAr;
    if (!nameAr) {
      setCategoryError("الاسم العربي مطلوب");
      return;
    }
    setCategoryError("");
    createCategory(
      {
        data: {
          name,
          nameAr,
          nameKu: "",
          imageUrl: categoryForm.imageUrl || null,
          sortOrder: (categories?.length ?? 0) + 1,
        },
      },
      {
        onSuccess: async () => {
          await refetchCategories();
          setCategoryForm(EMPTY_CATEGORY_FORM);
          setShowAddCategory(false);
        },
        onError: (err: any) =>
          setCategoryError(err?.data?.error || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const handleSaveEditCategory = (cat: MenuCategory) => {
    const nameAr = editForm.nameAr.trim();
    const name = editForm.name.trim() || nameAr;
    if (!nameAr) {
      setCategoryError("الاسم العربي مطلوب");
      return;
    }
    setCategoryError("");
    updateCategory(
      {
        id: cat.id,
        data: {
          name,
          nameAr,
          nameKu: cat.nameKu ?? "",
          icon: cat.icon ?? undefined,
          imageUrl: editForm.imageUrl || null,
          sortOrder: cat.sortOrder ?? undefined,
        },
      },
      {
        onSuccess: async () => {
          await refetchCategories();
          await refetch();
          cancelEditCategory();
        },
        onError: (err: any) =>
          setCategoryError(err?.data?.error || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const handleDeleteCategory = (cat: MenuCategory) => {
    if (!confirm(`حذف التصنيف «${cat.nameAr}»؟`)) return;
    deleteCategory(
      { id: cat.id },
      {
        onSuccess: async () => {
          await refetchCategories();
          await refetch();
          if (editingCategoryId === cat.id) cancelEditCategory();
        },
      }
    );
  };

  const columns = [
    {
      key: "imageUrl",
      header: "الصورة",
      render: (item: MenuItem) => (
        <CategoryImageThumb src={item.imageUrl} alt={item.nameAr} className="w-11 h-11" />
      ),
    },
    { key: "nameAr", header: "الاسم (عربي)" },
    { key: "name", header: "الاسم (إنجليزي)" },
    {
      key: "price",
      header: "السعر",
      render: (item: MenuItem) => (
        <span className="text-primary font-display font-bold">
          {new Intl.NumberFormat("en-IQ").format(item.price)} د.ع
        </span>
      ),
    },
    {
      key: "categoryId",
      header: "التصنيف",
      render: (item: MenuItem) => categories?.find((c) => c.id === item.categoryId)?.nameAr,
    },
    {
      key: "branchIds",
      header: "الفروع",
      render: (item: MenuItem) => {
        if (item.allBranches !== false || !(item.branchIds?.length)) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/25">
              جميع الفروع
            </span>
          );
        }
        const names = item.branchIds
          .map((id) => branches?.find((b) => b.id === id)?.name)
          .filter(Boolean);
        return (
          <span className="text-xs font-semibold text-foreground">
            {names.length ? names.join(" · ") : `${item.branchIds.length} فرع`}
          </span>
        );
      },
    },
    {
      key: "isAvailable",
      header: "إخفاء",
      render: (item: MenuItem) => {
        const hidden = !item.isAvailable;
        return (
          <button
            type="button"
            onClick={() => toggleItemFlag(item, { isAvailable: hidden })}
            className={`inline-flex items-center gap-2 min-h-11 px-3.5 py-2 rounded-full text-[15px] font-bold border transition-colors touch-manipulation ${
              hidden
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-success/15 text-success border-success/30 hover:bg-success/25"
            }`}
            title={hidden ? "إظهار في نقطة البيع" : "إخفاء من نقطة البيع"}
          >
            {hidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            {hidden ? "مخفي" : "ظاهر"}
          </button>
        );
      },
    },
    {
      key: "isFavorite",
      header: "مفضلة",
      render: (item: MenuItem) => {
        const fav = item.isFavorite === true;
        return (
          <button
            type="button"
            onClick={() => toggleItemFlag(item, { isFavorite: !fav })}
            className={`inline-flex items-center gap-2 min-h-11 px-3.5 py-2 rounded-full text-[15px] font-bold border transition-colors touch-manipulation ${
              fav
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/35"
                : "bg-secondary/60 text-muted-foreground border-border/60 hover:border-amber-500/35 hover:text-amber-600"
            }`}
            title={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          >
            <Star className={`w-5 h-5 ${fav ? "fill-current" : ""}`} />
            {fav ? "مفضل" : "عادي"}
          </button>
        );
      },
    },
  ];

  return (
    <>
      <CrudTable<MenuItem>
        title="إدارة الأصناف"
        titleEn="Items Management"
        data={filteredItems}
        columns={columns}
        isLoading={isLoading}
        onAdd={() => handleOpen()}
        onEdit={handleOpen}
        onDelete={(item) => {
          if (confirm("هل أنت متأكد من الحذف؟")) {
            remove({ id: item.id }, { onSuccess: () => refetch() });
          }
        }}
        headerActions={
          <Button
            type="button"
            variant="outline"
            onClick={openCategoryManager}
            className="rounded-full h-12 px-5 text-[16px] font-bold flex-shrink-0 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary touch-manipulation"
          >
            <Tags className="w-5 h-5 me-1.5" />
            التصنيفات
          </Button>
        }
        toolbar={
          <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap gap-3">
            <div className="min-w-0 w-full sm:w-[calc(50%-0.25rem)] xl:w-auto xl:flex-[1.4]">
              <ModernCombobox
                value={filterItemId}
                onChange={setFilterItemId}
                options={filterItemOptions}
                label="بحث حسب الصنف"
                placeholder="ابحث واختر صنفاً"
                icon={Package}
                searchable
                searchPlaceholder="اكتب للبحث عن صنف..."
                emptyText="لا يوجد صنف مطابق"
                labelClassName="text-[16px] font-bold text-foreground"
                valueClassName="text-[16px] font-bold"
                className="w-full min-w-0"
              />
            </div>
            <div className="min-w-0 w-full sm:w-[calc(50%-0.25rem)] xl:w-auto xl:flex-1">
              <ModernCombobox
                value={filterCategoryId}
                onChange={setFilterCategoryId}
                options={filterCategoryOptions}
                label="حسب التصنيف"
                placeholder="كل التصنيفات"
                icon={Tags}
                searchable
                labelClassName="text-[16px] font-bold text-foreground"
                valueClassName="text-[16px] font-bold"
                className="w-full min-w-0"
              />
            </div>
            <div className="min-w-0 w-full sm:w-[calc(50%-0.25rem)] xl:w-auto xl:flex-1">
              <ModernCombobox
                value={filterBranchId}
                onChange={setFilterBranchId}
                options={filterBranchOptions}
                label="حسب الفرع"
                placeholder="كل الفروع"
                icon={Building2}
                searchable
                labelClassName="text-[16px] font-bold text-foreground"
                valueClassName="text-[16px] font-bold"
                className="w-full min-w-0"
              />
            </div>
            <div className="min-w-0 w-full sm:w-[calc(50%-0.25rem)] xl:w-auto xl:flex-1">
              <ModernCombobox
                value={filterVisibility}
                onChange={(v) =>
                  setFilterVisibility((v as "all" | "visible" | "hidden") || "all")
                }
                options={filterVisibilityOptions}
                label="حسب الإخفاء"
                placeholder="الكل"
                icon={Eye}
                searchable={false}
                labelClassName="text-[16px] font-bold text-foreground"
                valueClassName="text-[16px] font-bold"
                className="w-full min-w-0"
              />
            </div>
            <div className="min-w-0 w-full sm:w-[calc(50%-0.25rem)] xl:w-auto xl:flex-1">
              <ModernCombobox
                value={filterFavorite}
                onChange={(v) =>
                  setFilterFavorite((v as "all" | "favorite" | "normal") || "all")
                }
                options={filterFavoriteOptions}
                label="حسب المفضلة"
                placeholder="الكل"
                icon={Star}
                searchable={false}
                labelClassName="text-[16px] font-bold text-foreground"
                valueClassName="text-[16px] font-bold"
                className="w-full min-w-0"
              />
            </div>
          </div>
        }
      />

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={editing ? "تعديل صنف" : "إضافة صنف"}
        maxWidth="max-w-5xl"
      >
        <div className="space-y-5 touch-manipulation">
          <input
            ref={itemImageInputRef}
            type="file"
            accept={CATEGORY_IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void pickItemImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-amber-500/5 to-transparent p-3 sm:p-4">
            <div className="flex flex-col md:flex-row md:items-stretch gap-3 sm:gap-4">
              <div className="flex flex-col gap-2 flex-shrink-0 md:w-[10.5rem]">
                <button
                  type="button"
                  onClick={() => itemImageInputRef.current?.click()}
                  className="relative group w-full h-40 md:h-full min-h-[10.5rem] rounded-2xl border-2 border-dashed border-primary/35 bg-background/70 hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99] transition-colors overflow-hidden touch-manipulation"
                  title="رفع صورة الصنف"
                >
                  {formData.imageUrl ? (
                    <>
                      <img
                        src={formData.imageUrl}
                        alt="معاينة الصنف"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[16px] font-bold py-2 text-center">
                        تغيير الصورة
                      </span>
                    </>
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-primary px-3 text-center">
                      <ImagePlus className="w-9 h-9" />
                      <span className="text-[16px] font-bold">رسم الصنف</span>
                      <span className="text-[13px] text-muted-foreground font-semibold">
                        PNG / JPG / WEBP / GIF
                      </span>
                    </span>
                  )}
                </button>
                {formData.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, imageUrl: "" }))}
                    className="text-[16px] font-bold text-destructive hover:underline min-h-11 touch-manipulation"
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                      الاسم (عربي) *
                    </label>
                    <Input
                      value={formData.nameAr}
                      onChange={(e) => setFormData((f) => ({ ...f, nameAr: e.target.value }))}
                      placeholder="مثال: برجر لحم"
                      className="h-12 text-[16px] font-bold"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                      الاسم (إنجليزي) *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Beef Burger"
                      className="h-12 text-[16px] font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                      السعر بوحدة الصغرى ({LOCKED_MINOR_UNIT}) — د.ع
                    </label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          price: e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      placeholder="فارغ = صفر"
                      className="h-12 text-[16px] font-bold placeholder:text-muted-foreground/35 placeholder:font-normal"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <ModernCombobox
                      value={formData.categoryId ? String(formData.categoryId) : ""}
                      onChange={(v) =>
                        setFormData((f) => ({ ...f, categoryId: Number(v) || 0 }))
                      }
                      options={categoryOptions}
                      label="التصنيف *"
                      placeholder="اختر التصنيف..."
                      searchPlaceholder="بحث عن تصنيف..."
                      emptyText="لا توجد تصنيفات"
                      icon={Tags}
                      searchable
                      labelClassName="text-[16px] font-bold text-foreground"
                      valueClassName="text-[16px] font-bold"
                    />
                  </div>
                </div>

                <div>
                  <ModernCombobox
                    value={formData.costMode}
                    onChange={(v) =>
                      setFormData((f) => ({
                        ...f,
                        costMode: v === "with" ? "with" : "none",
                        cost: v === "with" ? f.cost : 0,
                        majorUnit: v === "with" ? f.majorUnit : "",
                        subunitQty: v === "with" ? Math.max(1, f.subunitQty) : 1,
                      }))
                    }
                    options={costModeOptions}
                    label="التكلفة"
                    placeholder="بدون تكلفة"
                    icon={BadgeDollarSign}
                    searchable={false}
                    labelClassName="text-[16px] font-bold text-foreground"
                    valueClassName="text-[16px] font-bold"
                  />
                </div>

                {formData.costMode === "with" ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[16px] font-bold text-amber-800 dark:text-amber-200">
                        تفاصيل الوحدات والتكلفة
                      </p>
                      <button
                        type="button"
                        onClick={openAddUnitDialog}
                        className="inline-flex items-center gap-1.5 h-12 px-4 rounded-xl border border-primary/35 bg-primary/10 text-primary text-[16px] font-bold hover:bg-primary/15 touch-manipulation"
                      >
                        <Plus className="w-5 h-5" />
                        إضافة وحدات
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <ModernCombobox
                        value={formData.majorUnit}
                        onChange={(v) =>
                          setFormData((f) => ({
                            ...f,
                            majorUnit: v,
                            subunitQty:
                              v.trim() === LOCKED_MINOR_UNIT
                                ? 1
                                : Math.max(1, f.subunitQty),
                          }))
                        }
                        options={majorUnitOptions}
                        label="الوحدة الكبرى *"
                        placeholder="اختر الوحدة الكبرى..."
                        searchPlaceholder="بحث عن وحدة..."
                        emptyText="لا توجد وحدات — أضف وحدة أولاً"
                        icon={Package}
                        searchable
                        labelClassName="text-[16px] font-bold text-foreground"
                        valueClassName="text-[16px] font-bold"
                      />
                      <div>
                        <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                          الوحدة الصغرى
                        </label>
                        <div className="h-12 rounded-xl border border-border/70 bg-secondary/50 px-3 flex items-center justify-between gap-2">
                          <span className="font-bold text-[16px]">{LOCKED_MINOR_UNIT}</span>
                          <span className="inline-flex items-center gap-1 text-[13px] font-bold text-muted-foreground">
                            <Lock className="w-4 h-4" />
                            ثابت
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                          عدد كمية فرعية *
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={isSameUnit ? 1 : formData.subunitQty}
                            disabled={isSameUnit}
                            readOnly={isSameUnit}
                            onChange={(e) => {
                              if (isSameUnit) return;
                              setFormData((f) => ({
                                ...f,
                                subunitQty: Math.max(
                                  1,
                                  Math.floor(Number(e.target.value) || 1)
                                ),
                              }));
                            }}
                            className={`h-12 text-[16px] font-bold ${
                              isSameUnit
                                ? "bg-secondary/60 text-muted-foreground cursor-not-allowed pe-10"
                                : ""
                            }`}
                            dir="ltr"
                          />
                          {isSameUnit ? (
                            <Lock className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          ) : null}
                        </div>
                        <p className="text-[13px] text-muted-foreground mt-1 font-semibold">
                          {isSameUnit
                            ? "الوحدة الكبرى = الصغرى، لذلك الكمية الفرعية ثابتة على 1"
                            : `كم «${LOCKED_MINOR_UNIT}» داخل الوحدة الكبرى${
                                formData.majorUnit ? ` (${formData.majorUnit})` : ""
                              }`}
                        </p>
                      </div>
                      <div>
                        <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                          تكلفة بوحدة الصغرى ({LOCKED_MINOR_UNIT}) — د.ع *
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={formData.cost}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              cost: Number(e.target.value),
                            }))
                          }
                          className="h-12 text-[16px] font-bold"
                          dir="ltr"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {formData.majorUnit && Number(formData.subunitQty) > 0 ? (
                      <p className="text-[16px] font-bold text-muted-foreground">
                        1 {formData.majorUnit} = {formData.subunitQty} {LOCKED_MINOR_UNIT}
                        {Number(formData.cost) > 0
                          ? ` · تكلفة الكبرى ≈ ${new Intl.NumberFormat("en-IQ").format(
                              Number(formData.cost) * Number(formData.subunitQty)
                            )} د.ع`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 px-3 py-3 text-[16px] text-muted-foreground font-bold">
                    لن تُحفظ تكلفة أو وحدات لهذا الصنف
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((f) => ({ ...f, isAvailable: !f.isAvailable }))
                    }
                    className={`inline-flex items-center gap-2 min-h-12 px-4 rounded-xl border-2 text-[16px] font-bold transition-colors touch-manipulation active:scale-[0.98] ${
                      formData.isAvailable
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {formData.isAvailable ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <EyeOff className="w-5 h-5" />
                    )}
                    {formData.isAvailable ? "ظاهر في البيع" : "مخفي من البيع"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((f) => ({ ...f, isFavorite: !f.isFavorite }))
                    }
                    className={`inline-flex items-center gap-2 min-h-12 px-4 rounded-xl border-2 text-[16px] font-bold transition-colors touch-manipulation active:scale-[0.98] ${
                      formData.isFavorite
                        ? "border-amber-500/45 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "border-border/70 bg-background/60 text-muted-foreground"
                    }`}
                  >
                    <Star
                      className={`w-5 h-5 ${formData.isFavorite ? "fill-current" : ""}`}
                    />
                    {formData.isFavorite ? "مفضل" : "إضافة للمفضلة"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[16px] font-bold mb-2 block flex items-center gap-1.5">
              <Building2 className="w-5 h-5 text-primary" />
              الفروع <span className="text-destructive">*</span>
            </label>
            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={selectAllBranches}
                  className={`sm:w-auto min-h-12 px-5 rounded-xl border-2 text-[16px] font-bold transition-all flex items-center justify-center gap-2 touch-manipulation active:scale-[0.98] ${
                    formData.allBranches
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "border-border bg-background/60 text-foreground hover:border-primary/40"
                  }`}
                >
                  <Check className={`w-5 h-5 ${formData.allBranches ? "opacity-100" : "opacity-30"}`} />
                  جميع الفروع
                </button>
                {(branches?.length ?? 0) > 0 && (
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {branches!.map((b) => {
                      const selected = !formData.allBranches && formData.branchIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBranch(b.id)}
                          className={`min-h-12 px-3 rounded-xl border-2 text-[16px] font-bold transition-all flex items-center gap-2 text-start touch-manipulation active:scale-[0.98] ${
                            selected
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-background/50 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {selected && <Check className="w-4 h-4" />}
                          </span>
                          <span className="truncate">{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {(branches?.length ?? 0) === 0 ? (
                <p className="text-[16px] font-bold text-muted-foreground text-center py-1">
                  لا توجد فروع مسجّلة — سيتم اعتبار الصنف لكل الفروع
                </p>
              ) : (
                <p className="text-[13px] font-semibold text-muted-foreground">
                  اختر «جميع الفروع» أو حدد فرعاً واحداً أو أكثر
                </p>
              )}
            </div>
          </div>

          {formError && (
            <p className="text-[16px] font-bold text-destructive">{formError}</p>
          )}

          <div className="pt-1 flex justify-end gap-3">
            <Button
              variant="ghost"
              className="h-12 px-5 text-[16px] font-bold touch-manipulation"
              onClick={() => setIsOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              className="h-12 px-6 text-[16px] font-bold touch-manipulation"
              onClick={handleSubmit}
            >
              {editing ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isCategoryOpen}
        onClose={() => setIsCategoryOpen(false)}
        title="إدارة التصنيفات"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-amber-500 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25 flex-shrink-0">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-foreground">قائمة التصنيفات</p>
                <p className="text-[14px] font-bold text-muted-foreground">
                  {categories?.length ?? 0} تصنيف — صورة PNG / JPG / WEBP / GIF
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                setShowAddCategory((v) => !v);
                setEditingCategoryId(null);
                setCategoryForm(EMPTY_CATEGORY_FORM);
                setCategoryError("");
              }}
              className="rounded-full h-12 px-5 text-[16px] font-bold flex-shrink-0 touch-manipulation"
            >
              {showAddCategory ? (
                <>
                  <X className="w-4 h-4 me-1" />
                  إغلاق
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 me-1" />
                  إضافة
                </>
              )}
            </Button>
          </div>

          {showAddCategory && (
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-l from-primary/10 via-amber-500/5 to-transparent p-3 sm:p-4">
              <input
                ref={addImageInputRef}
                type="file"
                accept={CATEGORY_IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  void pickCategoryImage(e.target.files?.[0], "add");
                  e.target.value = "";
                }}
              />
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <button
                  type="button"
                  onClick={() => addImageInputRef.current?.click()}
                  className="relative group w-full lg:w-[7.5rem] h-[4.5rem] lg:h-[3.25rem] rounded-2xl border-2 border-dashed border-primary/35 bg-background/60 hover:border-primary/60 hover:bg-primary/5 transition-colors overflow-hidden flex-shrink-0"
                  title="رفع صورة التصنيف"
                >
                  {categoryForm.imageUrl ? (
                    <img
                      src={categoryForm.imageUrl}
                      alt="معاينة"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-primary">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px] font-bold">صورة</span>
                    </span>
                  )}
                </button>

                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                      الاسم (عربي) *
                    </label>
                    <Input
                      placeholder="مثال: مشروبات"
                      value={categoryForm.nameAr}
                      onChange={(e) =>
                        setCategoryForm((f) => ({ ...f, nameAr: e.target.value }))
                      }
                      className="h-12 text-[16px] font-bold"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[16px] font-bold mb-1.5 block text-foreground">
                      الاسم (إنجليزي)
                    </label>
                    <Input
                      placeholder="e.g. Drinks"
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="h-12 text-[16px] font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {categoryForm.imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-12 text-[16px] font-bold touch-manipulation"
                      onClick={() => setCategoryForm((f) => ({ ...f, imageUrl: "" }))}
                    >
                      إزالة الصورة
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="h-12 px-5 text-[16px] font-bold touch-manipulation"
                    isLoading={isCreatingCategory}
                    onClick={handleCreateCategory}
                  >
                    <Plus className="w-4 h-4 me-1" />
                    حفظ
                  </Button>
                </div>
              </div>
              {categoryError && !editingCategoryId && (
                <p className="text-xs font-semibold text-destructive mt-2">{categoryError}</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border/60 overflow-hidden bg-secondary/20 max-h-[22rem] overflow-y-auto">
            {!categories?.length ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                لا توجد تصنيفات بعد — اضغط إضافة لإنشاء أول تصنيف
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {categories.map((cat) => {
                  const isEditing = editingCategoryId === cat.id;
                  return (
                    <li key={cat.id} className="p-3 sm:p-3.5 hover:bg-secondary/40 transition-colors">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            ref={editImageInputRef}
                            type="file"
                            accept={CATEGORY_IMAGE_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                              void pickCategoryImage(e.target.files?.[0], "edit");
                              e.target.value = "";
                            }}
                          />
                          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => editImageInputRef.current?.click()}
                              className="relative w-full lg:w-14 h-14 rounded-xl border border-border/60 overflow-hidden flex-shrink-0 bg-background/70"
                              title="تغيير الصورة"
                            >
                              {editForm.imageUrl ? (
                                <img
                                  src={editForm.imageUrl}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-primary">
                                  <ImagePlus className="w-5 h-5" />
                                </span>
                              )}
                            </button>
                            <Input
                              value={editForm.nameAr}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, nameAr: e.target.value }))
                              }
                              placeholder="الاسم العربي"
                              className="h-12 text-[16px] font-bold flex-1"
                              autoFocus
                            />
                            <Input
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, name: e.target.value }))
                              }
                              placeholder="English name"
                              className="h-12 text-[16px] font-bold flex-1"
                            />
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-12 text-[16px] font-bold touch-manipulation"
                                onClick={cancelEditCategory}
                              >
                                <X className="w-5 h-5 me-1" />
                                إلغاء
                              </Button>
                              <Button
                                type="button"
                                className="h-12 text-[16px] font-bold touch-manipulation"
                                isLoading={isUpdatingCategory}
                                onClick={() => handleSaveEditCategory(cat)}
                              >
                                <Check className="w-5 h-5 me-1" />
                                حفظ
                              </Button>
                            </div>
                          </div>
                          {categoryError && editingCategoryId === cat.id && (
                            <p className="text-[14px] font-bold text-destructive">{categoryError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 min-h-14">
                          <CategoryImageThumb src={cat.imageUrl} alt={cat.nameAr} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[16px] font-bold text-foreground truncate">{cat.nameAr}</p>
                            {cat.name && (
                              <p className="text-[14px] text-muted-foreground truncate font-display">
                                {cat.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-12 w-12 text-muted-foreground hover:text-primary touch-manipulation"
                              onClick={() => startEditCategory(cat)}
                              aria-label="تعديل التصنيف"
                            >
                              <Pencil className="w-5 h-5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-12 w-12 text-muted-foreground hover:text-destructive touch-manipulation"
                              disabled={isDeletingCategory}
                              onClick={() => handleDeleteCategory(cat)}
                              aria-label="حذف التصنيف"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setIsCategoryOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isUnitDialogOpen}
        onClose={() => !isCreatingUnit && setIsUnitDialogOpen(false)}
        title="إضافة وحدة"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-[16px] font-bold text-foreground mb-1.5 block">
              اسم الوحدة (عربي) *
            </label>
            <Input
              value={newUnitNameAr}
              onChange={(e) => setNewUnitNameAr(e.target.value)}
              placeholder="مثال: كرتون"
              className="h-12 text-[16px] font-bold"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[16px] font-bold text-foreground mb-1.5 block">
              الاسم (إنجليزي)
            </label>
            <Input
              value={newUnitNameEn}
              onChange={(e) => setNewUnitNameEn(e.target.value)}
              placeholder="e.g. Carton"
              className="h-12 text-[16px] font-bold"
            />
          </div>
          {unitError ? (
            <p className="text-[14px] font-bold text-destructive">{unitError}</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-12 text-[16px] font-bold touch-manipulation"
              onClick={() => setIsUnitDialogOpen(false)}
              disabled={isCreatingUnit}
            >
              إلغاء
            </Button>
            <Button
              className="flex-1 h-12 text-[16px] font-bold gap-1.5 touch-manipulation"
              onClick={handleCreateUnit}
              isLoading={isCreatingUnit}
            >
              <Plus className="w-5 h-5" />
              حفظ الوحدة
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
