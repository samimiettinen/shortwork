import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Heart, MessageCircle, FileText,
  RefreshCw, TrendingUp, AlertCircle, Loader2, Linkedin
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LinkedInAccount {
  id: string;
  display_name: string;
  handle: string | null;
}

interface LinkedInInsights {
  profile: {
    id: string;
    name: string;
    email: string;
    picture: string;
  };
  metrics: {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
  };
  recentPosts: Array<{
    id: string;
    text: string;
    createdAt: string;
    likes: number;
    comments: number;
  }>;
  fetchedAt: string;
}

interface LinkedInAnalyticsProps {
  workspaceId: string;
}

export const LinkedInAnalytics = ({ workspaceId }: LinkedInAnalyticsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<LinkedInAccount | null>(null);
  const [insights, setInsights] = useState<LinkedInInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLinkedInAccount();
  }, [workspaceId]);

  const loadLinkedInAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, display_name, handle')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'linkedin')
        .eq('status', 'connected')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAccount(data);
        await fetchInsights(data.id);
      } else {
        setError('No LinkedIn account connected');
      }
    } catch (err) {
      console.error('Error loading account:', err);
      setError('Failed to load LinkedIn account');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async (accountId: string) => {
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await supabase.functions.invoke('linkedin-insights', {
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
          <div className="w-16 h-16 rounded-2xl bg-[#0A66C2] flex items-center justify-center mx-auto mb-4">
            <Linkedin className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No LinkedIn Account Connected</h3>
          <p className="text-muted-foreground mb-4">
            Connect your LinkedIn account to view analytics
          </p>
          <Button variant="outline" asChild>
            <a href="/channels">Connect LinkedIn</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: 'Total Posts', value: insights?.metrics.totalPosts || 0, icon: FileText, color: 'text-blue-600' },
    { label: 'Total Likes', value: insights?.metrics.totalLikes || 0, icon: Heart, color: 'text-rose-500' },
    { label: 'Total Comments', value: insights?.metrics.totalComments || 0, icon: MessageCircle, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A66C2] flex items-center justify-center text-white">
            <Linkedin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{insights?.profile.name || account.display_name}</h2>
            <p className="text-sm text-muted-foreground">LinkedIn Profile</p>
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

      {/* Recent Posts */}
      {insights?.recentPosts && insights.recentPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Posts Performance
            </CardTitle>
            <CardDescription>
              Engagement metrics for your latest LinkedIn posts
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
                      <p className="text-sm line-clamp-2 mb-2">{post.text || 'No text content'}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {post.comments}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {insights?.recentPosts?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent posts found</p>
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
