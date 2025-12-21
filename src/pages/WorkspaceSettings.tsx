import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Settings, Loader2, Save, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const timezones = [
  "Europe/Helsinki", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore", "Asia/Dubai",
  "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland"
];

interface Workspace {
  id: string;
  name: string;
  timezone: string;
}

export default function WorkspaceSettings() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

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

      // Get user's workspace membership
      const { data: memberData, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (memberError || !memberData) {
        navigate("/onboarding");
        return;
      }

      setIsAdmin(memberData.role === "admin" || memberData.role === "owner");

      // Get workspace details
      const { data: workspaceData, error: wsError } = await supabase
        .from("workspaces")
        .select("id, name, timezone")
        .eq("id", memberData.workspace_id)
        .single();

      if (wsError || !workspaceData) {
        toast.error("Failed to load workspace");
        return;
      }

      setWorkspace(workspaceData);
      setName(workspaceData.name);
      setTimezone(workspaceData.timezone);
    } catch (error) {
      console.error("Error loading workspace:", error);
      toast.error("Failed to load workspace settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workspace || !isAdmin) return;
    
    if (!name.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    if (name.trim().length < 2) {
      toast.error("Workspace name must be at least 2 characters");
      return;
    }

    if (name.trim().length > 50) {
      toast.error("Workspace name must be less than 50 characters");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: name.trim(), timezone })
        .eq("id", workspace.id);

      if (error) throw error;

      setWorkspace({ ...workspace, name: name.trim(), timezone });
      toast.success("Workspace settings saved");
    } catch (error: any) {
      console.error("Error saving workspace:", error);
      toast.error(error.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace || !isAdmin) return;
    
    if (deleteConfirmation !== workspace.name) {
      toast.error("Please type the workspace name to confirm deletion");
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("workspaces")
        .delete()
        .eq("id", workspace.id);

      if (error) throw error;

      toast.success("Workspace deleted");
      navigate("/onboarding");
    } catch (error: any) {
      console.error("Error deleting workspace:", error);
      toast.error(error.message || "Failed to delete workspace");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasChanges = workspace && (name !== workspace.name || timezone !== workspace.timezone);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-2xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!workspace) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No workspace found.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Workspace Settings
          </h1>
          <p className="text-muted-foreground">Manage your workspace configuration</p>
        </div>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic workspace information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Company"
                disabled={!isAdmin || isSaving}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">{name.length}/50 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone} disabled={!isAdmin || isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for scheduling posts at the right time</p>
            </div>

            {isAdmin && (
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges || isSaving}
                className="mt-4"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            )}

            {!isAdmin && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Only workspace admins and owners can modify settings.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {isAdmin && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <div>
                  <p className="font-medium">Delete this workspace</p>
                  <p className="text-sm text-muted-foreground">
                    Once deleted, all data including posts, channels, and members will be permanently removed.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-4">
                          <p>
                            This action cannot be undone. This will permanently delete the workspace
                            <strong className="text-foreground"> {workspace.name}</strong> and all associated data including:
                          </p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            <li>All posts and drafts</li>
                            <li>Connected social accounts</li>
                            <li>Team members and invitations</li>
                            <li>Media assets and files</li>
                          </ul>
                          <div className="pt-2">
                            <Label htmlFor="confirm-delete">
                              Type <strong>{workspace.name}</strong> to confirm:
                            </Label>
                            <Input
                              id="confirm-delete"
                              value={deleteConfirmation}
                              onChange={(e) => setDeleteConfirmation(e.target.value)}
                              placeholder="Enter workspace name"
                              className="mt-2"
                            />
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleteConfirmation !== workspace.name || isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete Workspace"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
