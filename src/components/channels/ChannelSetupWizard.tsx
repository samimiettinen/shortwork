import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronRight, ChevronLeft, Check, ExternalLink, 
  Youtube, Instagram, Facebook, Linkedin, Twitter, Video, MessageCircle, Cloud,
  Shield, Key, UserCheck, Zap, Loader2, X
} from "lucide-react";
import { PLATFORM_CONFIG, ProviderName } from "@/lib/social/types";

interface ChannelSetupWizardProps {
  onConnect: (provider: ProviderName) => void;
  onBlueskyConnect: () => void;
  connecting: string | null;
  onCancelConnect?: () => void;
}

const platformIcons: Record<string, React.ReactNode> = {
  youtube: <Youtube className="w-6 h-6" />,
  instagram: <Instagram className="w-6 h-6" />,
  facebook: <Facebook className="w-6 h-6" />,
  linkedin: <Linkedin className="w-6 h-6" />,
  x: <Twitter className="w-6 h-6" />,
  tiktok: <Video className="w-6 h-6" />,
  threads: <MessageCircle className="w-6 h-6" />,
  bluesky: <Cloud className="w-6 h-6" />,
};

const platformRequirements: Record<string, { title: string; steps: string[]; link?: string; linkText?: string }> = {
  youtube: {
    title: "YouTube Setup",
    steps: [
      "Sign in to your Google account",
      "Ensure you have a YouTube channel created",
      "Click Connect to authorize channel access",
      "Grant permission to manage your videos"
    ],
    link: "https://www.youtube.com/account",
    linkText: "Create YouTube Channel"
  },
  instagram: {
    title: "Instagram Setup",
    steps: [
      "Convert to Business or Creator account in Instagram settings",
      "Connect your Instagram to a Facebook Page",
      "Ensure you're an admin of the connected Facebook Page",
      "Click Connect and log in with Facebook"
    ],
    link: "https://help.instagram.com/502981923235522",
    linkText: "Convert to Business Account"
  },
  facebook: {
    title: "Facebook Setup",
    steps: [
      "You need a Facebook Page (not a personal profile)",
      "Ensure you have admin access to the Page",
      "Click Connect and select your Page",
      "Grant publishing permissions"
    ],
    link: "https://www.facebook.com/pages/create",
    linkText: "Create Facebook Page"
  },
  linkedin: {
    title: "LinkedIn Setup",
    steps: [
      "Log in to your LinkedIn account",
      "For Company Pages: ensure you're an admin",
      "Click Connect to authorize",
      "Select profile or page to connect"
    ]
  },
  x: {
    title: "X (Twitter) Setup",
    steps: [
      "Log in to your X account",
      "Click Connect to authorize the app",
      "Grant permission to post on your behalf",
      "Works with personal and business accounts"
    ]
  },
  tiktok: {
    title: "TikTok Setup",
    steps: [
      "Log in to your TikTok account",
      "Click Connect to authorize",
      "Note: Some videos may need final approval in TikTok app",
      "Business accounts recommended for full features"
    ]
  },
  threads: {
    title: "Threads Setup",
    steps: [
      "Ensure you have an active Threads account",
      "Your Threads is linked to your Instagram",
      "Click Connect and authorize via Instagram/Facebook",
      "Grant posting permissions"
    ]
  },
  bluesky: {
    title: "Bluesky Setup",
    steps: [
      "Log in to Bluesky and go to Settings",
      "Navigate to App Passwords",
      "Create a new App Password",
      "Enter your handle and the generated password below"
    ],
    link: "https://bsky.app/settings/app-passwords",
    linkText: "Create App Password"
  }
};

export const ChannelSetupWizard = ({ onConnect, onBlueskyConnect, connecting, onCancelConnect }: ChannelSetupWizardProps) => {
  const [step, setStep] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState<ProviderName | null>(null);

  const platforms = Object.entries(PLATFORM_CONFIG) as [ProviderName, typeof PLATFORM_CONFIG[ProviderName]][];
  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const handlePlatformSelect = (platform: ProviderName) => {
    setSelectedPlatform(platform);
    setStep(1);
  };

  const handleConnect = () => {
    if (!selectedPlatform) return;
    if (selectedPlatform === 'bluesky') {
      onBlueskyConnect();
    } else {
      onConnect(selectedPlatform);
    }
  };

  const handleCancelConnect = () => {
    if (onCancelConnect) {
      onCancelConnect();
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-display font-bold mb-2">Welcome! Let's connect your first channel</h2>
              <p className="text-muted-foreground">Choose a social media platform to get started</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {platforms.map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handlePlatformSelect(key)}
                  className="p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all duration-200 flex flex-col items-center gap-2 group"
                >
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: config.color }}
                  >
                    {platformIcons[key]}
                  </div>
                  <span className="font-medium text-sm">{config.displayName}</span>
                  <Badge variant="outline" className="text-xs">
                    {config.oauthRequired ? 'OAuth' : 'App Password'}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        );

      case 1:
        if (!selectedPlatform) return null;
        const requirements = platformRequirements[selectedPlatform];
        const config = PLATFORM_CONFIG[selectedPlatform];
        
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: config.color }}
              >
                {platformIcons[selectedPlatform]}
              </div>
              <div>
                <h2 className="text-xl font-display font-bold">{requirements.title}</h2>
                <p className="text-muted-foreground text-sm">Follow these steps before connecting</p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {requirements.steps.map((stepText, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-sm font-medium">
                        {index + 1}
                      </div>
                      <p className="text-sm pt-0.5">{stepText}</p>
                    </div>
                  ))}
                </div>

                {requirements.link && (
                  <a 
                    href={requirements.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-6 flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {requirements.linkText}
                  </a>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Shield className="w-5 h-5 mx-auto mb-1 text-success" />
                <p className="text-xs text-muted-foreground">Secure OAuth</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Key className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Encrypted tokens</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <UserCheck className="w-5 h-5 mx-auto mb-1 text-warning" />
                <p className="text-xs text-muted-foreground">Revoke anytime</p>
              </div>
            </div>
          </div>
        );

      case 2:
        if (!selectedPlatform) return null;
        const finalConfig = PLATFORM_CONFIG[selectedPlatform];
        
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white mx-auto"
              style={{ backgroundColor: finalConfig.color }}
            >
              {platformIcons[selectedPlatform]}
            </div>
            
            <div>
              <h2 className="text-xl font-display font-bold mb-2">Ready to connect {finalConfig.displayName}</h2>
              <p className="text-muted-foreground text-sm">
                {selectedPlatform === 'bluesky' 
                  ? "You'll enter your Bluesky handle and App Password"
                  : "You'll be redirected to authorize the connection"
                }
              </p>
            </div>

            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <h4 className="font-medium mb-3">What we'll access:</h4>
                <ul className="space-y-2 text-sm text-left">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Basic account information
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Ability to create and publish posts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Analytics and engagement data
                  </li>
                </ul>
              </CardContent>
            </Card>

            {connecting === selectedPlatform ? (
              <div className="space-y-3">
                <Button 
                  size="lg" 
                  className="w-full"
                  disabled
                >
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting to {finalConfig.displayName}...
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={handleCancelConnect}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={handleConnect}
                  >
                    Retry Connection
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  If a popup opened, complete authorization there. If blocked, click Retry.
                </p>
              </div>
            ) : (
              <Button 
                size="lg" 
                className="w-full bg-gradient-primary hover:opacity-90"
                onClick={handleConnect}
              >
                Connect {finalConfig.displayName}
              </Button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-6">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Step {step + 1} of {totalSteps}</span>
            <span className="text-muted-foreground">
              {step === 0 && "Choose platform"}
              {step === 1 && "Requirements"}
              {step === 2 && "Connect"}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Navigation */}
        {step > 0 && (
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button 
              variant="ghost" 
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            {step < 2 && (
              <Button 
                onClick={() => setStep(step + 1)}
                className="bg-gradient-primary hover:opacity-90"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
