import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, Heart, MessageCircle, Repeat2, Quote, Users, 
  RefreshCw, TrendingUp, ExternalLink, AlertCircle, Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ThreadsAccount {
  id: string;
  display_name: string;
  handle: string | null;
}

interface UserMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followers: number;
}

interface ThreadsPost {
  id: string;
  text: string;
  timestamp: string;
  permalink: string;
  like_count?: number;
  reply_count?: number;
  repost_count?: number;
  quote_count?: number;
}

interface ThreadsInsights {
  userMetrics: UserMetrics;
  recentPosts: ThreadsPost[];
  fetchedAt: string;
}

interface ThreadsAnalyticsProps {
  workspaceId: string;
}

export const ThreadsAnalytics = ({ workspaceId }: ThreadsAnalyticsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<ThreadsAccount | null>(null);
  const [insights, setInsights] = useState<ThreadsInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadThreadsAccount();
  }, [workspaceId]);

  const loadThreadsAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, display_name, handle')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'threads')
        .eq('status', 'connected')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAccount(data);
        await fetchInsights(data.id);
      } else {
        setError('No Threads account connected');
      }
    } catch (err) {
      console.error('Error loading account:', err);
      setError('Failed to load Threads account');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async (accountId: string) => {
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await supabase.functions.invoke('threads-insights', {
        body: { accountId },
      });

      if (response.error) throw response.error;
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setInsights(response.data);
    } catch (err: any) {
      console.error('Error fetching insights:', err);
      setError(err.message || 'Failed to fetch insights');
      toast({
        title: "Error",
        description: err.message || "Failed to fetch Threads insights",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (account) {
      fetchInsights(account.id);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Threads Account Connected</h3>
          <p className="text-muted-foreground mb-4">
            Connect your Threads account to view analytics
          </p>
          <Button variant="outline" asChild>
            <a href="/channels">Connect Threads</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: 'Total Views', value: insights?.userMetrics.views || 0, icon: Eye, color: 'text-blue-500' },
    { label: 'Likes', value: insights?.userMetrics.likes || 0, icon: Heart, color: 'text-rose-500' },
    { label: 'Replies', value: insights?.userMetrics.replies || 0, icon: MessageCircle, color: 'text-emerald-500' },
    { label: 'Reposts', value: insights?.userMetrics.reposts || 0, icon: Repeat2, color: 'text-purple-500' },
    { label: 'Quotes', value: insights?.userMetrics.quotes || 0, icon: Quote, color: 'text-amber-500' },
    { label: 'Followers', value: insights?.userMetrics.followers || 0, icon: Users, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{account.display_name}</h2>
            {account.handle && (
              <p className="text-sm text-muted-foreground">{account.handle}</p>
            )}
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="hover-lift">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${metric.color}`} />
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(metric.value)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Posts */}
      {insights?.recentPosts && insights.recentPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Posts Performance
            </CardTitle>
            <CardDescription>
              Engagement metrics for your latest Threads posts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.recentPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2 mb-2">{post.text}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {post.like_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {post.reply_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 className="w-3 h-3" />
                          {post.repost_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Quote className="w-3 h-3" />
                          {post.quote_count || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="text-xs">
                        {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
                      </Badge>
                      {post.permalink && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {insights && (
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {formatDistanceToNow(new Date(insights.fetchedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
};
