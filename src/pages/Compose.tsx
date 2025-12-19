import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SocialPublisher } from "@/components/social/SocialPublisher";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { Calendar, Clock, Upload, Save, Send, Image, Video, AlertCircle, CheckCircle, Loader2, Zap } from "lucide-react";

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
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        navigate("/onboarding");
        return;
      }

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
            <Card>
              <CardHeader>
                <CardTitle>Schedule Post</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Content</Label>
                  <Textarea 
                    placeholder="What's on your mind?" 
                    className="mt-1.5 min-h-[150px] resize-none"
                  />
                </div>
                
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Drop media here or click to upload</p>
                  <p className="text-sm text-muted-foreground mt-1">Supports images and videos up to 100MB</p>
                  <div className="flex justify-center gap-4 mt-4">
                    <Button variant="outline" size="sm"><Image className="w-4 h-4 mr-2" />Image</Button>
                    <Button variant="outline" size="sm"><Video className="w-4 h-4 mr-2" />Video</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <div className="relative mt-1.5">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="date" className="pl-10" min={new Date().toISOString().split('T')[0]} />
                    </div>
                  </div>
                  <div>
                    <Label>Time</Label>
                    <div className="relative mt-1.5">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="time" className="pl-10" />
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    Scheduled posts will be published automatically at the specified time. 
                    Make sure your channels are connected and have valid tokens.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button className="flex-1 bg-gradient-primary hover:opacity-90">
                    <Calendar className="w-4 h-4 mr-2" /> Schedule Post
                  </Button>
                  <Button variant="outline">
                    <Save className="w-4 h-4 mr-2" /> Save Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Compose;
