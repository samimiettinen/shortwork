import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, ArrowRight } from "lucide-react";

const timezones = [
  "Europe/Helsinki", "Europe/London", "Europe/Paris", "America/New_York",
  "America/Los_Angeles", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"
];

const Onboarding = () => {
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Helsinki");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .insert({ name: workspaceName, timezone })
        .select()
        .single();

      if (wsError) throw wsError;

      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

      if (memberError) throw memberError;

      toast({ title: "Workspace created!", description: "Let's connect your first channel" });
      navigate("/channels");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
            <Zap className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold">Create your workspace</h1>
          <p className="text-muted-foreground mt-2">Set up your team's publishing hub</p>
        </div>

        <form onSubmit={handleCreateWorkspace} className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-lg">
          <div>
            <Label htmlFor="name">Workspace Name</Label>
            <Input id="name" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="My Company" required className="mt-1.5" />
          </div>

          <div>
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={loading || !workspaceName}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
