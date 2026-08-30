import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PRIORITY_CONNECT_PLATFORMS,
  SOCIAL_PROVIDERS,
  type SocialProviderId,
} from "@/config/socialProviders";
import {
  CONNECTION_STATUS_LABEL,
  connectionStatusForPlatform,
  type ConnectionUiStatus,
} from "@/lib/social/connection-status";
import { PLATFORM_CONFIG, type ProviderName } from "@/lib/social/types";
import {
  Check,
  Facebook,
  Instagram,
  Link2,
  Loader2,
  ShieldCheck,
  Video,
  Youtube,
} from "lucide-react";

export interface SocialConnectAccount {
  id: string;
  platform: ProviderName;
  display_name: string;
  handle: string | null;
  status: string;
}

interface SocialConnectCardsProps {
  accounts: SocialConnectAccount[];
  connecting: string | null;
  verifyingId?: string | null;
  onConnect: (provider: ProviderName) => void;
  onVerify?: (accountId: string, platform: ProviderName) => void;
  platforms?: readonly SocialProviderId[];
}

const platformIcons: Record<string, React.ReactNode> = {
  youtube: <Youtube className="w-5 h-5" />,
  instagram: <Instagram className="w-5 h-5" />,
  facebook: <Facebook className="w-5 h-5" />,
  tiktok: <Video className="w-5 h-5" />,
};

const statusBadgeClass: Record<ConnectionUiStatus, string> = {
  connected: "text-success border-success/30 bg-success/10",
  expired: "text-warning border-warning/30 bg-warning/10",
  disconnected: "text-muted-foreground border-border bg-muted/40",
};

export function SocialConnectCards({
  accounts,
  connecting,
  verifyingId,
  onConnect,
  onVerify,
  platforms = PRIORITY_CONNECT_PLATFORMS,
}: SocialConnectCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {platforms.map((platform) => {
        const provider = SOCIAL_PROVIDERS[platform];
        const ui = PLATFORM_CONFIG[platform];
        const status = connectionStatusForPlatform(platform, accounts);
        const matches = accounts.filter((a) => a.platform === platform);
        const primary = matches[0];
        const busy = connecting === platform;

        return (
          <Card key={platform} className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: ui?.color || "#666" }}
                  >
                    {platformIcons[platform] || platform[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{provider.displayName}</h3>
                    {primary ? (
                      <p className="text-sm text-muted-foreground truncate max-w-[160px]">
                        {primary.handle || primary.display_name}
                        {matches.length > 1 ? ` +${matches.length - 1}` : ""}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Ei yhdistettyä tiliä</p>
                    )}
                  </div>
                </div>
              </div>

              <Badge variant="outline" className={statusBadgeClass[status]}>
                {status === "connected" && <Check className="w-3 h-3 mr-1" />}
                {CONNECTION_STATUS_LABEL[status]}
              </Badge>

              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-gradient-primary hover:opacity-90"
                  size="sm"
                  onClick={() => onConnect(platform)}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-1" />
                  )}
                  {status === "disconnected" ? "Yhdistä tili" : "Yhdistä uudelleen"}
                </Button>
                {primary && onVerify && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVerify(primary.id, platform)}
                    disabled={verifyingId === primary.id}
                    title="Testaa julkaisulupa"
                  >
                    {verifyingId === primary.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
