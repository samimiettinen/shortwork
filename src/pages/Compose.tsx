import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, Upload, Save, Send, Image, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const platforms = [
  { id: "instagram", name: "Instagram", color: "platform-instagram" },
  { id: "facebook", name: "Facebook", color: "platform-facebook" },
  { id: "linkedin", name: "LinkedIn", color: "platform-linkedin" },
  { id: "x", name: "X", color: "platform-x" },
  { id: "tiktok", name: "TikTok", color: "platform-tiktok" },
  { id: "bluesky", name: "Bluesky", color: "platform-bluesky" },
];

const Compose = () => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSave = (action: string) => {
    toast({ title: action === "draft" ? "Saved as Draft" : action === "schedule" ? "Post Scheduled!" : "Publishing...", description: `Your post has been ${action === "draft" ? "saved" : action === "schedule" ? "scheduled" : "queued"}` });
  };

  return (
    <AppLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-8">Create Post</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Content</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea placeholder="What's on your mind?" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[150px] resize-none" />
                  <p className="text-xs text-muted-foreground mt-2">{content.length}/2200 characters</p>
                </div>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Drop media here or click to upload</p>
                  <p className="text-sm text-muted-foreground mt-1">Supports images and videos up to 100MB</p>
                  <div className="flex justify-center gap-4 mt-4">
                    <Button variant="outline" size="sm"><Image className="w-4 h-4 mr-2" />Image</Button>
                    <Button variant="outline" size="sm"><Video className="w-4 h-4 mr-2" />Video</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <div className="relative mt-1.5">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <div>
                    <Label>Time</Label>
                    <div className="relative mt-1.5">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Platforms</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {platforms.map((platform) => (
                  <label key={platform.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                    <Checkbox checked={selectedPlatforms.includes(platform.id)} onCheckedChange={() => togglePlatform(platform.id)} />
                    <div className={`w-8 h-8 rounded-lg ${platform.color} flex items-center justify-center text-primary-foreground text-sm font-bold`}>{platform.name[0]}</div>
                    <span className="font-medium">{platform.name}</span>
                  </label>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button className="w-full bg-gradient-primary hover:opacity-90" onClick={() => handleSave("schedule")} disabled={!content || selectedPlatforms.length === 0}>
                <Calendar className="w-4 h-4 mr-2" /> Schedule Post
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSave("draft")}>
                <Save className="w-4 h-4 mr-2" /> Save Draft
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => handleSave("now")}>
                <Send className="w-4 h-4 mr-2" /> Publish Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Compose;
