import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Card, Dialog } from "./ui-elements";
import { Plus, Search, Edit, Trash2 } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface CrudTableProps<T> {
  title: string;
  titleEn: string;
  data: T[] | undefined;
  columns: Column<T>[];
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  searchKey?: keyof T;
  isLoading?: boolean;
}

export function CrudTable<T extends { id: number }>({ title, titleEn, data, columns, onAdd, onEdit, onDelete, searchKey, isLoading }: CrudTableProps<T>) {
  const [search, setSearch] = useState("");

  const filteredData = React.useMemo(() => {
    if (!data) return [];
    if (!search || !searchKey) return data;
    return data.filter((item) => {
      const val = item[searchKey];
      return String(val).toLowerCase().includes(search.toLowerCase());
    });
  }, [data, search, searchKey]);

  return (
    <Card className="flex flex-col h-full border border-white/5">
      <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-xs text-primary font-display tracking-widest uppercase">{titleEn}</p>
        </div>
        <div className="flex items-center gap-3">
          {searchKey && (
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="بحث..." 
                className="pr-10 h-10 rounded-full bg-secondary/50 border-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {onAdd && (
            <Button onClick={onAdd} className="rounded-full h-10">
              <Plus className="w-4 h-4 me-2" /> إضافة جديد
            </Button>
          )}
        </div>
      </div>

      <div className="p-0 overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              {columns.map((col, idx) => (
                <TableHead key={String(col.key) + idx} className="text-primary font-bold">
                  {col.header}
                </TableHead>
              ))}
              {(onEdit || onDelete) && <TableHead className="text-end text-primary font-bold">الإجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-10">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-10 text-muted-foreground">
                  لا توجد بيانات للعرض
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id} className="border-border/20 group">
                  {columns.map((col, idx) => (
                    <TableCell key={String(col.key) + idx} className="font-medium">
                      {col.render ? col.render(item) : String(item[col.key as keyof T] || '')}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => onEdit(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(item)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
