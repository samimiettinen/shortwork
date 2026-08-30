export type ConnectionUiStatus = "connected" | "disconnected" | "expired";

export const CONNECTION_STATUS_LABEL: Record<ConnectionUiStatus, string> = {
  connected: "Yhdistetty",
  disconnected: "Katkaistu",
  expired: "Vanhentunut",
};

export interface AccountLike {
  platform: string;
  status: string;
}

export function connectionStatusForPlatform(
  platform: string,
  accounts: AccountLike[],
): ConnectionUiStatus {
  const matches = accounts.filter((a) => a.platform === platform);
  if (matches.length === 0) return "disconnected";
  if (matches.some((a) => a.status === "connected")) return "connected";
  if (matches.some((a) => a.status === "needs_refresh" || a.status === "error")) {
    return "expired";
  }
  return "disconnected";
}
