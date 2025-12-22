import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, Heart, MessageCircle, Users, UserPlus, Image,
  RefreshCw, TrendingUp, ExternalLink, AlertCircle, Loader2, Instagram
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InstagramAccount {
  id: string;
  display_name: string;
  handle: string | null;
}

interface InstagramInsights {
  profile: {
    username: string;
    name: string;
    profilePicture: string;
    followersCount: number;
    followsCount: number;
    mediaCount: number;
  };
  metrics: {
    impressions: number;
    reach: number;
    profileViews: number;
  };
  recentMedia: Array<{
    id: string;
    caption: string;
    media_type: string;
    permalink: string;
    thumbnail_url?: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
  }>;
  fetchedAt: string;
}

interface InstagramAnalyticsProps {
  workspaceId: string;
}

export const InstagramAnalytics = ({ workspaceId }: InstagramAnalyticsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [insights, setInsights] = useState<InstagramInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInstagramAccount();
  }, [workspaceId]);

  const loadInstagramAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, display_name, handle')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'instagram')
        .eq('status', 'connected')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAccount(data);
        await fetchInsights(data.id);
      } else {
        setError('No Instagram account connected');
      }
    } catch (err) {
      console.error('Error loading account:', err);
      setError('Failed to load Instagram account');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async (accountId: string) => {
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await supabase.functions.invoke('instagram-insights', {
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center mx-auto mb-4">
            <Instagram className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Instagram Account Connected</h3>
          <p className="text-muted-foreground mb-4">
            Connect your Instagram Business account to view analytics
          </p>
          <Button variant="outline" asChild>
            <a href="/channels">Connect Instagram</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: 'Followers', value: insights?.profile.followersCount || 0, icon: Users, color: 'text-pink-500' },
    { label: 'Following', value: insights?.profile.followsCount || 0, icon: UserPlus, color: 'text-purple-500' },
    { label: 'Posts', value: insights?.profile.mediaCount || 0, icon: Image, color: 'text-orange-500' },
    { label: 'Impressions (7d)', value: insights?.metrics.impressions || 0, icon: Eye, color: 'text-blue-500' },
    { label: 'Reach (7d)', value: insights?.metrics.reach || 0, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Profile Views (7d)', value: insights?.metrics.profileViews || 0, icon: Eye, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-white">
            <Instagram className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{insights?.profile.name || account.display_name}</h2>
            {insights?.profile.username && (
              <p className="text-sm text-muted-foreground">@{insights.profile.username}</p>
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
      {insights?.recentMedia && insights.recentMedia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Posts Performance
            </CardTitle>
            <CardDescription>
              Engagement metrics for your latest Instagram posts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.recentMedia.map((post) => (
                <div 
                  key={post.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2 mb-2">{post.caption || 'No caption'}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {post.like_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {post.comments_count || 0}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {post.media_type}
                        </Badge>
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
