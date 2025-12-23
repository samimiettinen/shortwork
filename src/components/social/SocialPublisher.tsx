import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { 
  Send, Loader2, AlertCircle, CheckCircle, Link2, Image, 
  Instagram, Facebook, Linkedin, Twitter, Video, MessageCircle, Cloud, Upload, X, Youtube, FileVideo, Play
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

interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
  name: string;
  size: number;
  thumbnailUrl?: string;
  duration?: number;
}

const platformIcons: Record<string, React.ReactNode> = {
  youtube: <Youtube className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
  linkedin: <Linkedin className="w-4 h-4" />,
  x: <Twitter className="w-4 h-4" />,
  tiktok: <Video className="w-4 h-4" />,
  threads: <MessageCircle className="w-4 h-4" />,
  bluesky: <Cloud className="w-4 h-4" />,
};

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface SocialPublisherProps {
  workspaceId: string;
}

export function SocialPublisher({ workspaceId }: SocialPublisherProps) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
    
    if (!isImage && !isVideo) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image (JPEG, PNG, GIF, WebP) or video (MP4, MOV, WebM)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 100MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate thumbnail for video files
      let thumbnailUrl: string | undefined;
      let duration: number | undefined;
      
      if (isVideo) {
        try {
          setUploadProgress(5);
          const thumbData = await generateVideoThumbnail(file);
          thumbnailUrl = thumbData.thumbnailUrl;
          duration = thumbData.duration;
          setUploadProgress(15);
        } catch (thumbError) {
          console.warn('Could not generate thumbnail:', thumbError);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${workspaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.storage
        .from('social-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('social-media')
        .getPublicUrl(data.path);

      setUploadProgress(100);
      
      setUploadedMedia({
        url: publicUrl,
        type: isVideo ? 'video' : 'image',
        name: file.name,
        size: file.size,
        thumbnailUrl,
        duration,
      });
      setMediaUrl(publicUrl);

      toast({
        title: "Upload complete",
        description: `${isVideo ? 'Video' : 'Image'} uploaded successfully`,
      });
    } catch (error) {
      handleError(error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeMedia = async () => {
    if (uploadedMedia) {
      // Extract file path from URL
      const urlParts = uploadedMedia.url.split('/social-media/');
      if (urlParts[1]) {
        await supabase.storage
          .from('social-media')
          .remove([urlParts[1]]);
      }
    }
    setUploadedMedia(null);
    setMediaUrl("");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateVideoThumbnail = (file: File): Promise<{ thumbnailUrl: string; duration: number }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadedmetadata = () => {
        // Seek to 25% of the video for a better thumbnail
        video.currentTime = video.duration * 0.25;
      };
      
      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        const duration = video.duration;
        
        // Cleanup
        URL.revokeObjectURL(video.src);
        video.remove();
        canvas.remove();
        
        resolve({ thumbnailUrl, duration });
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video'));
      };
      
      video.src = URL.createObjectURL(file);
    });
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
    
    // Check Instagram/TikTok/YouTube requires media
    const requiresMedia = accounts
      .filter(a => selectedAccounts.includes(a.id))
      .some(a => ['instagram', 'tiktok', 'youtube'].includes(a.platform));
    
    if (requiresMedia && !mediaUrl && !uploadedMedia) {
      errors.push("Selected platform(s) require an image or video");
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
        setUploadedMedia(null);
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

        {/* Media Upload */}
        <div>
          <Label className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Media (optional)
          </Label>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading || publishing}
          />

          {/* Upload area or preview */}
          {!uploadedMedia && !mediaUrl ? (
            <div 
              onClick={() => !uploading && !publishing && fileInputRef.current?.click()}
              className={`mt-1.5 border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
                ${uploading ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
            >
              {uploading ? (
                <div className="space-y-3">
                  <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                  <p className="text-sm font-medium">Uploading...</p>
                  <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium text-sm">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Images (JPEG, PNG, GIF, WebP) or Videos (MP4, MOV, WebM) up to 100MB
                  </p>
                  <div className="flex justify-center gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">
                      <Image className="w-3 h-3 mr-1" /> Images
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <FileVideo className="w-3 h-3 mr-1" /> Videos
                    </Badge>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-1.5 relative border rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div 
                  className={`w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 relative ${
                    uploadedMedia?.type === 'video' ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all' : ''
                  }`}
                  onClick={() => uploadedMedia?.type === 'video' && setVideoPreviewOpen(true)}
                  title={uploadedMedia?.type === 'video' ? 'Click to preview video' : undefined}
                >
                  {uploadedMedia?.type === 'video' ? (
                    <div className="relative w-full h-full bg-black flex items-center justify-center">
                      {uploadedMedia.thumbnailUrl ? (
                        <img 
                          src={uploadedMedia.thumbnailUrl} 
                          alt="Video thumbnail" 
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <video 
                          ref={videoRef}
                          src={uploadedMedia.url} 
                          className="absolute inset-0 w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                        <Play className="w-6 h-6 text-white drop-shadow-lg" />
                      </div>
                      {uploadedMedia.duration && (
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                          {formatDuration(uploadedMedia.duration)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <img 
                      src={uploadedMedia?.url || mediaUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {uploadedMedia?.name || 'External media URL'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {uploadedMedia?.type === 'video' ? (
                        <><FileVideo className="w-3 h-3 mr-1" /> Video</>
                      ) : (
                        <><Image className="w-3 h-3 mr-1" /> Image</>
                      )}
                    </Badge>
                    {uploadedMedia?.size && (
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedMedia.size)}
                      </span>
                    )}
                    {uploadedMedia?.duration && (
                      <span className="text-xs text-muted-foreground">
                        • {formatDuration(uploadedMedia.duration)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeMedia}
                  disabled={publishing}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Alternative: URL input */}
          {!uploadedMedia && !mediaUrl && (
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Or paste a media URL</Label>
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://... (image or video URL)"
                className="mt-1"
                disabled={publishing || uploading}
              />
            </div>
          )}
        </div>

        {/* Link URL */}
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

      {/* Video Preview Modal */}
      <Dialog open={videoPreviewOpen} onOpenChange={setVideoPreviewOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <DialogTitle className="text-white truncate pr-8">
              {uploadedMedia?.name || 'Video Preview'}
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video bg-black">
            {uploadedMedia?.type === 'video' && videoPreviewOpen && (
              <video
                src={uploadedMedia.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
                controlsList="nodownload"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
          {uploadedMedia?.duration && (
            <div className="absolute bottom-4 left-4 flex items-center gap-3 text-white/80 text-sm">
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                <FileVideo className="w-3 h-3 mr-1" />
                {formatDuration(uploadedMedia.duration)}
              </Badge>
              {uploadedMedia.size && (
                <span className="text-white/60">
                  {formatFileSize(uploadedMedia.size)}
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
