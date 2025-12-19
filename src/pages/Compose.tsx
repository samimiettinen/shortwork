import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { Calendar, Clock, Upload, Save, Send, Image, Video, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const platforms = [
  { id: "instagram", name: "Instagram", color: "platform-instagram", maxChars: 2200 },
  { id: "facebook", name: "Facebook", color: "platform-facebook", maxChars: 63206 },
  { id: "linkedin", name: "LinkedIn", color: "platform-linkedin", maxChars: 3000 },
  { id: "x", name: "X", color: "platform-x", maxChars: 280 },
  { id: "tiktok", name: "TikTok", color: "platform-tiktok", maxChars: 2200 },
  { id: "bluesky", name: "Bluesky", color: "platform-bluesky", maxChars: 300 },
];

const Compose = () => {
  const { handleSuccess } = useErrorHandler();
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    setFormError(null);
  };

  const validateForm = (action: string): boolean => {
    setFormError(null);
    
    if (!content.trim()) {
      setFormError("Please add some content to your post.");
      return false;
    }
    
    if (action !== "draft" && selectedPlatforms.length === 0) {
      setFormError("Please select at least one platform to publish to.");
      return false;
    }
    
    if (action === "schedule") {
      if (!scheduledDate) {
        setFormError("Please select a date for scheduling.");
        return false;
      }
      if (!scheduledTime) {
        setFormError("Please select a time for scheduling.");
        return false;
      }
      
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledDateTime <= new Date()) {
        setFormError("Scheduled time must be in the future.");
        return false;
      }
    }
    
    // Check character limits
    const overLimitPlatforms = selectedPlatforms.filter(platformId => {
      const platform = platforms.find(p => p.id === platformId);
      return platform && content.length > platform.maxChars;
    });
    
    if (overLimitPlatforms.length > 0) {
      const platformNames = overLimitPlatforms.map(id => 
        platforms.find(p => p.id === id)?.name
      ).join(", ");
      setFormError(`Content exceeds character limit for: ${platformNames}`);
      return false;
    }
    
    return true;
  };

  const handleSave = async (action: string) => {
    if (!validateForm(action)) return;
    
    setLoading(true);
    setSuccessMessage(null);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setLoading(false);
    
    if (action === "draft") {
      setSuccessMessage("Post saved as draft!");
      handleSuccess("Your post has been saved as a draft.");
    } else if (action === "schedule") {
      setSuccessMessage("Post scheduled successfully!");
      handleSuccess(`Your post is scheduled for ${scheduledDate} at ${scheduledTime}.`);
    } else {
      setSuccessMessage("Post queued for publishing!");
      handleSuccess("Your post has been queued and will be published shortly.");
    }
  };

  const getMinCharLimit = () => {
    if (selectedPlatforms.length === 0) return 2200;
    return Math.min(...selectedPlatforms.map(id => 
      platforms.find(p => p.id === id)?.maxChars || 2200
    ));
  };

  const isOverLimit = content.length > getMinCharLimit();

  return (
    <AppLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-8">Create Post</h1>

        {formError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-6 border-success/50 bg-success/10">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Content</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea 
                    placeholder="What's on your mind?" 
                    value={content} 
                    onChange={(e) => {
                      setContent(e.target.value);
                      setFormError(null);
                    }} 
                    className={`min-h-[150px] resize-none ${isOverLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    disabled={loading}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                      {content.length}/{getMinCharLimit()} characters
                      {selectedPlatforms.length > 0 && ` (limit for ${platforms.find(p => p.maxChars === getMinCharLimit())?.name})`}
                    </p>
                    {isOverLimit && (
                      <p className="text-xs text-destructive">Content too long for selected platforms</p>
                    )}
                  </div>
                </div>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Drop media here or click to upload</p>
                  <p className="text-sm text-muted-foreground mt-1">Supports images and videos up to 100MB</p>
                  <div className="flex justify-center gap-4 mt-4">
                    <Button variant="outline" size="sm" disabled={loading}>
                      <Image className="w-4 h-4 mr-2" />Image
                    </Button>
                    <Button variant="outline" size="sm" disabled={loading}>
                      <Video className="w-4 h-4 mr-2" />Video
                    </Button>
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
                      <Input 
                        type="date" 
                        value={scheduledDate} 
                        onChange={(e) => setScheduledDate(e.target.value)} 
                        className="pl-10"
                        min={new Date().toISOString().split('T')[0]}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Time</Label>
                    <div className="relative mt-1.5">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="time" 
                        value={scheduledTime} 
                        onChange={(e) => setScheduledTime(e.target.value)} 
                        className="pl-10"
                        disabled={loading}
                      />
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
                {platforms.map((platform) => {
                  const isOverPlatformLimit = content.length > platform.maxChars;
                  return (
                    <label 
                      key={platform.id} 
                      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors ${isOverPlatformLimit ? "opacity-60" : ""}`}
                    >
                      <Checkbox 
                        checked={selectedPlatforms.includes(platform.id)} 
                        onCheckedChange={() => togglePlatform(platform.id)}
                        disabled={loading}
                      />
                      <div className={`w-8 h-8 rounded-lg ${platform.color} flex items-center justify-center text-primary-foreground text-sm font-bold`}>
                        {platform.name[0]}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{platform.name}</span>
                        {isOverPlatformLimit && (
                          <p className="text-xs text-destructive">
                            {content.length - platform.maxChars} over limit
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button 
                className="w-full bg-gradient-primary hover:opacity-90" 
                onClick={() => handleSave("schedule")} 
                disabled={!content.trim() || selectedPlatforms.length === 0 || loading || isOverLimit}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                Schedule Post
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleSave("draft")} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Draft
              </Button>
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={() => handleSave("now")}
                disabled={!content.trim() || selectedPlatforms.length === 0 || loading || isOverLimit}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Publish Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Compose;
