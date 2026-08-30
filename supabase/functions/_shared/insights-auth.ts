// Shared authorization helper for insights edge functions.
//
// Insights functions use the service-role client (RLS bypassed) to read
// oauth_tokens, so they MUST verify that the JWT caller is a member of the
// workspace that owns the requested social account before doing anything.

export interface AuthzResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
  workspaceId?: string;
}

export async function authorizeAccountAccess(
  req: Request,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  accountId: string,
): Promise<AuthzResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: account } = await supabase
    .from("social_accounts")
    .select("id, workspace_id")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) {
    return { ok: false, status: 404, error: "Account not found" };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", account.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    // Same message as "not found" so account ids cannot be enumerated.
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return {
    ok: true,
    status: 200,
    userId: user.id,
    workspaceId: account.workspace_id,
  };
}
