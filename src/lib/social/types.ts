// Social Provider Types
export type ProviderName = 'youtube' | 'instagram' | 'facebook' | 'linkedin' | 'x' | 'tiktok' | 'threads' | 'bluesky';

export interface ProviderAccountData {
  provider: ProviderName;
  providerAccountId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountType: 'personal' | 'page' | 'business' | 'creator';
  autopublishCapable: boolean;
  metadata?: Record<string, unknown>;
}

export interface PublishOptions {
  accountId: string;
  accessToken: string;
  content: string;
  linkUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface SocialProvider {
  name: ProviderName;
  displayName: string;
  color: string;
  icon: string;
  supportsOAuth: boolean;
  
  // OAuth methods (for OAuth-based providers)
  getAuthUrl?(state: string, redirectUri: string): string;
  handleCallback?(code: string, redirectUri: string): Promise<ProviderAccountData>;
  refreshAccessToken?(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }>;
  
  // Direct auth methods (for non-OAuth like Bluesky)
  authenticateDirect?(credentials: Record<string, string>): Promise<ProviderAccountData>;
  
  // Publishing
  publish(options: PublishOptions): Promise<PublishResult>;
  
  // Validation
  validateContent?(content: string): { valid: boolean; errors: string[] };
  getContentLimits(): { maxLength: number; supportsImages: boolean; supportsVideo: boolean; supportsLinks: boolean };
}

// Provider registry
const providers: Map<ProviderName, SocialProvider> = new Map();

export function registerProvider(provider: SocialProvider) {
  providers.set(provider.name, provider);
}

export function getProvider(name: ProviderName): SocialProvider | undefined {
  return providers.get(name);
}

export function getAllProviders(): SocialProvider[] {
  return Array.from(providers.values());
}

// Platform metadata for UI
export const PLATFORM_CONFIG: Record<ProviderName, {
  displayName: string;
  color: string;
  bgClass: string;
  maxLength: number;
  supportsImages: boolean;
  supportsVideo: boolean;
  supportsLinks: boolean;
  oauthRequired: boolean;
  setupInstructions: string;
}> = {
  youtube: {
    displayName: 'YouTube',
    color: '#FF0000',
    bgClass: 'platform-youtube',
    maxLength: 5000,
    supportsImages: false,
    supportsVideo: true,
    supportsLinks: true,
    oauthRequired: true,
    setupInstructions: 'Requires Google Cloud project with YouTube Data API v3 enabled'
  },
  instagram: {
    displayName: 'Instagram',
    color: '#E4405F',
    bgClass: 'platform-instagram',
    maxLength: 2200,
    supportsImages: true,
    supportsVideo: true,
    supportsLinks: false, // Links in bio only
    oauthRequired: true,
    setupInstructions: 'Requires Meta Business account and Instagram Professional account'
  },
  facebook: {
    displayName: 'Facebook',
    color: '#1877F2',
    bgClass: 'platform-facebook',
    maxLength: 63206,
    supportsImages: true,
    supportsVideo: true,
    supportsLinks: true,
    oauthRequired: true,
    setupInstructions: 'Connect your Facebook Page to publish content'
  },
  linkedin: {
    displayName: 'LinkedIn',
    color: '#0A66C2',
    bgClass: 'platform-linkedin',
    maxLength: 3000,
    supportsImages: true,
    supportsVideo: true,
    supportsLinks: true,
    oauthRequired: true,
    setupInstructions: 'Connect your LinkedIn profile or Company Page'
  },
  x: {
    displayName: 'X (Twitter)',
    color: '#000000',
    bgClass: 'platform-x',
    maxLength: 280,
    supportsImages: true,
    supportsVideo: true,
    supportsLinks: true,
    oauthRequired: true,
    setupInstructions: 'Requires X Developer account with OAuth 2.0 credentials'
  },
  tiktok: {
    displayName: 'TikTok',
    color: '#000000',
    bgClass: 'platform-tiktok',
    maxLength: 2200,
    supportsImages: false,
    supportsVideo: true,
    supportsLinks: false,
    oauthRequired: true,
    setupInstructions: 'Requires TikTok for Developers account'
  },
  threads: {
    displayName: 'Threads',
    color: '#000000',
    bgClass: 'platform-x',
    maxLength: 500,
    supportsImages: true,
    supportsVideo: true,
    supportsLinks: true,
    oauthRequired: true,
    setupInstructions: 'Requires Meta Business account with Threads API access'
  },
  bluesky: {
    displayName: 'Bluesky',
    color: '#0085FF',
    bgClass: 'platform-bluesky',
    maxLength: 300,
    supportsImages: true,
    supportsVideo: false,
    supportsLinks: true,
    oauthRequired: false,
    setupInstructions: 'Use your Bluesky handle and an App Password'
  }
};
