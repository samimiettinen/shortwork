import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteMemberDialog } from "@/components/workspace/InviteMemberDialog";
import { MoreHorizontal, Trash2, Clock, Mail, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

const roleBadgeVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  owner: "default",
  admin: "secondary",
  editor: "outline",
  approver: "outline",
  viewer: "outline",
};

export default function TeamMembers() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const loadWorkspaceData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's workspace
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!memberData) {
        setIsLoading(false);
        return;
      }

      setWorkspaceId(memberData.workspace_id);
      setCurrentUserRole(memberData.role);

      await Promise.all([
        loadMembers(memberData.workspace_id),
        loadInvitations(memberData.workspace_id),
      ]);
    } catch (error) {
      console.error("Error loading workspace data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async (wsId: string) => {
    const { data, error } = await supabase
      .from("workspace_members")
      .select(`
        id,
        user_id,
        role,
        created_at,
        profile:profiles!workspace_members_user_id_fkey(full_name, email, avatar_url)
      `)
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading members:", error);
      return;
    }

    // Transform the data to handle the profile relationship
    const transformedData = (data || []).map((member: any) => ({
      ...member,
      profile: Array.isArray(member.profile) ? member.profile[0] : member.profile,
    }));

    setMembers(transformedData);
  };

  const loadInvitations = async (wsId: string) => {
    const { data, error } = await supabase
      .from("workspace_invitations")
      .select("id, email, role, status, created_at, expires_at")
      .eq("workspace_id", wsId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading invitations:", error);
      return;
    }

    setInvitations(data || []);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("workspace_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Invitation cancelled");
      if (workspaceId) {
        loadInvitations(workspaceId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel invitation");
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    if (memberRole === "owner") {
      toast.error("Cannot remove workspace owner");
      return;
    }

    try {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Member removed");
      if (workspaceId) {
        loadMembers(workspaceId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to remove member");
    }
  };

  const isAdmin = currentUserRole === "admin" || currentUserRole === "owner";

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "?";
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!workspaceId) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No workspace found. Please complete onboarding first.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Members</h1>
            <p className="text-muted-foreground">Manage your workspace team and invitations</p>
          </div>
          {isAdmin && (
            <InviteMemberDialog 
              workspaceId={workspaceId} 
              onInviteSent={() => loadInvitations(workspaceId)}
            />
          )}
        </div>

        {/* Current Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Members ({members.length})
            </CardTitle>
            <CardDescription>People who have access to this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(member.profile?.full_name ?? null, member.profile?.email ?? null)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.profile?.full_name || "Unknown"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.profile?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariants[member.role] || "outline"}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(member.created_at), "MMM d, yyyy")}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {member.role !== "owner" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleRemoveMember(member.id, member.role)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {isAdmin && invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Invitations ({invitations.length})
              </CardTitle>
              <CardDescription>Invitations waiting to be accepted</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {invitation.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{invitation.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{invitation.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(invitation.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(invitation.expires_at), "MMM d")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
