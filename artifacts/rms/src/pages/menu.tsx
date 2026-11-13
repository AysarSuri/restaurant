import React, { useState } from "react";
import { useGetMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useGetMenuCategories } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Dialog, Input, Button, Select } from "@/components/ui-elements";
import { MenuItem } from "@workspace/api-client-react";

export default function Menu() {
  const { data: items, isLoading, refetch } = useGetMenuItems();
  const { data: categories } = useGetMenuCategories();
  const { mutate: create } = useCreateMenuItem();
  const { mutate: update } = useUpdateMenuItem();
  const { mutate: remove } = useDeleteMenuItem();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({ nameAr: "", name: "", price: 0, categoryId: 0, isAvailable: true });

  const handleOpen = (item?: MenuItem) => {
    if (item) {
      setEditing(item);
      setFormData({ nameAr: item.nameAr, name: item.name, price: item.price, categoryId: item.categoryId, isAvailable: item.isAvailable });
    } else {
      setEditing(null);
      setFormData({ nameAr: "", name: "", price: 0, categoryId: categories?.[0]?.id || 0, isAvailable: true });
    }
    setIsOpen(true);
  };

  const handleSubmit = () => {
    const data = { ...formData, nameKu: "", description: "", descriptionAr: "" };
    if (editing) {
      update({ id: editing.id, data }, { onSuccess: () => { setIsOpen(false); refetch(); } });
    } else {
      create({ data }, { onSuccess: () => { setIsOpen(false); refetch(); } });
    }
  };

  const columns = [
    { key: "nameAr", header: "الاسم (عربي)" },
    { key: "name", header: "الاسم (إنجليزي)" },
    { key: "price", header: "السعر", render: (item: MenuItem) => <span className="text-primary font-display font-bold">{new Intl.NumberFormat('en-IQ').format(item.price)} د.ع</span> },
    { key: "categoryId", header: "التصنيف", render: (item: MenuItem) => categories?.find(c => c.id === item.categoryId)?.nameAr },
    { key: "isAvailable", header: "الحالة", render: (item: MenuItem) => (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.isAvailable ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
        {item.isAvailable ? "متاح" : "غير متاح"}
      </span>
    )}
  ];

  return (
    <>
      <CrudTable<MenuItem>
        title="إدارة المنيو" 
        titleEn="Menu Management" 
        data={items} 
        columns={columns} 
        isLoading={isLoading}
        searchKey="nameAr"
        onAdd={() => handleOpen()}
        onEdit={handleOpen}
        onDelete={(item) => {
          if (confirm("هل أنت متأكد من الحذف؟")) {
            remove({ id: item.id }, { onSuccess: () => refetch() });
          }
        }}
      />

      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? "تعديل صنف" : "إضافة صنف"}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">الاسم (عربي)</label>
            <Input value={formData.nameAr} onChange={e => setFormData(f => ({...f, nameAr: e.target.value}))} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">الاسم (إنجليزي)</label>
            <Input value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">السعر (د.ع)</label>
            <Input type="number" value={formData.price} onChange={e => setFormData(f => ({...f, price: Number(e.target.value)}))} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">التصنيف</label>
            <Select value={formData.categoryId} onChange={e => setFormData(f => ({...f, categoryId: Number(e.target.value)}))}>
              <option value={0} disabled>اختر تصنيف...</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
            </Select>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit}>{editing ? "حفظ التعديلات" : "إضافة"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
