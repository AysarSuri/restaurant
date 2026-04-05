import React from "react";
import { motion } from "framer-motion";
import { useGetDashboardStats, useGetOrders } from "@workspace/api-client-react";
import { Card, Badge } from "@/components/ui-elements";
import { TrendingUp, Users, ShoppingBag, DollarSign, AlertCircle, Utensils } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const mockChartData = [
  { name: '08:00', revenue: 40000 },
  { name: '10:00', revenue: 120000 },
  { name: '12:00', revenue: 350000 },
  { name: '14:00', revenue: 600000 },
  { name: '16:00', revenue: 450000 },
  { name: '18:00', revenue: 580000 },
  { name: '20:00', revenue: 950000 },
  { name: '22:00', revenue: 800000 },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: orders, isLoading: ordersLoading } = useGetOrders({ limit: 5 });

  const formatIQD = (val?: number) => val ? new Intl.NumberFormat('en-IQ').format(val) + " د.ع" : "0 د.ع";

  if (statsLoading || ordersLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const defaultStats = stats || {
    todayRevenue: 1250000, todayOrders: 84, activeOrders: 12, 
    availableTables: 8, totalTables: 20, lowStockItems: 3,
    revenueGrowth: 15.4
  };

  const statCards = [
    { label: "مبيعات اليوم", labelEn: "Today's Revenue", value: formatIQD(defaultStats.todayRevenue), icon: DollarSign, trend: `+${defaultStats.revenueGrowth}%` },
    { label: "طلبات اليوم", labelEn: "Today's Orders", value: defaultStats.todayOrders.toString(), icon: ShoppingBag, trend: "+5%" },
    { label: "الطلبات النشطة", labelEn: "Active Orders", value: defaultStats.activeOrders.toString(), icon: Utensils, highlight: true },
    { label: "تنبيهات المخزون", labelEn: "Low Stock", value: defaultStats.lowStockItems.toString(), icon: AlertCircle, destructive: defaultStats.lowStockItems > 0 },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="p-6 relative overflow-hidden group">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground/70 mb-2">{stat.labelEn}</p>
                  <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
                  {stat.trend && (
                    <div className="flex items-center mt-2 text-success text-sm font-medium">
                      <TrendingUp className="w-4 h-4 me-1" />
                      {stat.trend} من الأمس
                    </div>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.highlight ? 'bg-primary text-primary-foreground' : stat.destructive ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-primary'}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className={`absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-40 ${stat.highlight ? 'bg-primary' : stat.destructive ? 'bg-destructive' : 'bg-white'}`} />
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold">المبيعات (اليوم)</h3>
            <p className="text-sm text-muted-foreground">Today's Sales Trend</p>
          </div>
          <div className="h-52 md:h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [formatIQD(value), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Orders */}
        <Card className="p-6 flex flex-col">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">أحدث الطلبات</h3>
              <p className="text-sm text-muted-foreground">Recent Orders</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
            {(orders || []).slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between items-center p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    #{order.orderNumber.slice(-4)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{order.type === 'dine_in' ? `طاولة ${order.tableId}` : order.type === 'takeaway' ? 'سفري' : 'توصيل'}</p>
                    <p className="text-xs text-muted-foreground font-display">{new Date(order.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-primary font-display">{formatIQD(order.total)}</p>
                  <Badge variant={order.status === 'completed' ? 'success' : 'warning'} className="text-[10px] py-0 mt-1">
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
            {(!orders || orders.length === 0) && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-10">
                <ShoppingBag className="w-12 h-12 mb-2" />
                <p>لا توجد طلبات حديثة</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
