import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAdmin } from "@/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, FileText, Send, Building2 } from "lucide-react";
import { format } from "date-fns";

interface UserStats {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  workspace_count: number;
  post_count: number;
  social_account_count: number;
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
  const [stats, setStats] = useState<OverallStats>({
    total_users: 0,
    total_workspaces: 0,
    total_posts: 0,
    total_social_accounts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
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
          .select("user_id");

        // Fetch post counts per user
        const { data: postCounts } = await supabase
          .from("posts")
          .select("created_by");

        // Fetch social account counts
        const { data: workspaces } = await supabase
          .from("workspaces")
          .select("id");

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
            social_account_count: 0, // Will be calculated based on workspace membership
          };
        });

        setUsers(userStats);
        setStats({
          total_users: profiles?.length || 0,
          total_workspaces: workspaces?.length || 0,
          total_posts: postCounts?.length || 0,
          total_social_accounts: socialAccounts?.length || 0,
        });
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

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
          <p className="text-muted-foreground">Manage users and view platform statistics</p>
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

        {/* Users Table */}
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
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Admin;
