# youtube-subscription-cleanup

A personal tool to **list, visually group, and bulk-unsubscribe** YouTube channel subscriptions on a single Google account. Not a video player. Not a feed reader. Not a mode switcher.

> Status: requirements draft for a proof of concept. No implementation yet.

---

## 1. Problem

I am subscribed to hundreds of YouTube channels on my main Google account. They accumulated over years and across contexts — podcasts I follow, BJJ phases, kids subscribing to cartoons from my account, one-off topical interests. YouTube's native Subscriptions page is a flat list with no way to:

- See everything I'm subscribed to in a single visual layout
- Group channels by my own categories
- Unsubscribe many channels at once based on a category

I want to do a one-time cleanup pass: pull every subscription, visually sort them into buckets, and bulk-unsubscribe the buckets I no longer want. After that, my main YouTube profile reflects only the channels I actually care about.

## 2. Goal of the proof of concept

Build the smallest tool that lets me, against **one Google account at a time**:

1. **Import** the full list of channels I am subscribed to.
2. **Group** those channels visually by drag-and-drop into named buckets on screen.
3. **Persist** that grouping locally so it survives across sessions.
4. **Bulk-unsubscribe** every channel in a chosen bucket, with one click and an explicit confirmation.

That's it. After the unsubscribe, the local record of each channel still exists (channel id, title, which bucket it was in, when it was unsubscribed) so I have a permanent log of what I removed.

## 3. Explicit non-goals for the POC

These are real features that belong to v2, not v1. Listed explicitly so they do not creep in:

- **No re-subscribe.** The tool only unsubscribes. If I want a channel back I do it manually on YouTube. The local record exists for my reference, not for one-click restore.
- **No mode switching / toggling groups on and off.** Earlier drafts framed this as a daily mode switcher; that was wrong. This is a one-time cleanup tool.
- **No multi-account.** One Google account per session. Re-authenticate as a different account to do another pass.
- **No cross-profile import** ("unsubscribe from my main, re-subscribe on my kids' profile"). That is v2.
- **No playlist management.** Channels only.
- **No video playback, feed, recommendations, or new-upload notifications.**
- **No automatic / ML-based grouping.** All grouping is manual drag-and-drop.

## 4. Core concepts

| Term | Meaning |
|---|---|
| **Channel** | A YouTube channel I am or was subscribed to, identified by its permanent `channelId`. |
| **Subscription** | The actual YouTube subscription record on my account. Has a volatile `subscriptionId` (used only for the unsubscribe API call). The `channelId` is the stable key. |
| **Bucket** (a.k.a. group) | A user-named visual container on screen (e.g. `Podcasts`, `BJJ`, `Kids — keep`, `Kids — remove`). A channel lives in zero or one bucket. |
| **Ungrouped** | The default bucket where all imported channels start. |
| **Unsubscribe action** | A bulk operation against one bucket: the tool issues `subscriptions.delete` for every channel in that bucket. After success, the channels stay in their bucket as a record but are marked `unsubscribed` and visually de-emphasized. |

## 5. User flow

1. **Sign in.** I authorize the app against my Google account with the `youtube` scope (needed for both list and unsubscribe).
2. **Import.** App fetches all subscriptions via `subscriptions.list?mine=true` (paginated, 50 per page). For each, it stores `channelId`, `subscriptionId`, title, thumbnail. All channels land in the `Ungrouped` bucket.
3. **Group.** I see all channels as draggable tiles, with `Ungrouped` as a large canvas at the top. I create buckets (free-form name), and drag-and-drop tiles into them. Each tile shows thumbnail + channel title. Buckets show channel count.
4. **Save state.** Grouping is persisted continuously to local storage. I can quit and resume.
5. **Bulk unsubscribe.** Each bucket has a button: `Unsubscribe all in "<bucket name>"`. Clicking it:
   - Shows a confirmation listing exactly which channels are about to be unsubscribed and an estimated API quota cost.
   - On confirm, runs the unsubscribe calls in sequence with progress.
   - On success, marks each channel as `unsubscribed` locally. Channels remain in their bucket as a strikethrough or grayed-out tile.
6. **Re-sync (manual).** A "Refresh from YouTube" action re-reads my current subscription list. Any channels I subscribed to via YouTube directly since the last import appear in `Ungrouped`. Any channels I unsubscribed via YouTube directly are marked `unsubscribed` to keep the local view honest.

## 6. Functional requirements

### 6.1 Authentication
- OAuth 2.0 against Google with the `youtube` scope.
- Single account at a time. Tokens stored locally; no third-party servers.

### 6.2 Import
- Full pagination of `subscriptions.list?mine=true`.
- Persist `channelId` (stable, primary key), current `subscriptionId`, title, thumbnail URL, first-seen timestamp.
- Idempotent: a re-import does not duplicate channels.

### 6.3 Grouping UI
- All channels visible as draggable tiles (thumbnail + title).
- An "Ungrouped" bucket holds all newly imported channels.
- User can create, rename, and delete buckets. Deleting a non-empty bucket moves its channels back to `Ungrouped`. Deleting a bucket never affects YouTube state.
- A channel belongs to at most one bucket.
- Search / filter by channel title.

### 6.4 Local persistence
- Single local data store (SQLite). Schema covers: channels, buckets, channel→bucket assignment, unsubscribe history (timestamp + bucket-at-time-of-unsubscribe).
- Exportable to JSON for backup.

### 6.5 Bulk unsubscribe
- One action per bucket: "Unsubscribe all".
- Two-step: preview (list of channels + quota estimate) → confirm → execute.
- Issues `subscriptions.delete` calls keyed by the stored `subscriptionId`. If a `subscriptionId` is stale (the user already unsubscribed elsewhere), the API will 404 — the tool treats that as success and moves on.
- Sequential execution with progress and a clear stop button.
- Respects API quota: hard-stops before exceeding the daily budget rather than risking a mid-batch failure. Resumable on the next day if needed.

### 6.6 Drift (manual refresh)
- A refresh button re-fetches the subscription list and reconciles:
  - New channels on YouTube → appear in `Ungrouped` as not-yet-grouped.
  - Channels no longer on YouTube → marked `unsubscribed` locally (kept in their bucket as record).
- No automatic background polling.

## 7. Non-functional requirements

- **Personal, single-user, local-first.** Runs on my laptop on `http://localhost:<port>`. Tokens never leave the machine.
- **Honest about state.** UI distinguishes `subscribed` from `unsubscribed` tiles visually. Buckets show counts of each.
- **No silent destructive action.** Every unsubscribe is preceded by an explicit, scoped confirmation. No "apply all groups" master button.
- **Reversibility caveat.** The tool itself does not re-subscribe. The local record exists so I can manually restore on YouTube if I regret an unsubscribe.

## 8. Quota note (the constraint that shapes the tool)

YouTube Data API default quota is 10,000 units/day per project. `subscriptions.delete` costs **50 units**, so the practical ceiling is roughly **200 unsubscribes per day** on the default quota. `subscriptions.list` costs 1 unit per page, negligible.

For hundreds of subscriptions to unsubscribe, this is workable but worth knowing:
- The tool must show estimated quota cost on the confirmation screen.
- A large bucket may need to be split across days, or done in one pass after requesting a quota increase from Google.
- This constraint is why the tool is framed as **one-time cleanup**, not ongoing management.

## 9. Open questions to resolve before planning

1. **Form factor.** Local Node web app on `http://localhost`, or a small CLI + local web UI? I lean web app for the drag-and-drop UX — drag-and-drop in a terminal is not a thing.
2. **OAuth flow for an unverified personal app.** The `youtube` scope is "sensitive" per Google. For personal use under the unverified-app cap this works but shows a warning screen. Confirm with a 5-minute live test that `subscriptions.delete` actually executes from an unverified app against my own account before committing.
3. **Drag-and-drop library.** Browser-native HTML5 DnD vs a library (e.g. `@dnd-kit`). Decide during planning based on form-factor choice.
4. **Tile density.** Hundreds of tiles in a single view needs either virtualized scrolling or a compact tile design. Worth deciding the layout target (grid vs. lanes) before building.
5. **What counts as a "successful" unsubscribe for a stale `subscriptionId`?** Probably: treat 404 as success and refresh that channel's state from YouTube. Confirm during planning.

## 10. Definition of done for the POC

In a single session, against one of my Google accounts, I can:

1. Sign in.
2. Import my full subscription list (hundreds of channels) into `Ungrouped`.
3. Create at least three buckets and drag at least 30 channels into them via the UI.
4. Quit and relaunch; buckets and assignments are intact.
5. Pick one bucket, hit "Unsubscribe all", confirm, and observe progress to completion.
6. Verify on YouTube.com that those channels are gone from my subscriptions.
7. See those channels in my local view as grayed-out / `unsubscribed` tiles in their original bucket.

Anything beyond that — re-subscribe, multi-account, cross-profile import, modes, playlists — is v2 and explicitly not in this POC.
