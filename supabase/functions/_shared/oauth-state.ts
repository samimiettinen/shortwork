import { createHmac } from "node:crypto";

// OAuth state tokens are HMAC-signed so the callback can trust the
// workspace/user identifiers round-tripped through the provider.
const STATE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface OAuthState {
  userId: string;
  workspaceId: string;
  provider: string;
  returnUrl: string;
  codeVerifier?: string;
  iat: number;
}

function signingKey(): string {
  return Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function b64urlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

function hmac(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function encodeState(state: Omit<OAuthState, 'iat'>): string {
  const payload = b64urlEncode(JSON.stringify({ ...state, iat: Date.now() }));
  return `${payload}.${hmac(payload)}`;
}

export function decodeState(token: string): OAuthState | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = hmac(payload);
  if (signature.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const state = JSON.parse(b64urlDecode(payload)) as OAuthState;
    if (!state.iat || Date.now() - state.iat > STATE_TTL_MS) return null;
    return state;
  } catch {
    return null;
  }
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64urlEncode(String.fromCharCode(...bytes));
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64urlEncode(String.fromCharCode(...new Uint8Array(digest)));
}
