import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, Heart, MessageCircle, Users, Video, Play,
  RefreshCw, TrendingUp, ExternalLink, AlertCircle, Loader2, Youtube
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface YouTubeAccount {
  id: string;
  display_name: string;
  handle: string | null;
}

interface YouTubeInsights {
  channel: {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    customUrl: string;
  };
  metrics: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
  };
  recentVideos: Array<{
    id: string;
    title: string;
    thumbnail: string;
    publishedAt: string;
    views: number;
    likes: number;
    comments: number;
  }>;
  fetchedAt: string;
}

interface YouTubeAnalyticsProps {
  workspaceId: string;
}

export const YouTubeAnalytics = ({ workspaceId }: YouTubeAnalyticsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<YouTubeAccount | null>(null);
  const [insights, setInsights] = useState<YouTubeInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadYouTubeAccount();
  }, [workspaceId]);

  const loadYouTubeAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, display_name, handle')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'youtube')
        .eq('status', 'connected')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAccount(data);
        await fetchInsights(data.id);
      } else {
        setError('No YouTube account connected');
      }
    } catch (err) {
      console.error('Error loading account:', err);
      setError('Failed to load YouTube account');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async (accountId: string) => {
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await supabase.functions.invoke('youtube-insights', {
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
          <div className="w-16 h-16 rounded-2xl bg-[#FF0000] flex items-center justify-center mx-auto mb-4">
            <Youtube className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No YouTube Channel Connected</h3>
          <p className="text-muted-foreground mb-4">
            Connect your YouTube channel to view analytics
          </p>
          <Button variant="outline" asChild>
            <a href="/channels">Connect YouTube</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: 'Subscribers', value: insights?.metrics.subscribers || 0, icon: Users, color: 'text-red-500' },
    { label: 'Total Views', value: insights?.metrics.totalViews || 0, icon: Eye, color: 'text-blue-500' },
    { label: 'Videos', value: insights?.metrics.videoCount || 0, icon: Video, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF0000] flex items-center justify-center text-white">
            <Youtube className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{insights?.channel.title || account.display_name}</h2>
            {insights?.channel.customUrl && (
              <p className="text-sm text-muted-foreground">{insights.channel.customUrl}</p>
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Recent Videos */}
      {insights?.recentVideos && insights.recentVideos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Videos Performance
            </CardTitle>
            <CardDescription>
              Engagement metrics for your latest videos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.recentVideos.map((video) => (
                <div 
                  key={video.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex gap-4">
                    {video.thumbnail && (
                      <div className="relative w-32 h-20 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2 mb-2">{video.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatNumber(video.views)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {formatNumber(video.likes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {video.comments}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">
                          {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
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
