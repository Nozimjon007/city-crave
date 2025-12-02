import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Order {
  id: string;
  order_type: string;
  status: string;
  total: number;
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  profiles: {
    name: string;
    phone: string;
  };
  ordered_items: Array<{
    quantity: number;
    price_each: number;
    menu: {
      name: string;
    };
  }>;
}

const Staff = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStaffAuth();
  }, []);

  useEffect(() => {
    if (branchId) {
      fetchOrders();
      
      const channel = supabase
        .channel("staff-orders-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [branchId]);

  const checkStaffAuth = async () => {
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

    if (profile?.user_type !== "staff") {
      navigate("/menu");
      return;
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("branch_id")
      .eq("user_id", session.user.id)
      .single();

    if (staff?.branch_id) {
      setBranchId(staff.branch_id);
    } else {
      toast({
        variant: "destructive",
        title: "No Branch Assigned",
        description: "Please contact an administrator to assign you to a branch.",
      });
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    if (!branchId) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          profiles(name, phone),
          ordered_items(
            quantity,
            price_each,
            menu(name)
          )
        `)
        .eq("branch_id", branchId)
        .neq("status", "delivered")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus as any })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Status updated",
        description: `Order status changed to ${newStatus.replace("_", " ")}`,
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      preparing: "bg-blue-500",
      ready: "bg-green-500",
      in_delivery: "bg-purple-500",
    };
    return colors[status] || "bg-muted";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-warm text-white shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Staff Dashboard</h1>
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => fetchOrders()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="secondary" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!branchId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                You are not assigned to any branch yet. Please contact an administrator.
              </p>
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No active orders</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-soft transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        #{order.id.slice(0, 8)}
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {format(new Date(order.created_at), "p")}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">
                        ${order.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {order.order_type.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="font-semibold">Customer: {order.profiles.name}</p>
                    {order.profiles.phone && (
                      <p className="text-sm text-muted-foreground">{order.profiles.phone}</p>
                    )}
                    {order.delivery_address && (
                      <p className="text-sm">
                        <span className="font-semibold">Deliver to:</span> {order.delivery_address}
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-sm">
                        <span className="font-semibold">Notes:</span> {order.notes}
                      </p>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <p className="font-semibold mb-2">Items:</p>
                    <div className="space-y-1">
                      {order.ordered_items.map((item, idx) => (
                        <p key={idx} className="text-sm">
                          {item.quantity}x {item.menu.name}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-2">Update Status:</p>
                    <Select
                      value={order.status}
                      onValueChange={(v) => updateOrderStatus(order.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="preparing">Preparing</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        {order.order_type === "delivery" && (
                          <SelectItem value="in_delivery">In Delivery</SelectItem>
                        )}
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Staff;