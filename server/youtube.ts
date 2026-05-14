import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { QUOTA_COST, recordQuota } from "./quota.js";

export interface RemoteSubscription {
  channel_id: string;
  subscription_id: string;
  title: string;
  thumbnail_url: string | null;
}

export async function listAllSubscriptions(auth: OAuth2Client): Promise<RemoteSubscription[]> {
  const yt = google.youtube({ version: "v3", auth });
  const out: RemoteSubscription[] = [];
  let pageToken: string | undefined;
  do {
    const resp = await yt.subscriptions.list({
      part: ["snippet"],
      mine: true,
      maxResults: 50,
      pageToken,
    });
    recordQuota(QUOTA_COST.subscriptionsListPage);
    for (const item of resp.data.items ?? []) {
      const channelId = item.snippet?.resourceId?.channelId;
      const subId = item.id;
      if (!channelId || !subId) continue;
      out.push({
        channel_id: channelId,
        subscription_id: subId,
        title: item.snippet?.title ?? "(untitled)",
        thumbnail_url:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
      });
    }
    pageToken = resp.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export type DeleteOutcome = "success" | "stale_404" | "error";

export async function deleteSubscription(
  auth: OAuth2Client,
  subscriptionId: string
): Promise<{ outcome: DeleteOutcome; error?: string }> {
  const yt = google.youtube({ version: "v3", auth });
  try {
    await yt.subscriptions.delete({ id: subscriptionId });
    recordQuota(QUOTA_COST.subscriptionsDelete);
    return { outcome: "success" };
  } catch (err: any) {
    const code = err?.code ?? err?.response?.status;
    recordQuota(QUOTA_COST.subscriptionsDelete);
    if (code === 404) return { outcome: "stale_404" };
    return { outcome: "error", error: err?.message ?? String(err) };
  }
}
