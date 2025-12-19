import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { 
  Plus, RefreshCw, Trash2, Check, AlertCircle, ExternalLink, 
  Loader2, Instagram, Facebook, Linkedin, Twitter, Video, MessageCircle, Cloud
} from "lucide-react";
import { PLATFORM_CONFIG, ProviderName } from "@/lib/social/types";

interface SocialAccount {
  id: string;
  platform: ProviderName;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  account_type: string;
  autopublish_capable: boolean;
  status: string;
  last_connected_at: string;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-5 h-5" />,
  facebook: <Facebook className="w-5 h-5" />,
  linkedin: <Linkedin className="w-5 h-5" />,
  x: <Twitter className="w-5 h-5" />,
  tiktok: <Video className="w-5 h-5" />,
  threads: <MessageCircle className="w-5 h-5" />,
  bluesky: <Cloud className="w-5 h-5" />,
};

const Channels = () => {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showBlueskyDialog, setShowBlueskyDialog] = useState(false);
  const [blueskyCredentials, setBlueskyCredentials] = useState({ identifier: '', appPassword: '' });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    
    // Check for callback params
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    
    if (connected) {
      toast({ title: "Channel Connected", description: `${connected} has been connected successfully!` });
      window.history.replaceState({}, '', '/channels');
    }
    if (error) {
      toast({ title: "Connection Failed", description: error, variant: "destructive" });
      window.history.replaceState({}, '', '/channels');
    }
  }, []);

  const loadAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's workspace
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;
      setWorkspaceId(membership.workspace_id);

      // Get connected accounts
      const { data: accountsData, error } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(accountsData || []);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const connectOAuthProvider = async (provider: ProviderName) => {
    if (!workspaceId) return;
    
    setConnecting(provider);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('social-auth/connect/' + provider, {
        body: {
          userId: user.id,
          workspaceId,
          returnUrl: '/channels',
        },
      });

      if (response.error) throw response.error;
      
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.data.error) {
        toast({
          title: "Configuration Required",
          description: response.data.message || `${provider} integration needs to be configured`,
          variant: "destructive",
        });
      }
    } catch (error) {
      handleError(error);
    } finally {
      setConnecting(null);
      setShowConnectDialog(false);
    }
  };

  const connectBluesky = async () => {
    if (!workspaceId || !blueskyCredentials.identifier || !blueskyCredentials.appPassword) return;
    
    setConnecting('bluesky');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('social-auth/bluesky-auth', {
        body: {
          ...blueskyCredentials,
          userId: user.id,
          workspaceId,
        },
      });

      if (response.error) throw response.error;
      
      if (response.data.success) {
        toast({ title: "Bluesky Connected", description: `Connected as ${response.data.account.handle}` });
        setShowBlueskyDialog(false);
        setBlueskyCredentials({ identifier: '', appPassword: '' });
        loadAccounts();
      } else {
        throw new Error(response.data.error || 'Connection failed');
      }
    } catch (error) {
      handleError(error);
    } finally {
      setConnecting(null);
    }
  };

  const disconnectAccount = async (accountId: string, platform: string) => {
    if (!workspaceId) return;
    
    try {
      const response = await supabase.functions.invoke('social-auth/disconnect/' + platform, {
        body: { accountId, workspaceId },
      });

      if (response.error) throw response.error;
      
      toast({ title: "Account Disconnected" });
      loadAccounts();
    } catch (error) {
      handleError(error);
    }
  };

  const platforms = Object.entries(PLATFORM_CONFIG) as [ProviderName, typeof PLATFORM_CONFIG[ProviderName]][];

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-fade-in">
          <div className="mb-8">
            <Skeleton className="h-9 w-32 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Channels</h1>
            <p className="text-muted-foreground mt-1">Connect and manage your social media accounts</p>
          </div>
          <Button onClick={() => setShowConnectDialog(true)} className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> Connect Channel
          </Button>
        </div>

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No channels connected</h3>
              <p className="text-muted-foreground mb-4">Connect your social media accounts to start publishing</p>
              <Button onClick={() => setShowConnectDialog(true)} className="bg-gradient-primary hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" /> Connect Your First Channel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => {
              const config = PLATFORM_CONFIG[account.platform];
              return (
                <Card key={account.id} className="hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-white`}
                          style={{ backgroundColor: config?.color || '#666' }}
                        >
                          {platformIcons[account.platform] || account.platform[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold">{account.display_name}</h3>
                          {account.handle && (
                            <p className="text-sm text-muted-foreground">{account.handle}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline" 
                              className={account.status === 'connected' 
                                ? "text-success border-success/30 bg-success/10" 
                                : "text-warning border-warning/30 bg-warning/10"
                              }
                            >
                              {account.status === 'connected' ? (
                                <><Check className="w-3 h-3 mr-1" />Connected</>
                              ) : (
                                <><AlertCircle className="w-3 h-3 mr-1" />{account.status}</>
                              )}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground mb-4">
                      {account.autopublish_capable ? (
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> Auto-publish supported</span>
                      ) : (
                        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-warning" /> Manual publish only</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => connectOAuthProvider(account.platform)}
                        disabled={connecting === account.platform}
                      >
                        {connecting === account.platform ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        Refresh
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => disconnectAccount(account.id, account.platform)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Connect Channel Dialog */}
        <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect a Channel</DialogTitle>
              <DialogDescription>Choose a social media platform to connect</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-4">
              {platforms.map(([key, config]) => {
                const isConnected = accounts.some(a => a.platform === key);
                return (
                  <Button
                    key={key}
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2 relative"
                    onClick={() => {
                      if (key === 'bluesky') {
                        setShowConnectDialog(false);
                        setShowBlueskyDialog(true);
                      } else {
                        connectOAuthProvider(key);
                      }
                    }}
                    disabled={connecting !== null}
                  >
                    {isConnected && (
                      <Badge className="absolute -top-2 -right-2 bg-success">
                        <Check className="w-3 h-3" />
                      </Badge>
                    )}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: config.color }}
                    >
                      {platformIcons[key] || key[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{config.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {config.oauthRequired ? 'OAuth' : 'App Password'}
                    </span>
                    {connecting === key && <Loader2 className="w-4 h-4 animate-spin absolute top-2 right-2" />}
                  </Button>
                );
              })}
            </div>
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                OAuth connections require API credentials configured in your environment. 
                Check the documentation for setup instructions.
              </AlertDescription>
            </Alert>
          </DialogContent>
        </Dialog>

        {/* Bluesky Auth Dialog */}
        <Dialog open={showBlueskyDialog} onOpenChange={setShowBlueskyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Bluesky</DialogTitle>
              <DialogDescription>
                Enter your Bluesky handle and an App Password. You can create an App Password in your Bluesky settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="identifier">Bluesky Handle</Label>
                <Input
                  id="identifier"
                  placeholder="yourname.bsky.social"
                  value={blueskyCredentials.identifier}
                  onChange={(e) => setBlueskyCredentials(prev => ({ ...prev, identifier: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="appPassword">App Password</Label>
                <Input
                  id="appPassword"
                  type="password"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={blueskyCredentials.appPassword}
                  onChange={(e) => setBlueskyCredentials(prev => ({ ...prev, appPassword: e.target.value }))}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Create an App Password at{' '}
                  <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener" className="text-primary hover:underline">
                    bsky.app/settings/app-passwords
                  </a>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBlueskyDialog(false)}>Cancel</Button>
              <Button 
                onClick={connectBluesky}
                disabled={!blueskyCredentials.identifier || !blueskyCredentials.appPassword || connecting === 'bluesky'}
                className="bg-gradient-primary hover:opacity-90"
              >
                {connecting === 'bluesky' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</>
                ) : (
                  'Connect'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Channels;
