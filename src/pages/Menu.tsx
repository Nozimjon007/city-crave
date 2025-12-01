import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, LogOut, Plus, Minus, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  photo_url: string | null;
  category_id: string;
  available: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const Menu = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userType, setUserType] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", session.user.id)
      .single();

    if (profile?.user_type === "staff") {
      navigate("/staff");
      return;
    }

    setUserType(profile?.user_type || "");
  };

  const fetchData = async () => {
    try {
      const [menuRes, categoriesRes, branchesRes] = await Promise.all([
        supabase.from("menu").select("*").eq("available", true),
        supabase.from("menu_categories").select("*"),
        supabase.from("branches").select("*"),
      ]);

      if (menuRes.data) setMenuItems(menuRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (branchesRes.data) {
        setBranches(branchesRes.data);
        if (branchesRes.data.length > 0) {
          setSelectedBranch(branchesRes.data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast({ title: "Added to cart", description: item.name });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleCheckout = () => {
    if (!selectedBranch) {
      toast({ variant: "destructive", title: "Please select a branch" });
      return;
    }
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Cart is empty" });
      return;
    }
    navigate("/checkout", { state: { cart, branchId: selectedBranch } });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-warm text-white shadow-soft sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tasty Bites</h1>
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={handleCheckout} className="relative">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Cart ({cartCount})
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                  {cartCount}
                </span>
              )}
            </Button>
            <Button variant="secondary" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Label className="text-lg font-semibold mb-2 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Branch
          </Label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name} - {branch.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue={categories[0]?.id || ""} className="w-full">
          <TabsList className="mb-8 flex-wrap h-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems
                  .filter((item) => item.category_id === category.id)
                  .map((item) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-soft transition-shadow">
                      {item.photo_url && (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle>{item.name}</CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </CardHeader>
                      <CardFooter className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          ${item.price.toFixed(2)}
                        </span>
                        {cart.find((i) => i.id === item.id) ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-semibold w-8 text-center">
                              {cart.find((i) => i.id === item.id)?.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => addToCart(item)}>Add to Cart</Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-soft p-4">
            <div className="container mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">${cartTotal.toFixed(2)}</p>
              </div>
              <Button onClick={handleCheckout} size="lg" className="bg-gradient-warm">
                Checkout ({cartCount} items)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Menu;