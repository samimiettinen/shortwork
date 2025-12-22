import { useState } from "react";
import { 
  Accordion, AccordionContent, AccordionItem, AccordionTrigger 
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, HelpCircle, ExternalLink, RefreshCw, Shield, 
  Globe, Key, Clock, Ban, CheckCircle2, XCircle
} from "lucide-react";

interface TroubleshootingItem {
  id: string;
  error: string;
  platforms: string[];
  symptoms: string[];
  solutions: string[];
  links?: { label: string; url: string }[];
}

const troubleshootingData: TroubleshootingItem[] = [
  {
    id: "popup-blocked",
    error: "Pop-up Blocked",
    platforms: ["All"],
    symptoms: [
      "Nothing happens when clicking Connect",
      "Browser shows pop-up blocked notification",
      "OAuth window doesn't open"
    ],
    solutions: [
      "Allow pop-ups for this site in your browser settings",
      "Look for a pop-up blocked icon in your address bar and click it",
      "Disable pop-up blocker temporarily and try again",
      "Try a different browser if the issue persists"
    ]
  },
  {
    id: "access-denied",
    error: "Access Denied / Permission Error",
    platforms: ["Instagram", "Facebook"],
    symptoms: [
      "Error message: 'You don't have permission'",
      "OAuth flow completes but connection fails",
      "Can't select your page or account"
    ],
    solutions: [
      "Ensure you're an admin of the Facebook Page",
      "For Instagram: verify it's a Business or Creator account, not Personal",
      "Disconnect and reconnect your Instagram from Facebook in Meta Business Suite",
      "Check that all required permissions are granted during OAuth"
    ],
    links: [
      { label: "Convert Instagram to Business", url: "https://help.instagram.com/502981923235522" },
      { label: "Meta Business Suite", url: "https://business.facebook.com/settings" }
    ]
  },
  {
    id: "token-expired",
    error: "Token Expired / Session Invalid",
    platforms: ["All"],
    symptoms: [
      "Was working before, now shows 'needs_refresh'",
      "Publishing fails with authentication error",
      "Account shows as disconnected"
    ],
    solutions: [
      "Click 'Reconnect Now' or 'Refresh' on the affected account",
      "Complete the OAuth flow again to get a new token",
      "Some platforms (like Facebook) require re-authorization every 60 days",
      "Check if you changed your password on the platform recently"
    ]
  },
  {
    id: "invalid-redirect",
    error: "Invalid Redirect URI",
    platforms: ["All"],
    symptoms: [
      "Error: 'redirect_uri_mismatch'",
      "OAuth page shows configuration error",
      "Redirects to wrong URL after authorization"
    ],
    solutions: [
      "This is usually a configuration issue on the server side",
      "Contact support if you see this error consistently",
      "Try clearing browser cache and cookies",
      "Ensure you're using the correct domain (not localhost)"
    ]
  },
  {
    id: "rate-limited",
    error: "Rate Limited / Too Many Requests",
    platforms: ["X", "Instagram", "TikTok"],
    symptoms: [
      "Error: 'Rate limit exceeded'",
      "Connection works but fails after multiple attempts",
      "Temporary error message from platform"
    ],
    solutions: [
      "Wait 15-30 minutes before trying again",
      "Avoid rapid repeated connection attempts",
      "Check if you have other apps using the same account",
      "Consider upgrading to a business/professional account for higher limits"
    ]
  },
  {
    id: "account-type",
    error: "Wrong Account Type",
    platforms: ["Instagram", "LinkedIn", "TikTok"],
    symptoms: [
      "Connection succeeds but features are limited",
      "Can't access certain publishing features",
      "Auto-publish not available"
    ],
    solutions: [
      "Instagram: Must be Business or Creator account (not Personal)",
      "LinkedIn: Some features require Company Page admin access",
      "TikTok: Business accounts have more API features",
      "Upgrade your account type on the respective platform"
    ],
    links: [
      { label: "Instagram Account Types", url: "https://help.instagram.com/138925576505882" },
      { label: "LinkedIn Company Pages", url: "https://www.linkedin.com/help/linkedin/answer/710" }
    ]
  },
  {
    id: "network-error",
    error: "Network / Connection Error",
    platforms: ["All"],
    symptoms: [
      "OAuth window loads but then fails",
      "Timeout errors during connection",
      "Intermittent failures"
    ],
    solutions: [
      "Check your internet connection",
      "Disable VPN temporarily (some platforms block VPN IPs)",
      "Try again in a few minutes – the platform may be experiencing issues",
      "Check platform's status page for outages"
    ],
    links: [
      { label: "Meta Status", url: "https://metastatus.com" },
      { label: "X Status", url: "https://api.twitterstat.us" }
    ]
  },
  {
    id: "bluesky-auth",
    error: "Bluesky App Password Issues",
    platforms: ["Bluesky"],
    symptoms: [
      "Invalid identifier or password error",
      "Authentication failed message",
      "Can't create session"
    ],
    solutions: [
      "Use your full handle (e.g., yourname.bsky.social)",
      "Generate a NEW App Password – don't use your account password",
      "App Passwords are one-time visible – create a new one if lost",
      "Ensure the App Password hasn't been revoked"
    ],
    links: [
      { label: "Create App Password", url: "https://bsky.app/settings/app-passwords" }
    ]
  }
];

export const ConnectionTroubleshooting = () => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary" />
          Troubleshooting Connection Issues
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems}>
          {troubleshootingData.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                  <span className="font-medium">{item.error}</span>
                  <div className="flex gap-1 flex-wrap">
                    {item.platforms.map((platform) => (
                      <Badge key={platform} variant="outline" className="text-xs">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {/* Symptoms */}
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      Symptoms
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                      {item.symptoms.map((symptom, idx) => (
                        <li key={idx} className="list-disc">{symptom}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Solutions */}
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      Solutions
                    </h4>
                    <ul className="space-y-2 text-sm ml-6">
                      {item.solutions.map((solution, idx) => (
                        <li key={idx} className="list-decimal">{solution}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Helpful Links */}
                  {item.links && item.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {item.links.map((link, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-7 text-xs"
                        >
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            {link.label}
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Quick Tips */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm mb-3">Quick Tips</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-primary mt-0.5" />
              <span>Always use the official platform to authorize – never enter credentials on third-party sites</span>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-primary mt-0.5" />
              <span>Reconnect accounts periodically to prevent token expiration issues</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-primary mt-0.5" />
              <span>Some platforms take a few minutes to propagate permissions after account changes</span>
            </div>
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-primary mt-0.5" />
              <span>Disable browser extensions that might interfere with OAuth redirects</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
