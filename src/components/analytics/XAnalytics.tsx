import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "@/lib/csv-export";
import { 
  Heart, MessageCircle, Repeat2, Users, UserPlus, FileText, Eye,
  RefreshCw, TrendingUp, ExternalLink, AlertCircle, Loader2, Twitter, Download
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface XAccount {
  id: string;
  display_name: string;
  handle: string | null;
}

interface XInsights {
  profile: {
    id: string;
    name: string;
    username: string;
    profileImage: string;
    description: string;
  };
  metrics: {
    followers: number;
    following: number;
    tweets: number;
    listed: number;
  };
  recentTweets: Array<{
    id: string;
    text: string;
    createdAt: string;
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    quotes: number;
  }>;
  fetchedAt: string;
}

interface XAnalyticsProps {
  workspaceId: string;
}

export const XAnalytics = ({ workspaceId }: XAnalyticsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<XAccount | null>(null);
  const [insights, setInsights] = useState<XInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadXAccount();
  }, [workspaceId]);

  const loadXAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, display_name, handle')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'x')
        .eq('status', 'connected')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAccount(data);
        await fetchInsights(data.id);
      } else {
        setError('No X account connected');
      }
    } catch (err) {
      console.error('Error loading account:', err);
      setError('Failed to load X account');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async (accountId: string) => {
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await supabase.functions.invoke('x-insights', {
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

  const handleExportCSV = () => {
    const exportData = insights?.recentTweets.map(tweet => ({
      text: tweet.text,
      createdAt: tweet.createdAt,
      likes: tweet.likes,
      retweets: tweet.retweets,
      replies: tweet.replies,
      impressions: tweet.impressions,
      quotes: tweet.quotes,
    })) || [];

    exportToCSV(exportData, [
      { key: 'text', header: 'Tweet Text' },
      { key: 'createdAt', header: 'Posted At' },
      { key: 'likes', header: 'Likes' },
      { key: 'retweets', header: 'Retweets' },
      { key: 'replies', header: 'Replies' },
      { key: 'impressions', header: 'Impressions' },
      { key: 'quotes', header: 'Quotes' },
    ], 'x_analytics');

    toast({
      title: "Export complete",
      description: "X analytics downloaded as CSV",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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
          <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4">
            <Twitter className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No X Account Connected</h3>
          <p className="text-muted-foreground mb-4">
            Connect your X account to view analytics
          </p>
          <Button variant="outline" asChild>
            <a href="/channels">Connect X</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: 'Followers', value: insights?.metrics.followers || 0, icon: Users, color: 'text-blue-500' },
    { label: 'Following', value: insights?.metrics.following || 0, icon: UserPlus, color: 'text-purple-500' },
    { label: 'Total Tweets', value: insights?.metrics.tweets || 0, icon: FileText, color: 'text-emerald-500' },
    { label: 'Listed', value: insights?.metrics.listed || 0, icon: TrendingUp, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white">
            <Twitter className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{insights?.profile.name || account.display_name}</h2>
            {insights?.profile.username && (
              <p className="text-sm text-muted-foreground">@{insights.profile.username}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            disabled={!insights || refreshing}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
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
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Recent Tweets */}
      {insights?.recentTweets && insights.recentTweets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Tweets Performance
            </CardTitle>
            <CardDescription>
              Engagement metrics for your latest tweets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.recentTweets.map((tweet) => (
                <div 
                  key={tweet.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2 mb-2">{tweet.text}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {tweet.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 className="w-3 h-3" />
                          {tweet.retweets}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {tweet.replies}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatNumber(tweet.impressions)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="text-xs">
                        {formatDistanceToNow(new Date(tweet.createdAt), { addSuffix: true })}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`https://x.com/i/status/${tweet.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
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
