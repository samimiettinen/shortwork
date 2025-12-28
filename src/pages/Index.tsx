import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar, Send, BarChart3, ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const features = [
    { icon: Calendar, title: "Smart Scheduling", desc: "Plan your content calendar weeks ahead" },
    { icon: Send, title: "Multi-Platform", desc: "Publish to 6+ social networks at once" },
    { icon: BarChart3, title: "Analytics", desc: "Track performance across all channels" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="ShortWork" className="h-10 w-auto" />
            <span className="font-display font-bold text-xl">ShortWork</span>
          </div>
          <Button onClick={() => navigate("/auth")} variant="outline">Sign In</Button>
        </div>
      </header>

      <main>
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Sparkles className="w-4 h-4" /> The smarter way to publish
            </div>
            <h1 className="text-4xl lg:text-6xl font-display font-bold max-w-3xl mx-auto leading-tight animate-slide-up">
              Schedule & publish <span className="text-gradient">short videos</span> everywhere
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mt-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Manage Instagram, TikTok, YouTube Shorts, and more from one beautiful dashboard. Save hours every week.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button size="lg" onClick={() => navigate("/auth")} className="bg-gradient-primary hover:opacity-90 text-lg px-8">
                Get Started Free <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">Watch Demo</Button>
            </div>
          </div>
        </section>

        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <div key={feature.title} className="bg-card p-6 rounded-2xl border border-border hover-lift animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-display font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-display font-bold mb-4">Ready to save time?</h2>
            <p className="text-muted-foreground mb-8">Join thousands of creators managing their content smarter</p>
            <Button size="lg" onClick={() => navigate("/auth")} className="bg-gradient-primary hover:opacity-90">
              Start for Free <Check className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground">&copy; 2024 ShortWork. Built with Lovable.</p>
            <div className="flex items-center gap-6">
              <Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
