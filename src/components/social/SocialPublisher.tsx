import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { Send, Calendar, Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { PLATFORM_CONFIG, type ProviderName } from '@/lib/social/types';
import { uploadMedia, mediaMetadata, type UploadedMedia } from '@/lib/social/media';
import { sendPublish, type PublishResponse } from '@/lib/social/publish';
import { IMAGE_TYPES, VIDEO_TYPES, PLATFORM_LIMITS, platformVariant, validateForPlatform,
  type PublishPayload, type Platform, type PlatformOverrides } from '../../../supabase/functions/_shared/publishing-contract';

interface SocialAccount { id: string; platform: ProviderName; display_name: string; handle: string | null }
interface LocalVariant { content?: string; title?: string; localTime?: string }
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// A single composer stays mounted when changing delivery mode: the master
// media, caption and per-network edits are never uploaded or entered twice.
export function SocialPublisher({ workspaceId, mode = 'publish' }: { workspaceId: string; mode?: 'publish' | 'schedule' }) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [variants, setVariants] = useState<Partial<Record<Platform, LocalVariant>>>({});
  const [verticalShort, setVerticalShort] = useState(true);
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'public'>('private');
  const [madeForKids, setMadeForKids] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('youtube');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [receipt, setReceipt] = useState<PublishResponse | null>(null);
  const chosen = accounts.filter(a => selected.includes(a.id));
  const platforms = [...new Set(chosen.map(a => a.platform))];
  const busy = publishing || uploading;
  useEffect(() => { requestId.current = crypto.randomUUID(); },
    [workspaceId, selected, content, videoTitle, linkUrl, media, variants, verticalShort, visibility, madeForKids, shareToFeed, date, time, mode]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from('social_accounts').select('id, platform, display_name, handle')
      .eq('workspace_id', workspaceId).eq('status', 'connected').then(({ data, error }) => {
        if (!active) return;
        if (error) handleError(error);
        else setAccounts(data || []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [workspaceId, handleError]);

  const platformOverrides: PlatformOverrides = Object.fromEntries(Object.entries(variants).map(([platform, value]) =>
    [platform, { content: value.content || undefined, title: value.title || undefined }]));
  const base: PublishPayload = { workspaceId, requestId: requestId.current, content, videoTitle: videoTitle || undefined,
    targetAccountIds: selected, linkUrl: linkUrl || undefined, mediaPath: media?.path, mediaType: media?.type,
    mediaMeta: mediaMetadata(media), youtubeVisibility: visibility, verticalShort, platformOverrides,
    youtubeMadeForKids: madeForKids, instagramShareToFeed: shareToFeed };
  const errorsFor = (platform: string) => validateForPlatform(platform, { ...platformVariant(base, platform), hasMedia: !!media });
  const errors = [...new Set(platforms.flatMap(errorsFor))];
  if (platforms.length && (!content.trim() || content.length > 10000)) errors.unshift('Enter a master caption between 1 and 10,000 characters');
  const preview = platformVariant(base, previewPlatform);
  const editVariant = (platform: Platform, key: keyof LocalVariant, value: string) =>
    setVariants(current => ({ ...current, [platform]: { ...current[platform], [key]: value } }));

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    setUploading(true);
    try { setMedia(await uploadMedia(workspaceId, file)); setReceipt(null); }
    catch (error) { handleError(error); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const submit = async () => {
    if (busy) return;
    const problems = [...errors];
    if (!selected.length) problems.push('Select at least one connected channel');
    const payload = { ...base, platformOverrides: { ...platformOverrides } };
    if (mode === 'schedule') {
      const scheduled = new Date(`${date}T${time}`);
      if (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() < Date.now()+30_000) problems.push('Choose a time at least 30 seconds in the future');
      else payload.scheduledAt = scheduled.toISOString();
      for (const platform of platforms) {
        const localTime = variants[platform]?.localTime;
        if (!localTime) continue;
        const scheduled = new Date(localTime);
        if (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() < Date.now()+30_000) problems.push(`Choose a valid future time for ${PLATFORM_CONFIG[platform].displayName}`);
        else payload.platformOverrides[platform] = { ...payload.platformOverrides[platform], scheduledAt: scheduled.toISOString() };
      }
    }
    if (problems.length) { toast({ title: 'Check your post', description: problems.join('. '), variant: 'destructive' }); return; }
    setPublishing(true);
    try {
      const response = await sendPublish(payload);
      setReceipt(response);
      if (response.status === 'scheduled') {
        toast({ title: 'Scheduled', description: `${response.summary.total} channels. Track each destination in Queue.` });
        navigate('/queue');
      } else {
        toast({ title: response.status === 'published' ? 'Published' : response.status === 'publishing' ? 'Publishing is in progress' : 'Publishing results',
          description: `${response.summary.succeeded} published, ${response.summary.needsAction} need attention, ${response.summary.failed} failed.` });
        if (response.status !== 'publishing') setSelected(response.results.filter(r => !r.success && !r.needsUserAction).map(r => r.accountId));
      }
    } catch (error) { handleError(error); }
    finally { setPublishing(false); }
  };

  if (loading) return <div role="status" className="p-8"><Loader2 className="w-6 h-6 animate-spin" />Loading channels…</div>;
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <Card><CardHeader><CardTitle>One video, every connected channel</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <fieldset disabled={busy} className="space-y-5 min-w-0">
          <div className="space-y-2">
            <Label>Master video</Label>
            <input ref={fileInput} type="file" className="hidden" onChange={handleFile} accept={[...VIDEO_TYPES, ...IMAGE_TYPES].join(',')} />
            {!media ? <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} {uploading ? 'Reading and uploading…' : 'Upload video'}
            </Button> : <div className="rounded-lg border p-3 flex items-center justify-between gap-2">
              <div><p className="font-medium text-sm">{media.name}</p><p className="text-xs text-muted-foreground">
                {media.width && `${media.width} × ${media.height} · ${media.duration?.toFixed(1)}s · `}{media.size < 1024*1024 ? `${(media.size/1024).toFixed(1)} KiB` : `${(media.size/1024/1024).toFixed(1)} MiB`}
              </p></div>
              <Button aria-label="Remove media" size="icon" variant="ghost" onClick={() => setMedia(null)}><X className="w-4 h-4" /></Button>
            </div>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={verticalShort} onCheckedChange={value => setVerticalShort(value === true)} /> Reel/Short mode · 9:16 vertical</label>
            <p className="text-xs text-muted-foreground">Use one MP4 with H.264 video and AAC audio, ideally 1080 × 1920. For every destination including Facebook Reels, use 4–90 seconds and up to 100 MiB.</p>
          </div>
          <div className="space-y-1"><Label htmlFor="master-caption">Caption</Label>
            <Textarea id="master-caption" value={content} onChange={e => setContent(e.target.value)} placeholder="What do you want to share?" className="min-h-[130px]" />
            <p className="text-xs text-muted-foreground">{content.length} characters · customize shorter versions below for X and Bluesky.</p>
          </div>
          <div className="space-y-1"><Label htmlFor="video-title">Video title (optional)</Label>
            <Input id="video-title" value={videoTitle} maxLength={100} onChange={e => setVideoTitle(e.target.value)} placeholder="Uses the first caption line if left empty" />
          </div>
          <div className="space-y-1"><Label htmlFor="post-link">Link (optional)</Label>
            <Input id="post-link" type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex items-center justify-between gap-2"><Label>Destinations</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => { setSelected(accounts.map(a => a.id)); setReceipt(null); }}>Select all connected</Button>
          </div>
          {!accounts.length && <p className="text-sm text-muted-foreground">Connect accounts in <Link to="/channels" className="underline">Channels</Link> to publish.</p>}
          <div className="space-y-2">{accounts.map(account => {
            const result = receipt?.results.find(r => r.accountId === account.id);
            return <label key={account.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox checked={selected.includes(account.id)} onCheckedChange={() => { setSelected(ids => ids.includes(account.id) ? ids.filter(id => id !== account.id) : [...ids, account.id]); }} />
              <span className="h-7 w-1 rounded" style={{ backgroundColor: PLATFORM_CONFIG[account.platform]?.color }} />
              <span className="flex-1 text-sm"><span className="font-medium">{account.display_name}</span><span className="block text-xs text-muted-foreground">{PLATFORM_CONFIG[account.platform]?.displayName}</span></span>
              {result ? <Badge variant={result.success ? 'default' : 'secondary'}>{result.success ? 'Posted' : result.needsUserAction ? 'Action needed' : receipt?.status === 'publishing' ? 'In progress' : 'Failed'}</Badge>
                : selected.includes(account.id) && <Badge variant={errorsFor(account.platform).length ? 'destructive' : 'secondary'}>{errorsFor(account.platform).length ? 'Check' : account.platform === 'tiktok' ? 'Inbox handoff' : 'Ready'}</Badge>}
            </label>;
          })}</div>
          {platforms.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Customize by network</h3>
            {platforms.map(platform => {
              const variant = platformVariant(base, platform);
              return <details key={platform} className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">{PLATFORM_CONFIG[platform].displayName} <span className="text-muted-foreground font-normal">· {variant.content.length}/{PLATFORM_LIMITS[platform]} characters</span></summary>
                <div className="mt-3 space-y-3">
                  <Label htmlFor={`caption-${platform}`}>{PLATFORM_CONFIG[platform].displayName} caption</Label>
                  <Textarea id={`caption-${platform}`} value={variants[platform]?.content || ''} placeholder="Use the master caption" onChange={e => editVariant(platform, 'content', e.target.value)} />
                  {['youtube', 'facebook', 'linkedin'].includes(platform) && <div>
                    <Label htmlFor={`title-${platform}`}>{PLATFORM_CONFIG[platform].displayName} title</Label>
                    <Input id={`title-${platform}`} value={variants[platform]?.title || ''} maxLength={100} placeholder="Use the master title" onChange={e => editVariant(platform, 'title', e.target.value)} />
                  </div>}
                  {mode === 'schedule' && <div><Label htmlFor={`time-${platform}`}>{PLATFORM_CONFIG[platform].displayName} publishing time (optional)</Label>
                    <Input id={`time-${platform}`} type="datetime-local" value={variants[platform]?.localTime || ''} onChange={e => editVariant(platform, 'localTime', e.target.value)} />
                  </div>}
                  {platform === 'tiktok' && <p className="text-xs text-muted-foreground">This caption is kept in your publishing plan. Paste it in TikTok when completing the inbox upload.</p>}
                </div>
              </details>;
            })}
          </div>}
          {platforms.includes('youtube') && <div className="rounded-lg border p-3 space-y-3">
            <Label htmlFor="youtube-visibility">YouTube visibility</Label>
            <select id="youtube-visibility" value={visibility} onChange={e => setVisibility(e.target.value as typeof visibility)} className="w-full rounded-md border bg-background p-2">
              <option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={madeForKids} onCheckedChange={value => setMadeForKids(value === true)} /> YouTube: made for kids</label>
          </div>}
          {platforms.includes('instagram') && <label className="flex items-center gap-2 text-sm"><Checkbox checked={shareToFeed} onCheckedChange={value => setShareToFeed(value === true)} /> Show Instagram Reel in feed</label>}
          {mode === 'schedule' && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="schedule-date">Date</Label><Input id="schedule-date" type="date" min={localToday()} value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><Label htmlFor="schedule-time">Time</Label><Input id="schedule-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div></div>
            <p className="text-xs text-muted-foreground">Default for every destination, unless customized above. Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}; channels dispatch as the worker runs.</p>
          </div>}
        </fieldset>
        {platforms.includes('tiktok') && <Alert><AlertDescription>TikTok receives the video in your inbox. Open TikTok to add the caption, choose visibility and finish publishing.</AlertDescription></Alert>}
        {errors.length > 0 && <ul className="text-sm text-destructive space-y-1" aria-live="polite">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
        {receipt && <div className="rounded-lg border p-3 space-y-3" aria-live="polite"><div className="flex justify-between"><h3 className="font-medium text-sm">Delivery results</h3><Link className="text-sm underline" to="/queue">Open Queue</Link></div>
          {receipt.results.map(result => <div key={result.accountId} className="text-sm flex items-start gap-2">
            {result.success ? <CheckCircle className="w-4 h-4 shrink-0 text-green-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />}
            <div><strong className="capitalize">{result.platform}</strong>: {result.success ? 'Published' : result.error || 'Check Queue for the current status.'}
              {result.postUrl && /^https:\/\//.test(result.postUrl) && <a className="ml-2 underline" href={result.postUrl} target="_blank" rel="noopener noreferrer">Open post</a>}
              {result.platform === 'tiktok' && result.needsUserAction && <Button size="sm" variant="outline" className="ml-2" onClick={() => navigator.clipboard.writeText(platformVariant(base, 'tiktok').content).then(() => toast({ title: 'TikTok caption copied' })).catch(handleError)}>Copy caption</Button>}
            </div>
          </div>)}
        </div>}
        <Button className="w-full" onClick={submit} disabled={busy || !selected.length || !!errors.length || (mode === 'schedule' && (!date || !time))}>
          {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : mode === 'schedule' ? <Calendar className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {mode === 'schedule' ? 'Schedule post' : !selected.length ? 'Select channels to publish' : `Publish to ${selected.length} Channel${selected.length === 1 ? '' : 's'}`}
        </Button>
      </CardContent>
    </Card>
    <Card className="self-start xl:sticky xl:top-20"><CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="preview-network">Preview network</Label>
        <select id="preview-network" className="w-full border rounded-md bg-background p-2" value={previewPlatform} onChange={e => setPreviewPlatform(e.target.value as Platform)}>
          {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => <option key={platform} value={platform}>{config.displayName}</option>)}
        </select>
        <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden flex items-center justify-center">
          {media?.type === 'video' ? <video controls playsInline src={media.url} className="h-full w-full object-contain" /> : media ? <img alt="Selected media" src={media.url} className="w-full h-full object-contain" /> : <span className="text-white/60 text-sm">Your 9:16 master video</span>}
        </div>
        {preview.videoTitle && <p className="font-medium text-sm">{preview.videoTitle}</p>}
        <p className="text-sm whitespace-pre-wrap break-words">{preview.content || 'Your caption preview'}</p>
        <p className="text-xs text-muted-foreground">Layout preview. The platform controls its final interface and processing.</p>
      </CardContent>
    </Card>
  </div>;
}
