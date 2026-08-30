import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_PROVIDERS, type SocialProviderId } from "@/config/socialProviders";
import { Loader2 } from "lucide-react";

function isProvider(value: string | undefined): value is SocialProviderId {
  return !!value && value in SOCIAL_PROVIDERS;
}

/**
 * SPA landing page for `/api/auth/callback/:provider`.
 *
 * Vite/Lovable has no Next.js route handlers. The provider posts the
 * authorization code here; this page forwards it to `social-auth/exchange`
 * so client secrets never leave the edge function.
 */
const OAuthCallback = () => {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Viimeistellään kirjautumista…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description") || error;

    const go = (path: string) => {
      window.history.replaceState({}, "", path.split("?")[0]);
      navigate(path, { replace: true });
    };

    if (!isProvider(provider)) {
      go(`/channels?error=${encodeURIComponent("unsupported_provider")}`);
      return;
    }

    if (error) {
      go(`/channels?error=${encodeURIComponent(errorDescription || "oauth_denied")}`);
      return;
    }

    if (!code || !state) {
      go(`/channels?error=${encodeURIComponent("missing_code")}`);
      return;
    }

    const run = async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          `social-auth/exchange/${provider}`,
          { body: { code, state } },
        );

        if (invokeError) throw invokeError;

        if (data?.redirectTo) {
          const target = new URL(data.redirectTo, window.location.origin);
          go(`${target.pathname}${target.search}`);
          return;
        }

        if (data?.success) {
          go(`/channels?connected=${provider}`);
          return;
        }

        go(`/channels?error=${encodeURIComponent(data?.error || "callback_failed")}`);
      } catch (err) {
        const text = err instanceof Error ? err.message : "callback_failed";
        setMessage("Yhteyden muodostus epäonnistui.");
        go(`/channels?error=${encodeURIComponent(text)}`);
      }
    };

    void run();
  }, [navigate, provider, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
