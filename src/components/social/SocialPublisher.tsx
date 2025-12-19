import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { 
  Send, Loader2, AlertCircle, CheckCircle, Link2, Image, 
  Instagram, Facebook, Linkedin, Twitter, Video, MessageCircle, Cloud
} from "lucide-react";
import { PLATFORM_CONFIG, ProviderName } from "@/lib/social/types";

interface SocialAccount {
  id: string;
  platform: ProviderName;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  status: string;
}

interface PublishResult {
  accountId: string;
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
  linkedin: <Linkedin className="w-4 h-4" />,
  x: <Twitter className="w-4 h-4" />,
  tiktok: <Video className="w-4 h-4" />,
  threads: <MessageCircle className="w-4 h-4" />,
  bluesky: <Cloud className="w-4 h-4" />,
};

interface SocialPublisherProps {
  workspaceId: string;
}

export function SocialPublisher({ workspaceId }: SocialPublisherProps) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);

  useEffect(() => {
    loadAccounts();
  }, [workspaceId]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, platform, display_name, handle, avatar_url, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
    setResults(null);
  };

  const getContentLimit = () => {
    if (selectedAccounts.length === 0) return 2200;
    
    const selectedPlatforms = accounts
      .filter(a => selectedAccounts.includes(a.id))
      .map(a => a.platform);
    
    return Math.min(...selectedPlatforms.map(p => PLATFORM_CONFIG[p]?.maxLength || 2200));
  };

  const validateContent = (): string[] => {
    const errors: string[] = [];
    
    if (!content.trim()) {
      errors.push("Please enter some content");
    }
    
    if (selectedAccounts.length === 0) {
      errors.push("Please select at least one channel");
    }
    
    const limit = getContentLimit();
    if (content.length > limit) {
      errors.push(`Content exceeds character limit (${content.length}/${limit})`);
    }
    
    // Check Instagram requires media
    const hasInstagram = accounts
      .filter(a => selectedAccounts.includes(a.id))
      .some(a => a.platform === 'instagram');
    
    if (hasInstagram && !mediaUrl) {
      errors.push("Instagram requires an image or video");
    }
    
    return errors;
  };

  const handlePublish = async () => {
    const errors = validateContent();
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(". "),
        variant: "destructive",
      });
      return;
    }

    setPublishing(true);
    setResults(null);

    try {
      const response = await supabase.functions.invoke('social-publish', {
        body: {
          workspaceId,
          content,
          linkUrl: linkUrl || undefined,
          mediaUrl: mediaUrl || undefined,
          targetAccountIds: selectedAccounts,
        },
      });

      if (response.error) throw response.error;

      const data = response.data;
      setResults(data.results);

      if (data.status === 'published') {
        toast({
          title: "Published Successfully!",
          description: `Posted to ${data.summary.succeeded} channel(s)`,
        });
        // Clear form on success
        setContent("");
        setLinkUrl("");
        setMediaUrl("");
        setSelectedAccounts([]);
      } else if (data.status === 'partial') {
        toast({
          title: "Partially Published",
          description: `${data.summary.succeeded} succeeded, ${data.summary.failed} failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Publishing Failed",
          description: "Could not publish to any channels",
          variant: "destructive",
        });
      }
    } catch (error) {
      handleError(error);
    } finally {
      setPublishing(false);
    }
  };

  const isOverLimit = content.length > getContentLimit();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No connected channels found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your social accounts in the Channels page first
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish to Social Media</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Content */}
        <div>
          <Label>Content</Label>
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setResults(null);
            }}
            placeholder="What do you want to share?"
            className={`mt-1.5 min-h-[120px] ${isOverLimit ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            disabled={publishing}
          />
          <div className="flex justify-between mt-1">
            <p className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {content.length}/{getContentLimit()} characters
            </p>
            {isOverLimit && (
              <p className="text-xs text-destructive">Content too long for selected channels</p>
            )}
          </div>
        </div>

        {/* Link & Media */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Link URL (optional)
            </Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1.5"
              disabled={publishing}
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <Image className="w-4 h-4" /> Media URL (optional)
            </Label>
            <Input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://... (image or video URL)"
              className="mt-1.5"
              disabled={publishing}
            />
          </div>
        </div>

        {/* Channel Selection */}
        <div>
          <Label>Publish to</Label>
          <div className="mt-2 space-y-2">
            {accounts.map((account) => {
              const config = PLATFORM_CONFIG[account.platform];
              const isSelected = selectedAccounts.includes(account.id);
              const result = results?.find(r => r.accountId === account.id);
              
              return (
                <label
                  key={account.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  } ${publishing ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !publishing && toggleAccount(account.id)}
                    disabled={publishing}
                  />
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: config?.color || '#666' }}
                  >
                    {platformIcons[account.platform]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{account.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {config?.displayName} {account.handle && `• ${account.handle}`}
                    </p>
                  </div>
                  
                  {/* Result status */}
                  {result && (
                    <Badge variant={result.success ? "default" : "destructive"} className="ml-auto">
                      {result.success ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Posted</>
                      ) : (
                        <><AlertCircle className="w-3 h-3 mr-1" /> Failed</>
                      )}
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {results && results.some(r => !r.success) && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <ul className="mt-1 space-y-1">
                {results.filter(r => !r.success).map((r, i) => (
                  <li key={i} className="text-sm">
                    <strong>{r.platform}:</strong> {r.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Publish Button */}
        <Button
          onClick={handlePublish}
          disabled={publishing || selectedAccounts.length === 0 || !content.trim() || isOverLimit}
          className="w-full bg-gradient-primary hover:opacity-90"
        >
          {publishing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" /> Publish to {selectedAccounts.length} Channel{selectedAccounts.length !== 1 ? 's' : ''}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
