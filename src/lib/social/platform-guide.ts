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
  copyRule: "First line becomes the YouTube title. Add the TikTok caption in the TikTok app.",
};

export const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    id: "youtube",
    name: "YouTube Shorts",
    maxDurationSec: 180,
    aspectRatio: "9:16 (vertical auto-detected)",
    maxSizeMB: 100,
    directPublish: true,
    tokenLifetime: "Access token 1h, refresh token indefinite (offline access)",
    reconnectCadence: "Reconnect when the provider expires or revokes the token",
    restrictions: [
      "Requires a YouTube channel on the connected Google account",
      "Vertical + ≤3min uploads are auto-classified as Shorts",
    ],
    checklist: [
      "MP4 H.264, ≤180s for Shorts eligibility",
      "First line of caption becomes the title",
      "ShortWork limit: 100 MiB; resumable upload",
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    maxDurationSec: 180,
    aspectRatio: "9:16",
    maxSizeMB: 100,
    directPublish: false,
    tokenLifetime: "Access 24h, refresh 365d",
    reconnectCadence: "Every ~12 months",
    restrictions: [
      "Video is sent to your TikTok inbox; publishing requires your action",
      "MP4/MOV/WEBM; chunked FILE_UPLOAD",
    ],
    checklist: [
      "Open the inbox notification in TikTok and finish publishing",
      "Set the caption and visibility in TikTok",
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
    maxSizeMB: 100,
    directPublish: true,
    tokenLifetime: "Page token (non-expiring when derived from long-lived user token)",
    reconnectCadence: "Rare — only on password reset or scope change",
    restrictions: [
      "Publishes to Pages you administer, not personal profiles",
      "Reels endpoint used when vertical + ≤90s; otherwise regular video",
    ],
    checklist: [
      "Vertical 9:16 for Reels distribution",
      "Upload a playable video so its dimensions and duration can be read",
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn Native Video",
    maxDurationSec: 180,
    aspectRatio: "9:16 or 16:9",
    maxSizeMB: 100,
    directPublish: true,
    tokenLifetime: "60 days",
    reconnectCadence: "Every 60 days (no programmatic refresh on standard apps)",
    restrictions: [
      "Uses the versioned LinkedIn Videos API",
      "Personal profiles; Company Pages are not implemented",
    ],
    checklist: [
      "Up to 100 MiB; wait for video processing before creating the post",
      "Reconnect before 60-day expiry to avoid queued failures",
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    maxDurationSec: 140,
    aspectRatio: "9:16 or 16:9",
    maxSizeMB: 100,
    directPublish: true,
    tokenLifetime: "Access 2h, refresh 6mo (rotated)",
    reconnectCadence: "Every ~6 months",
    restrictions: [
      "Requires media.write scope (reconnect once after this deploy)",
      "Account access, quota and billing depend on your X developer plan",
    ],
    checklist: [
      "MP4 H.264, ≤140s, ≤100 MiB",
      "Text ≤280 chars",
    ],
  },
  {
    id: "threads",
    name: "Threads",
    maxDurationSec: 180,
    aspectRatio: "9:16",
    maxSizeMB: 100,
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
    maxDurationSec: 180,
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
      "ShortWork profile: MP4 H.264, ≤180s, ≤100 MiB",
      "Text ≤300 chars",
    ],
  },
];
