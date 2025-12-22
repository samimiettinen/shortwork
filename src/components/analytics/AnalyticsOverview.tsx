import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "@/lib/csv-export";
import { 
  Users, Eye, Heart, MessageCircle, TrendingUp,
  Instagram, Facebook, Linkedin, Twitter, Youtube, MessageCircle as ThreadsIcon,
  RefreshCw, Loader2, ArrowUpRight, AlertCircle, Download
} from "lucide-react";
interface PlatformSummary {
  platform: string;
  connected: boolean;
  accountId?: string;
  displayName?: string;
  handle?: string;
  metrics?: {
    followers?: number;
    views?: number;
    engagement?: number;
  };
  loading?: boolean;
  error?: string;
}

interface AnalyticsOverviewProps {
  workspaceId: string;
}

const platformConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  threads: { icon: ThreadsIcon, color: 'text-white', bgColor: 'bg-gradient-to-br from-pink-500 to-purple-600' },
  instagram: { icon: Instagram, color: 'text-white', bgColor: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400' },
  facebook: { icon: Facebook, color: 'text-white', bgColor: 'bg-[#1877F2]' },
  linkedin: { icon: Linkedin, color: 'text-white', bgColor: 'bg-[#0A66C2]' },
  x: { icon: Twitter, color: 'text-white', bgColor: 'bg-black' },
  youtube: { icon: Youtube, color: 'text-white', bgColor: 'bg-[#FF0000]' },
};

export const AnalyticsOverview = ({ workspaceId }: AnalyticsOverviewProps) => {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    loadPlatforms();
  }, [workspaceId]);

  const loadPlatforms = async () => {
    try {
      // Get all connected accounts
      const { data: accounts, error } = await supabase
        .from('social_accounts')
        .select('id, platform, display_name, handle, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected');

      if (error) throw error;

      const allPlatforms = ['threads', 'instagram', 'facebook', 'linkedin', 'x', 'youtube'];
      
      const platformSummaries: PlatformSummary[] = allPlatforms.map(platform => {
        const account = accounts?.find(a => a.platform === platform);
        return {
          platform,
          connected: !!account,
          accountId: account?.id,
          displayName: account?.display_name,
          handle: account?.handle,
          loading: !!account,
        };
      });

      setPlatforms(platformSummaries);
      setLoading(false);

      // Fetch insights for connected platforms
      for (const summary of platformSummaries) {
        if (summary.connected && summary.accountId) {
          fetchPlatformInsights(summary.platform, summary.accountId);
        }
      }
    } catch (err) {
      console.error('Error loading platforms:', err);
      setLoading(false);
    }
  };

  const fetchPlatformInsights = async (platform: string, accountId: string) => {
    try {
      const functionName = `${platform === 'x' ? 'x' : platform}-insights`;
      const response = await supabase.functions.invoke(functionName, {
        body: { accountId },
      });

      if (response.error || response.data.error) {
        setPlatforms(prev => prev.map(p => 
          p.platform === platform 
            ? { ...p, loading: false, error: response.data?.error || 'Failed to fetch' }
            : p
        ));
        return;
      }

      const data = response.data;
      let metrics: PlatformSummary['metrics'] = {};

      switch (platform) {
        case 'threads':
          metrics = {
            followers: data.userMetrics?.followers || 0,
            views: data.userMetrics?.views || 0,
            engagement: (data.userMetrics?.likes || 0) + (data.userMetrics?.replies || 0),
          };
          break;
        case 'instagram':
          metrics = {
            followers: data.profile?.followersCount || 0,
            views: data.metrics?.impressions || 0,
            engagement: data.metrics?.reach || 0,
          };
          break;
        case 'facebook':
          metrics = {
            followers: data.page?.fanCount || 0,
            views: data.metrics?.impressions || 0,
            engagement: data.metrics?.engagedUsers || 0,
          };
          break;
        case 'linkedin':
          metrics = {
            engagement: (data.metrics?.totalLikes || 0) + (data.metrics?.totalComments || 0),
          };
          break;
        case 'x':
          metrics = {
            followers: data.metrics?.followers || 0,
          };
          break;
        case 'youtube':
          metrics = {
            followers: data.metrics?.subscribers || 0,
            views: data.metrics?.totalViews || 0,
          };
          break;
      }

      setPlatforms(prev => prev.map(p => 
        p.platform === platform 
          ? { ...p, metrics, loading: false }
          : p
      ));
    } catch (err) {
      console.error(`Error fetching ${platform} insights:`, err);
      setPlatforms(prev => prev.map(p => 
        p.platform === platform 
          ? { ...p, loading: false, error: 'Failed to fetch' }
          : p
      ));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPlatforms(prev => prev.map(p => ({ ...p, loading: p.connected, error: undefined })));
    
    for (const platform of platforms) {
      if (platform.connected && platform.accountId) {
        await fetchPlatformInsights(platform.platform, platform.accountId);
      }
    }
    
    setRefreshing(false);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleExportCSV = () => {
    const exportData = connectedPlatforms.map(p => ({
      platform: p.platform,
      displayName: p.displayName || '',
      handle: p.handle || '',
      followers: p.metrics?.followers || 0,
      views: p.metrics?.views || 0,
      engagement: p.metrics?.engagement || 0,
    }));

    exportToCSV(exportData, [
      { key: 'platform', header: 'Platform' },
      { key: 'displayName', header: 'Account Name' },
      { key: 'handle', header: 'Handle' },
      { key: 'followers', header: 'Followers' },
      { key: 'views', header: 'Views' },
      { key: 'engagement', header: 'Engagement' },
    ], 'analytics_overview');

    toast({
      title: "Export complete",
      description: "Analytics data downloaded as CSV",
    });
  };

  const connectedPlatforms = platforms.filter(p => p.connected);
  const totalFollowers = connectedPlatforms.reduce((sum, p) => sum + (p.metrics?.followers || 0), 0);
  const totalViews = connectedPlatforms.reduce((sum, p) => sum + (p.metrics?.views || 0), 0);
  const totalEngagement = connectedPlatforms.reduce((sum, p) => sum + (p.metrics?.engagement || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Cross-Platform Overview</h2>
          <p className="text-sm text-muted-foreground">
            {connectedPlatforms.length} of {platforms.length} platforms connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            disabled={connectedPlatforms.length === 0 || platforms.some(p => p.loading)}
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
            Refresh All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
            <p className="text-2xl font-bold">{connectedPlatforms.length}</p>
            <p className="text-xs text-muted-foreground">platforms</p>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total Followers</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalFollowers)}</p>
            <p className="text-xs text-muted-foreground">across platforms</p>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Total Views</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalViews)}</p>
            <p className="text-xs text-muted-foreground">impressions</p>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <span className="text-xs text-muted-foreground">Engagement</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalEngagement)}</p>
            <p className="text-xs text-muted-foreground">interactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => {
          const config = platformConfig[platform.platform];
          const Icon = config?.icon || MessageCircle;

          return (
            <Card key={platform.platform} className={`hover-lift ${!platform.connected ? 'opacity-60' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${config?.bgColor} flex items-center justify-center ${config?.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold capitalize">{platform.platform}</h3>
                      {platform.connected ? (
                        <p className="text-xs text-muted-foreground">{platform.handle || platform.displayName}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not connected</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={platform.connected ? 'default' : 'outline'} className="text-xs">
                    {platform.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>

                {platform.connected && (
                  <>
                    {platform.loading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ) : platform.error ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle className="w-3 h-3" />
                        {platform.error}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {platform.metrics?.followers !== undefined && (
                          <div>
                            <p className="text-lg font-semibold">{formatNumber(platform.metrics.followers)}</p>
                            <p className="text-xs text-muted-foreground">Followers</p>
                          </div>
                        )}
                        {platform.metrics?.views !== undefined && (
                          <div>
                            <p className="text-lg font-semibold">{formatNumber(platform.metrics.views)}</p>
                            <p className="text-xs text-muted-foreground">Views</p>
                          </div>
                        )}
                        {platform.metrics?.engagement !== undefined && (
                          <div>
                            <p className="text-lg font-semibold">{formatNumber(platform.metrics.engagement)}</p>
                            <p className="text-xs text-muted-foreground">Engagement</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {!platform.connected && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href="/channels">
                      Connect <ArrowUpRight className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
