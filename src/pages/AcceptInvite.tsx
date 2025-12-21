import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, LogIn } from "lucide-react";
import { toast } from "sonner";

type InviteStatus = "loading" | "needs-auth" | "accepting" | "success" | "error";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invitation link");
      return;
    }

    checkAuthAndAccept();
  }, [token]);

  const checkAuthAndAccept = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setStatus("needs-auth");
      return;
    }

    acceptInvitation();
  };

  const acceptInvitation = async () => {
    if (!token) return;

    setStatus("accepting");

    try {
      const { data, error } = await supabase.rpc("accept_workspace_invitation", {
        invitation_token: token,
      });

      if (error) {
        console.error("Accept invitation error:", error);
        setStatus("error");
        setErrorMessage(error.message || "Failed to accept invitation");
        return;
      }

      const result = data as { success: boolean; error?: string; workspace_id?: string; message?: string };

      if (!result.success) {
        setStatus("error");
        setErrorMessage(result.error || "Failed to accept invitation");
        return;
      }

      // Get workspace name for success message
      if (result.workspace_id) {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", result.workspace_id)
          .single();
        
        if (workspace) {
          setWorkspaceName(workspace.name);
        }
      }

      setStatus("success");
      toast.success("Invitation accepted!");
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err: any) {
      console.error("Accept invitation error:", err);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred");
    }
  };

  const handleLogin = () => {
    // Store the current URL to redirect back after login
    sessionStorage.setItem("redirectAfterAuth", window.location.href);
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Workspace Invitation</CardTitle>
          <CardDescription>
            {status === "loading" && "Verifying invitation..."}
            {status === "needs-auth" && "Please sign in to accept this invitation"}
            {status === "accepting" && "Accepting invitation..."}
            {status === "success" && `Welcome to ${workspaceName || "your new workspace"}!`}
            {status === "error" && "Unable to accept invitation"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {(status === "loading" || status === "accepting") && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          
          {status === "needs-auth" && (
            <>
              <LogIn className="h-12 w-12 text-muted-foreground" />
              <p className="text-center text-muted-foreground">
                You need to sign in or create an account to accept this invitation.
              </p>
              <Button onClick={handleLogin} className="w-full">
                Sign In / Sign Up
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center text-muted-foreground">
                You've successfully joined the workspace. Redirecting to dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-destructive">{errorMessage}</p>
              <Button onClick={() => navigate("/dashboard")} variant="outline">
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
