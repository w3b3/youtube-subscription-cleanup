export type ChannelStatus = "subscribed" | "unsubscribed";

export interface Channel {
  channel_id: string;
  subscription_id: string | null;
  title: string;
  thumbnail_url: string | null;
  status: ChannelStatus;
  bucket_id: number | null;
  first_seen_at: number;
  last_seen_at: number;
  unsubscribed_at: number | null;
}

export interface Bucket {
  id: number;
  name: string;
  position: number;
  created_at: number;
  channel_count?: number;
  subscribed_count?: number;
}

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  unsubscribed_externally: number;
  total_subscribed: number;
}

export interface UnsubscribePreview {
  bucket_id: number;
  bucket_name: string;
  channels: Array<Pick<Channel, "channel_id" | "title" | "thumbnail_url">>;
  estimated_quota_units: number;
  daily_quota_remaining_estimate: number;
}

export type UnsubscribeResult = "success" | "stale_404" | "error";

export interface UnsubscribeProgressEvent {
  channel_id: string;
  title: string;
  result: UnsubscribeResult;
  error?: string;
}

export interface UnsubscribeSummary {
  done: true;
  total: number;
  success: number;
  stale_404: number;
  error: number;
}

export interface UnsubscribeLogEntry {
  id: number;
  channel_id: string;
  channel_title_snapshot: string;
  bucket_name_snapshot: string | null;
  attempted_at: number;
  result: UnsubscribeResult;
  error_message: string | null;
}

export interface UnsubscribeLogResponse {
  entries: UnsubscribeLogEntry[];
  summary: Array<{ result: UnsubscribeResult; count: number }>;
}
