import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { Loader2, Zap, ArrowRight, AlertCircle } from "lucide-react";

const timezones = [
  "Europe/Helsinki", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore", "Asia/Dubai",
  "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland"
];

const Onboarding = () => {
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Helsinki");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { handleError, handleSuccess } = useErrorHandler({ showToast: false });

  const validateForm = (): boolean => {
    setFormError(null);
    
    if (!workspaceName.trim()) {
      setFormError("Please enter a workspace name.");
      return false;
    }
    
    if (workspaceName.trim().length < 2) {
      setFormError("Workspace name must be at least 2 characters.");
      return false;
    }
    
    if (workspaceName.trim().length > 50) {
      setFormError("Workspace name must be less than 50 characters.");
      return false;
    }
    
    return true;
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFormError("You must be signed in to create a workspace. Please sign in again.");
        navigate("/auth");
        return;
      }

      // Create workspace
      const { data: workspace, error: wsError } = await supabase
        .from("workspaces")
        .insert({ name: workspaceName.trim(), timezone })
        .select()
        .single();

      if (wsError) {
        console.error("Workspace creation error:", wsError);
        throw wsError;
      }

      // Add user as owner
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({ 
          workspace_id: workspace.id, 
          user_id: user.id, 
          role: "owner" 
        });

      if (memberError) {
        console.error("Member creation error:", memberError);
        // If member creation fails, try to clean up the workspace
        await supabase.from("workspaces").delete().eq("id", workspace.id);
        throw memberError;
      }

      handleSuccess("Workspace created successfully!");
      navigate("/channels");
    } catch (error) {
      const parsed = handleError(error);
      setFormError(parsed.message);
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

        {formError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleCreateWorkspace} className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-lg">
          <div>
            <Label htmlFor="name">Workspace Name</Label>
            <Input 
              id="name" 
              value={workspaceName} 
              onChange={(e) => setWorkspaceName(e.target.value)} 
              placeholder="My Company" 
              required 
              className="mt-1.5"
              disabled={loading}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {workspaceName.length}/50 characters
            </p>
          </div>

          <div>
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone} disabled={loading}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Used for scheduling posts at the right time
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:opacity-90" 
            disabled={loading || !workspaceName.trim()}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            {loading ? "Creating..." : "Continue"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          You can invite team members and change settings later
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
