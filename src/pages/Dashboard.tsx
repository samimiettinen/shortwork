import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { Calendar, Send, Clock, TrendingUp, Plus, Zap, AlertCircle, RefreshCw } from "lucide-react";
import { StorageUsage } from "@/components/dashboard/StorageUsage";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { handleError } = useErrorHandler({ showToast: false });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        if (!session) {
          navigate("/auth");
          return;
        }

        // Check if user has a workspace
        const { data: memberships, error: memberError } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", session.user.id)
          .limit(1);

        if (memberError) {
          console.error("Error checking workspace membership:", memberError);
          // Don't throw here, just continue - they might need to create a workspace
        }

        if (!memberships || memberships.length === 0) {
          navigate("/onboarding");
          return;
        }

        setLoading(false);
      } catch (err) {
        const parsed = handleError(err);
        setError(parsed.message);
        setLoading(false);
      }
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, handleError]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Skeleton className="h-9 w-40 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const stats = [
    { label: "Scheduled", value: "0", icon: Clock, color: "text-info" },
    { label: "Published", value: "0", icon: Send, color: "text-success" },
    { label: "This Week", value: "0", icon: Calendar, color: "text-primary" },
    { label: "Engagement", value: "—", icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your publishing activity</p>
          </div>
          <Button onClick={() => navigate("/compose")} className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> New Post
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="hover-lift">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-display font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle>Upcoming Posts</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No scheduled posts yet</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/compose")}>
                  Create your first post
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Connected Channels</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Connect your social accounts</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/channels")}>
                  Connect Channel
                </Button>
              </div>
            </CardContent>
          </Card>

          <StorageUsage />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
