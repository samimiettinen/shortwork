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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { 
  Plus, RefreshCw, Trash2, Check, AlertCircle, ExternalLink, 
  Loader2, Instagram, Facebook, Linkedin, Twitter, Video, MessageCircle, Cloud, Youtube, HelpCircle, Zap, AlertTriangle, XCircle, RotateCcw
} from "lucide-react";
import { PLATFORM_CONFIG, ProviderName } from "@/lib/social/types";
import { ChannelSetupWizard } from "@/components/channels/ChannelSetupWizard";
import { ConnectionTroubleshooting } from "@/components/channels/ConnectionTroubleshooting";

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
  youtube: <Youtube className="w-5 h-5" />,
  instagram: <Instagram className="w-5 h-5" />,
  facebook: <Facebook className="w-5 h-5" />,
  linkedin: <Linkedin className="w-5 h-5" />,
  x: <Twitter className="w-5 h-5" />,
  tiktok: <Video className="w-5 h-5" />,
  threads: <MessageCircle className="w-5 h-5" />,
  bluesky: <Cloud className="w-5 h-5" />,
};

const platformTooltips: Record<string, string> = {
  youtube: "Requires a Google account with a YouTube channel. Authorizes access to channel data and video publishing.",
  instagram: "Requires Instagram Business/Creator account linked to a Facebook Page. Personal accounts not supported.",
  facebook: "Requires admin access to a Facebook Page. Personal profiles cannot be connected via API.",
  linkedin: "Connect your personal profile or a Company Page you manage via LinkedIn OAuth.",
  x: "Works with personal and business X accounts. Authorizes posting on your behalf.",
  tiktok: "Connect your TikTok account. Note: Videos may need to be finalized in the TikTok app.",
  threads: "Requires Threads account linked to Instagram. Uses Meta's Threads API via OAuth.",
  bluesky: "Uses App Passwords (not OAuth). Create one at bsky.app/settings/app-passwords.",
};

const Channels = () => {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showBlueskyDialog, setShowBlueskyDialog] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [blueskyCredentials, setBlueskyCredentials] = useState({ identifier: '', appPassword: '' });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [checkingTokens, setCheckingTokens] = useState(false);
  const [tokenCheckResults, setTokenCheckResults] = useState<{
    checked: number;
    expired: number;
    refreshed: number;
  } | null>(null);

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

  // Automatic token refresh check on page load
  useEffect(() => {
    if (accounts.length > 0 && workspaceId && !checkingTokens) {
      checkTokenStatus();
    }
  }, [accounts.length, workspaceId]);

  const checkTokenStatus = async () => {
    if (!workspaceId || accounts.length === 0) return;
    
    setCheckingTokens(true);
    try {
      // Get tokens for all accounts
      const accountIds = accounts.map(a => a.id);
      const { data: tokens, error } = await supabase
        .from('oauth_tokens')
        .select('social_account_id, expires_at, updated_at')
        .in('social_account_id', accountIds);

      if (error) throw error;

      const now = new Date();
      const expirationThreshold = 24 * 60 * 60 * 1000; // 24 hours
      let expiredCount = 0;
      let refreshedCount = 0;
      const accountsNeedingRefresh: string[] = [];

      tokens?.forEach(token => {
        if (token.expires_at) {
          const expiresAt = new Date(token.expires_at);
          const timeUntilExpiry = expiresAt.getTime() - now.getTime();
          
          // Token expired or expires within 24 hours
          if (timeUntilExpiry < expirationThreshold) {
            expiredCount++;
            accountsNeedingRefresh.push(token.social_account_id);
          }
        }
      });

      // Update account status for expired tokens
      if (accountsNeedingRefresh.length > 0) {
        const { error: updateError } = await supabase
          .from('social_accounts')
          .update({ status: 'needs_refresh' })
          .in('id', accountsNeedingRefresh)
          .eq('status', 'connected');

        if (!updateError) {
          // Reload accounts to reflect new status
          await loadAccounts();
        }
      }

      setTokenCheckResults({
        checked: tokens?.length || 0,
        expired: expiredCount,
        refreshed: refreshedCount,
      });

      // Show notification if there are expired tokens
      if (expiredCount > 0) {
        toast({
          title: "Token Check Complete",
          description: `${expiredCount} channel${expiredCount > 1 ? 's need' : ' needs'} to be reconnected.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Token check failed:', error);
    } finally {
      setCheckingTokens(false);
    }
  };

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
        // Check if we're in an iframe (preview mode) - OAuth providers block iframe embedding
        const isInIframe = window.self !== window.top;
        
        if (isInIframe) {
          // Open OAuth in a popup window to avoid X-Frame-Options blocking
          const width = 600;
          const height = 700;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;
          
          const popup = window.open(
            response.data.authUrl,
            `${provider}_oauth`,
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
          );
          
          if (!popup) {
            toast({
              title: "Pop-up Blocked",
              description: "Please allow pop-ups for this site to connect your account, or open this page in a new tab.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Authorization Window Opened",
              description: `Complete the ${provider} authorization in the popup window. This page will refresh when done.`,
            });
            
            // Poll to check if popup is closed and refresh accounts
            const pollTimer = setInterval(() => {
              if (popup.closed) {
                clearInterval(pollTimer);
                loadAccounts();
                setConnecting(null);
              }
            }, 1000);
          }
        } else {
          // Normal redirect for non-iframe context
          window.location.href = response.data.authUrl;
        }
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
      if (window.self === window.top) {
        setConnecting(null);
      }
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
          <div className="flex items-center gap-3">
            {checkingTokens && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking tokens...
              </div>
            )}
            {!checkingTokens && tokenCheckResults && tokenCheckResults.expired > 0 && (
              <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {tokenCheckResults.expired} expired
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={checkTokenStatus}
              disabled={checkingTokens || loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${checkingTokens ? 'animate-spin' : ''}`} />
              Check Tokens
            </Button>
            <Button onClick={() => setShowConnectDialog(true)} className="bg-gradient-primary hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" /> Connect Channel
            </Button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <ChannelSetupWizard
            onConnect={connectOAuthProvider}
            onBlueskyConnect={() => setShowBlueskyDialog(true)}
            connecting={connecting}
            onCancelConnect={() => setConnecting(null)}
          />
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
                              className={
                                account.status === 'connected' 
                                  ? "text-success border-success/30 bg-success/10" 
                                  : account.status === 'error' || account.status === 'disconnected'
                                  ? "text-destructive border-destructive/30 bg-destructive/10"
                                  : "text-warning border-warning/30 bg-warning/10"
                              }
                            >
                              {account.status === 'connected' ? (
                                <><Check className="w-3 h-3 mr-1" />Connected</>
                              ) : account.status === 'needs_refresh' ? (
                                <><AlertTriangle className="w-3 h-3 mr-1" />Needs Reconnect</>
                              ) : account.status === 'error' ? (
                                <><XCircle className="w-3 h-3 mr-1" />Error</>
                              ) : (
                                <><AlertCircle className="w-3 h-3 mr-1" />{account.status}</>
                              )}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Reconnect Alert for expired/error accounts */}
                    {(account.status === 'needs_refresh' || account.status === 'error' || account.status === 'disconnected') && (
                      <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-warning font-medium mb-2">
                              {account.status === 'needs_refresh' 
                                ? "Token expired. Reconnect to continue publishing."
                                : account.status === 'error'
                                ? "Connection error. Try reconnecting."
                                : "Account disconnected. Reconnect to restore access."
                              }
                            </p>
                            <Button 
                              size="sm" 
                              className="bg-warning text-warning-foreground hover:bg-warning/90 h-7 text-xs"
                              onClick={() => {
                                if (account.platform === 'bluesky') {
                                  setShowBlueskyDialog(true);
                                } else {
                                  connectOAuthProvider(account.platform);
                                }
                              }}
                              disabled={connecting === account.platform}
                            >
                              {connecting === account.platform ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Reconnecting...</>
                              ) : (
                                <><RotateCcw className="w-3 h-3 mr-1" />Reconnect Now</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

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

        {/* Troubleshooting Section - show when there are connected accounts */}
        {accounts.length > 0 && (
          <div className="mt-8">
            <ConnectionTroubleshooting />
          </div>
        )}

        {/* Connect Channel Dialog */}
        <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Connect a Channel</DialogTitle>
              <DialogDescription>Choose a social media platform to connect</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Platform Grid */}
              <div className="grid grid-cols-2 gap-3">
                <TooltipProvider delayDuration={200}>
                  {platforms.map(([key, config]) => {
                    const isConnected = accounts.some(a => a.platform === key);
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <Button
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
                            <HelpCircle className="w-3 h-3 absolute top-2 right-2 text-muted-foreground" />
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
                            {connecting === key && <Loader2 className="w-4 h-4 animate-spin absolute top-2 left-2" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px] text-center">
                          <p className="text-xs">{platformTooltips[key]}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>

              {/* Connection Instructions */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  Connection Requirements
                </h4>
                
                <div className="grid gap-3 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium flex items-center gap-2 mb-1">
                      {platformIcons.youtube} YouTube
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Requires a Google account with a YouTube channel. You'll be redirected to Google to authorize access to your channel data and video publishing.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium flex items-center gap-2 mb-1">
                      {platformIcons.instagram} Instagram & {platformIcons.facebook} Facebook
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Requires a Facebook account connected to an Instagram Business or Creator account. Personal Instagram accounts cannot be connected via API. You must have admin access to the Facebook Page linked to your Instagram.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium flex items-center gap-2 mb-1">
                      {platformIcons.threads} Threads
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Requires a Threads account linked to Instagram. Uses Meta's Threads API with OAuth. You'll authorize access through your Instagram/Facebook login.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium flex items-center gap-2 mb-1">
                      {platformIcons.x} X (Twitter)
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Requires an X account. You'll be redirected to X to authorize the app to post on your behalf. Works with both personal and business accounts.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium flex items-center gap-2 mb-1">
                      {platformIcons.linkedin} LinkedIn
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Requires a LinkedIn account. You can connect your personal profile or a Company Page you manage. Authorization is done through LinkedIn's OAuth flow.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium flex items-center gap-2 mb-1">
                      {platformIcons.tiktok} TikTok
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Requires a TikTok account. Note: TikTok's API has limited functionality – videos may need to be finalized in the TikTok app.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium flex items-center gap-2 mb-1">
                      {platformIcons.bluesky} Bluesky
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Uses App Passwords instead of OAuth. Create an App Password in your Bluesky account settings, then enter your handle and the generated password.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowConnectDialog(false);
                  setShowWizard(true);
                }}
                className="text-primary"
              >
                <Zap className="w-4 h-4 mr-2" />
                Use Setup Wizard
              </Button>
              <Alert className="flex-1 ml-4">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Pop-ups must be enabled for OAuth.
                </AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>

        {/* Setup Wizard Dialog */}
        <Dialog open={showWizard} onOpenChange={setShowWizard}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
            <div className="p-6">
              <ChannelSetupWizard
                onConnect={(provider) => {
                  setShowWizard(false);
                  connectOAuthProvider(provider);
                }}
                onBlueskyConnect={() => {
                  setShowWizard(false);
                  setShowBlueskyDialog(true);
                }}
                connecting={connecting}
                onCancelConnect={() => setConnecting(null)}
              />
            </div>
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
