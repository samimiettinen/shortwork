import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, ExternalLink, Zap, BarChart3, Users } from "lucide-react";
import { PLATFORM_GUIDES, UNIVERSAL_FORMAT } from "@/lib/social/platform-guide";

const Platforms = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Platform Guide</h1>
          <p className="text-muted-foreground mt-1">
            Where to publish short videos and what each platform expects.
          </p>
        </div>

        <Alert className="mb-6 border-primary/40 bg-primary/5">
          <Zap className="w-4 h-4" />
          <AlertDescription>
            <strong>Universal format that publishes cleanly to every platform:</strong>{" "}
            {UNIVERSAL_FORMAT.container}, {UNIVERSAL_FORMAT.resolution}{" "}
            ({UNIVERSAL_FORMAT.aspectRatio}), ≤{UNIVERSAL_FORMAT.maxDurationSec}s,
            ≤{UNIVERSAL_FORMAT.maxSizeMB}MB. {UNIVERSAL_FORMAT.copyRule}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          {PLATFORM_GUIDES.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  {p.directPublish && <Badge variant="secondary">Direct publish</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Max duration</div>
                    <div>{p.maxDurationSec}s</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Aspect ratio</div>
                    <div>{p.aspectRatio}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Max size</div>
                    <div>{p.maxSizeMB >= 1024 ? `${(p.maxSizeMB/1024).toFixed(1)}GB` : `${p.maxSizeMB}MB`}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Token lifetime</div>
                    <div className="text-xs">{p.tokenLifetime}</div>
                  </div>
                </div>

                {p.restrictions.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Restrictions</div>
                    <ul className="text-sm space-y-1">
                      {p.restrictions.map((r, i) => (
                        <li key={i} className="text-muted-foreground">• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Checklist</div>
                  <ul className="text-sm space-y-1">
                    {p.checklist.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to="/channels">
                      <Users className="w-4 h-4 mr-1" /> Connect
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to="/analytics">
                      <BarChart3 className="w-4 h-4 mr-1" /> Analytics
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Platforms;
