import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadsAnalytics } from "@/components/analytics/ThreadsAnalytics";
import { MessageCircle, BarChart3 } from "lucide-react";

const Analytics = () => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspace();
  }, []);

  const loadWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        setWorkspaceId(membership.workspace_id);
      }
    } catch (error) {
      console.error('Error loading workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-fade-in">
          <div className="mb-8">
            <Skeleton className="h-9 w-32 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!workspaceId) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No workspace found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track performance across your connected social channels
          </p>
        </div>

        <Tabs defaultValue="threads" className="space-y-6">
          <TabsList>
            <TabsTrigger value="threads" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Threads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="threads">
            <ThreadsAnalytics workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Analytics;
