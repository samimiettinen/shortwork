import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Trash2, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const platforms = [
  { id: "instagram", name: "Instagram", color: "platform-instagram", autopublish: true },
  { id: "facebook", name: "Facebook", color: "platform-facebook", autopublish: true },
  { id: "linkedin", name: "LinkedIn", color: "platform-linkedin", autopublish: true },
  { id: "x", name: "X (Twitter)", color: "platform-x", autopublish: true },
  { id: "tiktok", name: "TikTok", color: "platform-tiktok", autopublish: false },
  { id: "bluesky", name: "Bluesky", color: "platform-bluesky", autopublish: true },
];

const Channels = () => {
  const { toast } = useToast();
  const [connectedChannels, setConnectedChannels] = useState<string[]>([]);

  const connectChannel = (platformId: string) => {
    setConnectedChannels([...connectedChannels, platformId]);
    toast({ title: "Channel Connected", description: `${platforms.find(p => p.id === platformId)?.name} connected successfully (mock)` });
  };

  const disconnectChannel = (platformId: string) => {
    setConnectedChannels(connectedChannels.filter(id => id !== platformId));
    toast({ title: "Channel Disconnected" });
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Channels</h1>
          <p className="text-muted-foreground mt-1">Connect your social media accounts</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.map((platform) => {
            const isConnected = connectedChannels.includes(platform.id);
            return (
              <Card key={platform.id} className="hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${platform.color} flex items-center justify-center text-primary-foreground font-bold`}>
                        {platform.name[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold">{platform.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {isConnected ? (
                            <Badge variant="outline" className="text-success border-success/30 bg-success/10"><Check className="w-3 h-3 mr-1" />Connected</Badge>
                          ) : (
                            <Badge variant="secondary">Not connected</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    {platform.autopublish ? (
                      <><Check className="w-3 h-3 text-success" /> Auto-publish supported</>
                    ) : (
                      <><AlertCircle className="w-3 h-3 text-warning" /> Manual publish only</>
                    )}
                  </div>

                  {isConnected ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1"><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
                      <Button variant="outline" size="sm" onClick={() => disconnectChannel(platform.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <Button className="w-full bg-gradient-primary hover:opacity-90" onClick={() => connectChannel(platform.id)}>
                      <Plus className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Channels;
