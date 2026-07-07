import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SocialPublisher } from "@/components/social/SocialPublisher";
import { SchedulePost } from "@/components/social/SchedulePost";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { Calendar, Loader2, Zap } from "lucide-react";

const Compose = () => {
  const navigate = useNavigate();
  const { handleError } = useErrorHandler();
  const [activeTab, setActiveTab] = useState("publish");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspace();
  }, []);

  const loadWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();
      if (!membership) { navigate("/onboarding"); return; }
      setWorkspaceId(membership.workspace_id);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Create & Publish</h1>
          <p className="text-muted-foreground mt-1">Create content and publish to your social channels</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="publish" className="flex items-center gap-2">
              <Zap className="w-4 h-4" /> Quick Publish
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="publish">
            {workspaceId && <SocialPublisher workspaceId={workspaceId} />}
          </TabsContent>

          <TabsContent value="schedule">
            {workspaceId && <SchedulePost workspaceId={workspaceId} />}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Compose;
