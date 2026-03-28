import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMenuItems, useGetMenuCategories, useCreateOrder } from "@workspace/api-client-react";
import { Button, Card, Input, Badge, Dialog } from "@/components/ui-elements";
import { ShoppingCart, Search, Trash2, Plus, Minus, CreditCard, Banknote, MapPin, ChefHat } from "lucide-react";
import type { MenuItem, OrderType } from "@workspace/api-client-react/src/generated/api.schemas";

interface CartItem extends MenuItem {
  cartQuantity: number;
}

export default function POS() {
  const { data: categories } = useGetMenuCategories();
  const { data: items } = useGetMenuItems({ available: true });
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();

  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const formatIQD = (val: number) => new Intl.NumberFormat('en-IQ').format(val);

  const filteredItems = items?.filter(item => 
    (!activeCategory || item.categoryId === activeCategory) &&
    (item.name.includes(search) || item.nameAr.includes(search))
  );

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
      return [...prev, { ...item, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQ = i.cartQuantity + delta;
        return newQ > 0 ? { ...i, cartQuantity: newQ } : i;
      }
      return i;
    }).filter(i => i.cartQuantity > 0));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
  const total = subtotal; // add tax/discount here if needed

  const handleCheckout = (paymentMethod: "cash" | "card") => {
    createOrder({
      data: {
        type: orderType,
        items: cart.map(i => ({ menuItemId: i.id, quantity: i.cartQuantity })),
      }
    }, {
      onSuccess: () => {
        setCart([]);
        setIsCheckoutOpen(false);
      }
    });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Right Side: Menu (RTL so this is visually on the right) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="bg" className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" />
        
        <header className="p-6 relative z-10 flex justify-between items-center bg-card/50 backdrop-blur-md border-b border-border/50">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => window.history.back()}><ChefHat/></Button>
            <div>
              <h1 className="text-2xl font-bold">نقطة البيع</h1>
              <p className="text-sm text-primary font-display tracking-widest uppercase">POS System</p>
            </div>
          </div>
          <div className="relative w-72">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="ابحث عن صنف..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="pr-12 bg-background/80 border-white/10"
            />
          </div>
        </header>

        {/* Categories */}
        <div className="px-6 py-4 flex gap-3 overflow-x-auto relative z-10 hide-scrollbar">
          <Button 
            variant={activeCategory === null ? "default" : "secondary"} 
            onClick={() => setActiveCategory(null)}
            className="rounded-full px-6"
          >
            الكل / All
          </Button>
          {categories?.map(cat => (
            <Button 
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "secondary"} 
              onClick={() => setActiveCategory(cat.id)}
              className="rounded-full px-6 whitespace-nowrap"
            >
              {cat.nameAr}
            </Button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredItems?.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => addToCart(item)}
                  className="bg-card/80 backdrop-blur-sm border border-white/5 rounded-2xl p-4 cursor-pointer flex flex-col justify-between hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all"
                >
                  <div className="w-full aspect-square rounded-xl bg-secondary/50 mb-4 flex items-center justify-center overflow-hidden">
                    {/* Placeholder image if none */}
                    <div className="text-4xl">🍽️</div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight mb-1">{item.nameAr}</h3>
                    <p className="text-xs text-muted-foreground font-display mb-3">{item.name}</p>
                    <div className="text-primary font-bold font-display text-lg">
                      {formatIQD(item.price)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Left Side: Cart (Visually Left in RTL) */}
      <div className="w-96 glass-panel border-r border-white/10 flex flex-col z-20 shadow-2xl relative">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 me-2 text-primary" />
            الطلب الحالي
          </h2>
          
          <div className="flex bg-secondary p-1 rounded-xl mt-6">
            {(['dine_in', 'takeaway', 'delivery'] as const).map(type => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${orderType === type ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {type === 'dine_in' ? 'طاولة' : type === 'takeaway' ? 'سفري' : 'توصيل'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence>
            {cart.map(item => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-secondary/50 border border-white/5 rounded-xl p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm">{item.nameAr}</p>
                    <p className="text-xs text-muted-foreground font-display">{formatIQD(item.price * item.cartQuantity)}</p>
                  </div>
                  <button onClick={() => updateQuantity(item.id, -item.cartQuantity)} className="text-destructive hover:bg-destructive/20 p-1 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-1">
                  <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-secondary rounded-md">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold font-display w-8 text-center">{item.cartQuantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-secondary rounded-md text-primary">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p>السلة فارغة</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-card border-t border-white/10 mt-auto">
          <div className="space-y-2 mb-6 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span className="font-display">{formatIQD(subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-xl text-foreground pt-2 border-t border-white/10">
              <span>الإجمالي</span>
              <span className="text-primary font-display">{formatIQD(total)} د.ع</span>
            </div>
          </div>
          
          <Button 
            className="w-full h-14 text-lg" 
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
          >
            دفع وإصدار الفاتورة
          </Button>
        </div>
      </div>

      <Dialog isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="طريقة الدفع">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleCheckout("cash")} isLoading={isCreating}>
            <Banknote className="w-8 h-8 text-green-500" />
            <span className="text-lg">كاش (نقدي)</span>
          </Button>
          <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleCheckout("card")} isLoading={isCreating}>
            <CreditCard className="w-8 h-8 text-blue-500" />
            <span className="text-lg">بطاقة مصرفية</span>
          </Button>
        </div>
        <div className="bg-secondary/50 p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground mb-1">المبلغ المطلوب</p>
          <p className="text-3xl font-bold text-primary font-display">{formatIQD(total)} د.ع</p>
        </div>
      </Dialog>
    </div>
  );
}
