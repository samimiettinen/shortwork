// Static reference used by the Platforms page. Values reflect the API
// behaviors and video specs implemented in supabase/functions/_shared/publishers.ts
// and documented in docs/PLATFORM_SETUP.md.

export interface PlatformGuide {
  id: string;
  name: string;
  maxDurationSec: number;
  aspectRatio: string;
  maxSizeMB: number;
  directPublish: boolean;
  tokenLifetime: string;
  reconnectCadence: string;
  restrictions: string[];
  checklist: string[];
}

export const UNIVERSAL_FORMAT = {
  container: "MP4 (H.264 + AAC)",
  resolution: "1080 × 1920",
  aspectRatio: "9:16",
  maxDurationSec: 90,
  maxSizeMB: 100,
  copyRule: "First line of caption becomes the title on YouTube/TikTok.",
};

export const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    id: "youtube",
    name: "YouTube Shorts",
    maxDurationSec: 180,
    aspectRatio: "9:16 (vertical auto-detected)",
    maxSizeMB: 256000,
    directPublish: true,
    tokenLifetime: "Access token 1h, refresh token indefinite (offline access)",
    reconnectCadence: "Only if the user revokes access",
    restrictions: [
      "Requires a YouTube channel on the connected Google account",
      "Vertical + ≤3min uploads are auto-classified as Shorts",
    ],
    checklist: [
      "MP4 H.264, ≤180s for Shorts eligibility",
      "First line of caption becomes the title",
      "Uses resumable upload — large files supported",
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    maxDurationSec: 600,
    aspectRatio: "9:16",
    maxSizeMB: 4096,
    directPublish: true,
    tokenLifetime: "Access 24h, refresh 365d",
    reconnectCadence: "Every ~12 months",
    restrictions: [
      "Until the TikTok app passes the Content Posting audit, posts stay SELF_ONLY (private)",
      "MP4/MOV/WEBM; chunked FILE_UPLOAD",
    ],
    checklist: [
      "Verify the video in the TikTok app after audit approval",
      "First line = post caption",
    ],
  },
  {
    id: "instagram",
    name: "Instagram Reels",
    maxDurationSec: 90,
    aspectRatio: "9:16",
    maxSizeMB: 100,
    directPublish: true,
    tokenLifetime: "Long-lived user token 60d",
    reconnectCadence: "Every ~60 days",
    restrictions: [
      "Requires Instagram Business/Creator linked to a Facebook Page",
      "Video must be publicly reachable via HTTPS URL",
    ],
    checklist: [
      "9:16 vertical MP4, ≤90s, ≤100MB",
      "First line of caption becomes the caption",
    ],
  },
  {
    id: "facebook",
    name: "Facebook Reels / Page Video",
    maxDurationSec: 90,
    aspectRatio: "9:16 for Reels, any for page video",
    maxSizeMB: 4096,
    directPublish: true,
    tokenLifetime: "Page token (non-expiring when derived from long-lived user token)",
    reconnectCadence: "Rare — only on password reset or scope change",
    restrictions: [
      "Publishes to Pages you administer, not personal profiles",
      "Reels endpoint used when vertical + ≤90s; otherwise regular video",
    ],
    checklist: [
      "Vertical 9:16 for Reels distribution",
      "Provide mediaMeta (width/height/duration) so backend routes correctly",
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn Native Video",
    maxDurationSec: 600,
    aspectRatio: "9:16 or 16:9",
    maxSizeMB: 5120,
    directPublish: true,
    tokenLifetime: "60 days",
    reconnectCadence: "Every 60 days (no programmatic refresh on standard apps)",
    restrictions: [
      "Uses LinkedIn Videos API with LinkedIn-Version: 202506",
      "Personal profile or Company Page (admin required)",
    ],
    checklist: [
      "Under 5GB; the backend handles initialize/upload/finalize",
      "Reconnect before 60-day expiry to avoid queued failures",
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    maxDurationSec: 140,
    aspectRatio: "9:16 or 16:9",
    maxSizeMB: 512,
    directPublish: true,
    tokenLifetime: "Access 2h, refresh 6mo (rotated)",
    reconnectCadence: "Every ~6 months",
    restrictions: [
      "Requires media.write scope (reconnect once after this deploy)",
      "Free tier has low daily post + upload caps",
    ],
    checklist: [
      "MP4 H.264, ≤140s, ≤512MB",
      "Text ≤280 chars",
    ],
  },
  {
    id: "threads",
    name: "Threads",
    maxDurationSec: 300,
    aspectRatio: "9:16",
    maxSizeMB: 1024,
    directPublish: true,
    tokenLifetime: "Long-lived 60d",
    reconnectCadence: "Auto-refreshes before expiry; reconnect only if it lapses",
    restrictions: [
      "Requires Threads account (linked to Instagram)",
      "VIDEO container + publish two-step",
    ],
    checklist: [
      "Text ≤500 chars",
      "Vertical 9:16 for best distribution",
    ],
  },
  {
    id: "bluesky",
    name: "Bluesky",
    maxDurationSec: 60,
    aspectRatio: "9:16 or 1:1",
    maxSizeMB: 100,
    directPublish: true,
    tokenLifetime: "Session ~1h; refresh token used automatically",
    reconnectCadence: "Rare — only if app-password rotates",
    restrictions: [
      "Uses App Password (not OAuth)",
      "Video service audience did:web:video.bsky.app",
    ],
    checklist: [
      "MP4 H.264, ≤60s, ≤100MB",
      "Text ≤300 chars",
    ],
  },
];
