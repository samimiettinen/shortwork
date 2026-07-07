import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { Calendar, Clock, Upload, X, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface SocialAccount {
  id: string;
  platform: string;
  display_name: string;
  handle: string | null;
  status: string;
}

interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
  duration?: number;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/webm'];

export function SchedulePost({ workspaceId }: { workspaceId: string }) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('social_accounts')
        .select('id, platform, display_name, handle, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected');
      setAccounts((data as any) || []);
    })();
  }, [workspaceId]);

  const probeVideo = (file: File) => new Promise<{width:number;height:number;duration:number}>((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
    v.onerror = () => reject(new Error('video probe failed'));
    v.src = URL.createObjectURL(file);
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: 'Invalid file type', variant: 'destructive' }); return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Max 100MB', variant: 'destructive' }); return;
    }
    setUploading(true); setProgress(10);
    try {
      const isVideo = file.type.startsWith('video/');
      let meta: any = {};
      if (isVideo) { try { meta = await probeVideo(file); } catch {} }
      setProgress(30);
      const ext = file.name.split('.').pop();
      const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const iv = setInterval(() => setProgress(p => Math.min(p + 10, 90)), 200);
      const { data, error } = await supabase.storage.from('social-media').upload(path, file);
      clearInterval(iv);
      if (error) throw error;
      // Private bucket — signed URL for preview + publish (backend re-signs)
      const { data: signed, error: signErr } = await supabase.storage
        .from('social-media')
        .createSignedUrl(data.path, 60 * 60 * 24);
      if (signErr || !signed?.signedUrl) throw signErr || new Error('Could not sign upload URL');
      setProgress(100);
      setMedia({ url: signed.signedUrl, type: isVideo ? 'video' : 'image', ...meta });
      toast({ title: 'Upload complete' });
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(false); setProgress(0);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeMedia = async () => {
    if (media) {
      const parts = media.url.split('/social-media/');
      if (parts[1]) await supabase.storage.from('social-media').remove([parts[1].split('?')[0]]);
    }
    setMedia(null);
  };

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const schedule = async () => {
    if (!content.trim()) { toast({ title: 'Content required', variant: 'destructive' }); return; }
    if (selected.length === 0) { toast({ title: 'Pick at least one channel', variant: 'destructive' }); return; }
    if (!date || !time) { toast({ title: 'Pick a date and time', variant: 'destructive' }); return; }

    const scheduledAt = new Date(`${date}T${time}`);
    if (isNaN(scheduledAt.getTime())) { toast({ title: 'Invalid date/time', variant: 'destructive' }); return; }
    if (scheduledAt.getTime() < Date.now() + 30_000) {
      toast({ title: 'Pick a time at least 30 seconds in the future', variant: 'destructive' }); return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const perChannel: any = {};
      if (media) {
        perChannel.media_url = media.url;
        perChannel.media_type = media.type;
        if (media.width || media.height || media.duration) {
          perChannel.media_meta = {
            width: media.width,
            height: media.height,
            durationSeconds: media.duration,
          };
        }
      }

      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({
          workspace_id: workspaceId,
          created_by: user.id,
          status: 'scheduled',
          title: content.split('\n')[0].slice(0, 120),
          body_text: content,
          link_url: linkUrl || null,
          scheduled_at: scheduledAt.toISOString(),
          per_channel_overrides: perChannel,
        })
        .select()
        .single();
      if (postErr) throw postErr;

      const selectedAccounts = accounts.filter(a => selected.includes(a.id));
      const { data: targets, error: tErr } = await supabase
        .from('post_targets')
        .insert(selectedAccounts.map(a => ({
          post_id: post.id,
          social_account_id: a.id,
          platform: a.platform as any,
          status: 'queued' as const,
        })))
        .select();
      if (tErr) throw tErr;

      const { error: jErr } = await supabase
        .from('publish_jobs')
        .insert((targets || []).map((t: any) => ({
          post_target_id: t.id,
          run_at: scheduledAt.toISOString(),
          status: 'queued' as const,
          idempotency_key: `${post.id}:${t.id}`,
        })));
      if (jErr) throw jErr;

      toast({ title: 'Scheduled', description: `${targets?.length ?? 0} channels queued for ${scheduledAt.toLocaleString()}` });
      setContent(""); setLinkUrl(""); setDate(""); setTime(""); setSelected([]); setMedia(null);
      navigate('/queue');
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader><CardTitle>Schedule Post</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Content</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="mt-1.5 min-h-[150px] resize-none"
          />
          <div className="text-xs text-muted-foreground mt-1">{content.length} characters</div>
        </div>

        <div>
          <Label>Link (optional)</Label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="mt-1.5" />
        </div>

        <div>
          <Label>Media (optional)</Label>
          {!media ? (
            <div
              onClick={() => fileInput.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer mt-1.5"
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drop media here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">Images or MP4/MOV/WebM up to 100MB</p>
              <input ref={fileInput} type="file" accept={ACCEPTED.join(',')} onChange={handleFile} className="hidden" />
            </div>
          ) : (
            <div className="mt-1.5 p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{media.type} uploaded</div>
                  {media.width && media.height && (
                    <div className="text-xs text-muted-foreground">{media.width}×{media.height}{media.duration ? ` · ${Math.round(media.duration)}s` : ''}</div>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={removeMedia}><X className="w-4 h-4" /></Button>
            </div>
          )}
          {uploading && <Progress value={progress} className="mt-2" />}
        </div>

        <div>
          <Label>Channels</Label>
          {accounts.length === 0 ? (
            <Alert className="mt-1.5">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>No connected channels. <a href="/channels" className="underline">Connect one</a> first.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {accounts.map(a => (
                <label key={a.id} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${selected.includes(a.id) ? 'border-primary bg-primary/5' : ''}`}>
                  <Checkbox checked={selected.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.display_name}</div>
                    <Badge variant="secondary" className="text-xs capitalize">{a.platform}</Badge>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Date</Label>
            <div className="relative mt-1.5">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10" min={minDate} />
            </div>
          </div>
          <div>
            <Label>Time</Label>
            <div className="relative mt-1.5">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="pl-10" />
            </div>
          </div>
        </div>

        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Scheduled posts publish automatically at the specified time (interpreted in your browser's timezone).
            A background worker runs every minute — small delays are normal.
          </AlertDescription>
        </Alert>

        <Button
          onClick={schedule}
          disabled={saving || uploading || accounts.length === 0}
          className="w-full bg-gradient-primary hover:opacity-90"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
          Schedule Post
        </Button>
      </CardContent>
    </Card>
  );
}
