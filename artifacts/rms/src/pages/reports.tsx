import React from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card } from "@/components/ui-elements";

export default function Reports() {
  return (
    <div className="space-y-6 text-foreground">
      <div>
        <h2 className="text-2xl font-bold">التقارير التحليلية</h2>
        <p className="text-xs text-primary font-display tracking-widest uppercase">Analytics & Reports</p>
      </div>

      <Card className="p-12 text-center flex flex-col items-center justify-center h-[60vh]">
        <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl text-primary">📊</span>
        </div>
        <h3 className="text-2xl font-bold mb-2">تقارير مفصلة قريباً</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          جاري تجهيز لوحة التقارير التحليلية الشاملة. ستتضمن رسوماً بيانية للمبيعات، تتبع أفضل المنتجات، وتحليل الأداء العام للمطعم.
        </p>
      </Card>
    </div>
  );
}
