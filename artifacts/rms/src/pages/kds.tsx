import React, { useEffect } from "react";
import { useGetOrders, useUpdateOrderStatus } from "@workspace/api-client-react";
import { Button, Badge } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, ChefHat, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function KDS() {
  const { data: orders, refetch } = useGetOrders({ status: "pending,preparing,ready" });
  const { mutate: updateStatus } = useUpdateOrderStatus();

  // Auto refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  const activeOrders = orders?.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)) || [];

  const handleNextStatus = (id: number, current: string) => {
    const nextMap: Record<string, "preparing" | "ready" | "served"> = {
      'pending': 'preparing',
      'preparing': 'ready',
      'ready': 'served'
    };
    const nextStatus = nextMap[current];
    if (nextStatus) {
      updateStatus({ id, data: { status: nextStatus } }, { onSuccess: () => refetch() });
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-secondary border-secondary';
      case 'preparing': return 'bg-amber-500/20 border-amber-500/50 text-amber-500';
      case 'ready': return 'bg-green-500/20 border-green-500/50 text-green-500';
      default: return 'bg-secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground p-4">
      <header className="flex justify-between items-center mb-6 glass-panel p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon" className="rounded-full"><ArrowLeft /></Button>
          </Link>
          <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200">شاشة المطبخ (KDS)</h1>
            <p className="text-muted-foreground font-display text-sm tracking-widest uppercase">Kitchen Display System</p>
          </div>
        </div>
        <div className="text-xl font-display font-bold px-6 py-2 bg-secondary rounded-xl border border-white/5">
          {new Date().toLocaleTimeString()}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-max">
        <AnimatePresence>
          {activeOrders.map(order => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex flex-col rounded-2xl border-2 overflow-hidden bg-card shadow-xl transition-colors duration-500 ${getStatusColor(order.status)}`}
            >
              <div className="p-4 border-b border-current/20 flex justify-between items-start bg-black/20">
                <div>
                  <h3 className="font-bold text-xl">#{order.orderNumber.slice(-4)}</h3>
                  <Badge variant="outline" className="mt-1 border-current text-current">{order.type === 'dine_in' ? `طاولة ${order.tableId}` : order.type === 'takeaway' ? 'سفري' : 'توصيل'}</Badge>
                </div>
                <div className="flex items-center gap-1 text-sm font-bold opacity-80 font-display">
                  <Clock className="w-4 h-4" />
                  {Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)}m
                </div>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto bg-card space-y-3">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-border/50 pb-2 last:border-0 text-foreground">
                    <span className="font-bold text-lg">{item.quantity}x</span>
                    <div className="flex-1 ms-3">
                      <p className="font-semibold text-base">{item.menuItem?.nameAr || 'عنصر'}</p>
                      {item.notes && <p className="text-xs text-amber-500 mt-1 bg-amber-500/10 p-1 rounded">ملاحظة: {item.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => handleNextStatus(order.id, order.status)}
                className="p-4 font-bold text-lg flex items-center justify-center gap-2 hover:brightness-125 transition-all bg-black/20"
              >
                {order.status === 'pending' ? 'بدء التحضير' : order.status === 'preparing' ? 'جاهز للتقديم' : 'تم التقديم'}
                <CheckCircle2 className="w-6 h-6" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {activeOrders.length === 0 && (
          <div className="col-span-full h-96 flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <ChefHat className="w-24 h-24 mb-4" />
            <h2 className="text-2xl font-bold">لا توجد طلبات نشطة</h2>
            <p>المطبخ خالي حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
