import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { Clock, Plus, Trash2, CheckCircle, XCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react";

interface PostTarget {
  id: string;
  platform: string;
  status: string;
  remote_post_id: string | null;
  remote_post_url: string | null;
  last_error_message: string | null;
  published_at: string | null;
  social_accounts: { display_name: string; handle: string | null } | null;
}

interface PostRow {
  id: string;
  status: string;
  title: string | null;
  body_text: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  post_targets: PostTarget[];
  per_channel_overrides?: { platform_overrides?: Record<string, { content?: string; title?: string; scheduledAt?: string }> };
}

const statusColor: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-500',
  partial: 'bg-amber-500/10 text-amber-500',
  published: 'bg-green-500/10 text-green-500',
  failed: 'bg-red-500/10 text-red-500',
  canceled: 'bg-muted text-muted-foreground',
  queued: 'bg-blue-500/10 text-blue-500',
  publishing: 'bg-amber-500/10 text-amber-500',
  needs_user_action: 'bg-amber-500/10 text-amber-500',
  skipped: 'bg-muted text-muted-foreground',
};

const Queue = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<PostRow[]>([]);
  const [history, setHistory] = useState<PostRow[]>([]);
  const [view, setView] = useState("scheduled");

  const load = useCallback(async () => {
    setLoading(true);
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

      const select = `
        id, status, title, body_text, scheduled_at, created_at, updated_at, per_channel_overrides,
        post_targets ( id, platform, status, remote_post_id, remote_post_url, last_error_message, published_at,
          social_accounts ( display_name, handle )
        )
      `;
      const { data: sch, error: scheduledError } = await supabase
        .from('posts')
        .select(select)
        .eq('workspace_id', membership.workspace_id)
        .in('status', ['scheduled', 'publishing'])
        .order('scheduled_at', { ascending: true });
      if (scheduledError) throw scheduledError;
      setScheduled((sch as unknown as PostRow[]) || []);

      const { data: hist, error: historyError } = await supabase
        .from('posts')
        .select(select)
        .eq('workspace_id', membership.workspace_id)
        .in('status', ['published', 'partial', 'needs_user_action', 'failed', 'canceled'])
        .order('updated_at', { ascending: false })
        .limit(50);
      if (historyError) throw historyError;
      setHistory((hist as unknown as PostRow[]) || []);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [navigate, handleError]);

  useEffect(() => { void load(); }, [load]);

  const cancel = async (postId: string) => {
    if (!confirm('Cancel this scheduled post?')) return;
    try {
      const { error } = await supabase.rpc('cancel_publish_request', { p_post: postId });
      if (error) throw error;
      toast({ title: 'Canceled' });
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const PostCard = ({ p, canCancel }: { p: PostRow; canCancel: boolean }) => (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={statusColor[p.status] || ''}>{p.status.replaceAll('_', ' ')}</Badge>
              {p.scheduled_at && (
                <span className="text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(p.scheduled_at).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-3">{p.body_text || p.title}</p>
          </div>
          {canCancel && p.status === 'scheduled' && p.post_targets.every(t => t.status === 'queued') && (
            <Button variant="ghost" size="sm" onClick={() => cancel(p.id)} aria-label="Cancel scheduled post">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {p.post_targets.map(t => (
            <div key={t.id} className="flex items-center gap-1.5 text-xs">
              {t.status === 'published' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
              {t.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
              {t.status === 'publishing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {(t.status === 'queued' || t.status === 'needs_user_action' || t.status === 'skipped') && (
                <Badge variant="outline" className="text-[10px] capitalize h-4">{t.status.replaceAll('_',' ')}</Badge>
              )}
              <span className="capitalize">{t.platform}</span>
              {t.social_accounts?.display_name && <span className="text-muted-foreground">· {t.social_accounts.display_name}</span>}
              {t.remote_post_url && /^https:\/\//.test(t.remote_post_url) && t.status === 'published' && (
                <a href={t.remote_post_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center" title="Open published post">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {p.per_channel_overrides?.platform_overrides?.[t.platform]?.scheduledAt && <span className="text-muted-foreground">
                · {new Date(p.per_channel_overrides.platform_overrides[t.platform].scheduledAt!).toLocaleString()}
              </span>}
              {t.platform === 'tiktok' && t.status === 'needs_user_action' && <Button variant="outline" size="sm" onClick={() =>
                navigator.clipboard.writeText(p.per_channel_overrides?.platform_overrides?.tiktok?.content || p.body_text || '')
                  .then(() => toast({ title: 'TikTok caption copied' })).catch(handleError)}>Copy TikTok caption</Button>}
              {t.last_error_message && <span className="text-red-500 truncate max-w-[240px]" title={t.last_error_message}>— {t.last_error_message}</span>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Queue</h1>
            <p className="text-muted-foreground mt-1">Track every channel’s outcome and scheduled posts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            <Button onClick={() => navigate("/compose")} className="bg-gradient-primary hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" /> New Post
            </Button>
          </div>
        </div>

        <Tabs value={view} onValueChange={setView}>
          <TabsList className="mb-6">
            <TabsTrigger value="scheduled">Active ({scheduled.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : scheduled.length === 0 ? (
              <Card><CardContent className="pt-6">
                <div className="text-center py-16">
                  <Clock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-display font-semibold mb-2">No scheduled posts</h3>
                  <p className="text-muted-foreground mb-6">Start scheduling content to see it here</p>
                  <Button onClick={() => navigate("/compose")} className="bg-gradient-primary hover:opacity-90">
                    <Plus className="w-4 h-4 mr-2" /> Create Post
                  </Button>
                </div>
              </CardContent></Card>
            ) : scheduled.map(p => <PostCard key={p.id} p={p} canCancel />)}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : history.length === 0 ? (
              <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">No history yet</CardContent></Card>
            ) : history.map(p => <PostCard key={p.id} p={p} canCancel={false} />)}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Queue;
