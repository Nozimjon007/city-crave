import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat, ShoppingCart, Truck, MapPin } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504674900247-0877df9cc836')] bg-cover bg-center opacity-10"></div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-block mb-6 p-4 bg-white/10 backdrop-blur-sm rounded-full">
            <ChefHat className="w-16 h-16 text-white" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-in fade-in slide-in-from-bottom duration-700">
            Tasty Bites
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-8 animate-in fade-in slide-in-from-bottom duration-700 delay-150">
            Order delicious food from 5 locations across the city
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom duration-700 delay-300">
            <Button 
              onClick={() => navigate("/auth")} 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6 shadow-glow"
            >
              Order Now
            </Button>
            <Button 
              onClick={() => navigate("/auth")} 
              size="lg"
              variant="outline"
              className="bg-white/10 text-white border-white hover:bg-white/20 text-lg px-8 py-6 backdrop-blur-sm"
            >
              Staff Login
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-12">Why Choose Us?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-card shadow-soft hover:shadow-glow transition-all">
              <div className="inline-block p-4 bg-gradient-warm rounded-full mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">5 Branches</h3>
              <p className="text-muted-foreground">
                Conveniently located across the city for quick access
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-card shadow-soft hover:shadow-glow transition-all">
              <div className="inline-block p-4 bg-gradient-warm rounded-full mb-4">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">Fast Delivery</h3>
              <p className="text-muted-foreground">
                Quick delivery or pickup options for all orders
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-card shadow-soft hover:shadow-glow transition-all">
              <div className="inline-block p-4 bg-gradient-warm rounded-full mb-4">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">Easy Ordering</h3>
              <p className="text-muted-foreground">
                Simple and intuitive ordering process for everyone
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
