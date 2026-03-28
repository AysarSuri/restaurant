import React, { useState } from "react";
import { useGetTables, useUpdateTable } from "@workspace/api-client-react";
import { Card, Badge, Dialog, Button, Select } from "@/components/ui-elements";
import { Grid, Users, LayoutDashboard } from "lucide-react";
import { RestaurantTableStatus } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Tables() {
  const { data: tables, isLoading, refetch } = useGetTables();
  const { mutate: updateTable } = useUpdateTable();
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [status, setStatus] = useState<RestaurantTableStatus>("available");

  const getStatusColor = (s: string) => {
    switch(s) {
      case 'available': return 'bg-success/20 border-success/50 text-success';
      case 'occupied': return 'bg-destructive/20 border-destructive/50 text-destructive';
      case 'reserved': return 'bg-primary/20 border-primary/50 text-primary';
      case 'cleaning': return 'bg-info/20 border-info/50 text-info';
      default: return 'bg-secondary';
    }
  };

  const getStatusText = (s: string) => {
    switch(s) {
      case 'available': return 'متاح';
      case 'occupied': return 'مشغول';
      case 'reserved': return 'محجوز';
      case 'cleaning': return 'تنظيف';
      default: return s;
    }
  };

  const handleUpdateStatus = () => {
    if (selectedTable) {
      updateTable({ id: selectedTable.id, data: { status } }, { onSuccess: () => { setSelectedTable(null); refetch(); }});
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-foreground">الطاولات</h2>
          <p className="text-xs text-primary font-display tracking-widest uppercase">Table Management</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {tables?.map(table => (
          <button 
            key={table.id} 
            onClick={() => { setSelectedTable(table); setStatus(table.status); }}
            className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 ${getStatusColor(table.status)}`}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <Grid className="w-10 h-10 mb-2 opacity-80" />
            <span className="font-bold text-2xl font-display relative z-10">{table.number}</span>
            <div className="flex items-center text-xs opacity-80 mt-1 relative z-10">
              <Users className="w-3 h-3 me-1" /> {table.capacity}
            </div>
            <span className="absolute bottom-2 font-bold text-xs">{getStatusText(table.status)}</span>
          </button>
        ))}
      </div>

      <Dialog isOpen={!!selectedTable} onClose={() => setSelectedTable(null)} title={`تحديث حالة طاولة ${selectedTable?.number}`}>
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold mb-2 block">الحالة الجديدة</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as RestaurantTableStatus)}>
              <option value="available">متاح</option>
              <option value="occupied">مشغول</option>
              <option value="reserved">محجوز</option>
              <option value="cleaning">تنظيف</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSelectedTable(null)}>إلغاء</Button>
            <Button onClick={handleUpdateStatus}>حفظ</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
