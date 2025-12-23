import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAdmin } from "@/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, FileText, Send, Building2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserStats {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  workspace_count: number;
  post_count: number;
  social_account_count: number;
}

interface Workspace {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
  member_count: number;
  post_count: number;
}

interface OverallStats {
  total_users: number;
  total_workspaces: number;
  total_posts: number;
  total_social_accounts: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [stats, setStats] = useState<OverallStats>({
    total_users: 0,
    total_workspaces: 0,
    total_posts: 0,
    total_social_accounts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  const fetchData = async () => {
    if (!isAdmin) return;

    try {
      // Fetch all profiles with their stats
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch workspace counts per user
      const { data: workspaceCounts } = await supabase
        .from("workspace_members")
        .select("user_id, workspace_id");

      // Fetch post counts per user
      const { data: postCounts } = await supabase
        .from("posts")
        .select("created_by, workspace_id");

      // Fetch all workspaces
      const { data: workspacesData } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: socialAccounts } = await supabase
        .from("social_accounts")
        .select("workspace_id");

      // Calculate stats per user
      const userStats: UserStats[] = (profiles || []).map((profile) => {
        const userWorkspaces = workspaceCounts?.filter(w => w.user_id === profile.user_id) || [];
        const userPosts = postCounts?.filter(p => p.created_by === profile.user_id) || [];
        
        return {
          id: profile.user_id,
          email: profile.email || "N/A",
          full_name: profile.full_name,
          created_at: profile.created_at,
          workspace_count: userWorkspaces.length,
          post_count: userPosts.length,
          social_account_count: 0,
        };
      });

      // Calculate workspace stats
      const workspaceStats: Workspace[] = (workspacesData || []).map((ws) => {
        const memberCount = workspaceCounts?.filter(w => w.workspace_id === ws.id).length || 0;
        const postCount = postCounts?.filter(p => p.workspace_id === ws.id).length || 0;
        
        return {
          id: ws.id,
          name: ws.name,
          timezone: ws.timezone,
          created_at: ws.created_at,
          member_count: memberCount,
          post_count: postCount,
        };
      });

      setUsers(userStats);
      setWorkspaces(workspaceStats);
      setStats({
        total_users: profiles?.length || 0,
        total_workspaces: workspacesData?.length || 0,
        total_posts: postCounts?.length || 0,
        total_social_accounts: socialAccounts?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const handleDeleteUser = async (userId: string) => {
    setDeleting(userId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete', {
        body: { action: 'delete_user', targetId: userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("User deleted successfully");
      setUsers(prev => prev.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, total_users: prev.total_users - 1 }));
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    setDeleting(workspaceId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete', {
        body: { action: 'delete_workspace', targetId: workspaceId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Workspace deleted successfully");
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
      setStats(prev => ({ ...prev, total_workspaces: prev.total_workspaces - 1 }));
    } catch (error: any) {
      console.error("Error deleting workspace:", error);
      toast.error(error.message || "Failed to delete workspace");
    } finally {
      setDeleting(null);
    }
  };

  if (adminLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, workspaces, and view platform statistics</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_users}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_workspaces}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_posts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_social_accounts}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Users and Workspaces */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Workspaces</TableHead>
                      <TableHead>Posts</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.full_name || "—"}</TableCell>
                        <TableCell>{user.workspace_count}</TableCell>
                        <TableCell>{user.post_count}</TableCell>
                        <TableCell>{format(new Date(user.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={user.workspace_count > 0 ? "default" : "secondary"}>
                            {user.workspace_count > 0 ? "Active" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deleting === user.id}
                              >
                                {deleting === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{user.email}</strong>? This will permanently remove
                                  the user and all their data. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspaces">
            <Card>
              <CardHeader>
                <CardTitle>All Workspaces</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Timezone</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Posts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workspaces.map((workspace) => (
                      <TableRow key={workspace.id}>
                        <TableCell className="font-medium">{workspace.name}</TableCell>
                        <TableCell>{workspace.timezone}</TableCell>
                        <TableCell>{workspace.member_count}</TableCell>
                        <TableCell>{workspace.post_count}</TableCell>
                        <TableCell>{format(new Date(workspace.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deleting === workspace.id}
                              >
                                {deleting === workspace.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{workspace.name}</strong>? This will permanently
                                  remove the workspace, all posts, social accounts, and member associations. This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteWorkspace(workspace.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {workspaces.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No workspaces found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Admin;
