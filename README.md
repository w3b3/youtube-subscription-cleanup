# youtube-subscription-cleanup

A personal tool for organizing YouTube **channel subscriptions** into named groups, and toggling those groups on/off against YouTube in bulk. Not a video player. Not a feed reader. Just subscription hygiene.

> Status: requirements draft for a proof of concept. No implementation yet.

---

## 1. Problem

I use YouTube primarily to watch **long-form podcasts** while focused on other work. But over time my subscription list accumulates noise from unrelated contexts:

- My kids subscribe to cartoon / movie / comic channels from my account.
- I go through phases — e.g. a BJJ phase — and subscribe to many channels in that topic.
- I have used **multiple YouTube/Google profiles** in the past to keep these separate, but that has become unwieldy: subscriptions are scattered across accounts and there is no single place to see and reorganize them.

What I actually want is a mode switch on top of YouTube:

- **Podcast mode** — only my podcast subscriptions are active; everything else is dormant.
- **BJJ mode** — only BJJ channels active.
- **Kids mode** — only cartoons / movies / comics active.
- **None / clean mode** — everything dormant.

YouTube's native UI does not provide this. The Subscriptions page treats all subscriptions as one flat list, and unsubscribing loses the history of "I used to follow this; I might want it back."

## 2. Goal of the proof of concept

Build the smallest tool that lets me:

1. **See** every channel I am currently subscribed to (across one or more Google accounts), in one place.
2. **Tag / group** each channel into one or more named groups (e.g. `podcasts`, `bjj`, `kids`, `misc`).
3. **Toggle a group** active or inactive with a single click, where:
   - Activating a group → re-subscribes (on YouTube) every channel tagged with that group that is currently dormant.
   - Deactivating a group → unsubscribes (on YouTube) every channel tagged with that group.
4. **Soft-delete semantics on my side**: the app remembers every channel that has ever been tagged, even after it is unsubscribed from on YouTube. Re-enabling a group restores the real subscriptions on YouTube without me having to remember channel names or search for them again.

Out of scope for the POC (explicitly): watching videos, browsing playlists, recommending content, surfacing new uploads, or anything resembling a YouTube reader.

## 3. Core concepts (glossary)

| Term | Meaning |
|---|---|
| **Channel** | A YouTube channel I have subscribed to at some point. Identified by YouTube `channelId`. |
| **Subscription (real)** | The actual YouTube subscription record on a given Google account. Lives on YouTube's servers. Created by `subscriptions.insert`, destroyed by `subscriptions.delete`. |
| **Account** | A Google identity I have authorized the app to act on. The POC supports more than one. |
| **Group** | A user-defined label like `podcasts`. A channel may belong to zero, one, or many groups. |
| **Group state** | `active` or `dormant`. Set by the user. The app's job is to make YouTube reflect this state. |
| **Channel record (local)** | The app's persisted memory of a channel: id, title, thumbnail, account it was subscribed under, group tags, and whether it is currently subscribed on YouTube. This is the soft-delete layer. |
| **Sync** | The action of reconciling local intended state (which groups are active) with YouTube's real subscription list, by issuing the needed insert/delete API calls. |

## 4. User stories (POC scope)

1. **First-run import.** As the user, I sign in with one or more Google accounts. The app fetches every current subscription on each account and stores them as channel records with no group tags.
2. **Browse and tag.** I see a single list of all channels across all my accounts. For each channel I can assign one or more group tags. Tags are free-form; I create groups by typing a new name.
3. **View by group.** I can filter the list by group, by account, by "currently subscribed on YouTube", and by "untagged".
4. **Toggle a group off.** I click a switch on the `bjj` group. The app issues unsubscribe API calls for every BJJ-tagged channel that is currently subscribed. Local channel records remain; their "subscribed on YouTube" flag flips to false.
5. **Toggle a group on.** I click the switch back. The app issues subscribe API calls to restore them. The flag flips back to true.
6. **Mode switch (stretch within POC).** A "mode" is a saved combination of group states. Selecting `Podcast mode` deactivates every group except `podcasts` and activates `podcasts` — one click, one reconcile.
7. **Re-sync.** I can ask the app to re-read my actual subscriptions from YouTube to catch drift (e.g. I subscribed to a new channel directly on YouTube; it should show up as untagged).

## 5. Functional requirements

### 5.1 Authentication & accounts
- OAuth 2.0 against Google with the `youtube` scope (needed for read **and** subscribe/unsubscribe).
- Multiple accounts. The user can connect more than one Google account; the app keeps tokens per account.
- Refresh tokens stored locally; no third-party servers.

### 5.2 Subscription import
- On demand (button) and on first authorization, fetch the complete subscription list per account via `subscriptions.list?mine=true`.
- Handle pagination (YouTube returns 50 per page).
- For each subscription, persist: `channelId`, channel title, channel thumbnail URL, the account it belongs to, the YouTube `subscriptionId` (needed for `subscriptions.delete`), and timestamps.

### 5.3 Groups
- A channel may have zero, one, or many group tags.
- Groups are created implicitly by tagging.
- Groups have a single state: `active` (default) or `dormant`.
- Renaming and deleting groups is supported. Deleting a group does **not** delete channels or alter YouTube state — it just removes the tag.

### 5.4 Reconciliation
- "Apply" action computes a diff between **intended state** (per channel: should I be subscribed? = "channel has at least one active group tag, OR has no tags and the user has opted to keep untagged channels active") and **real state** on YouTube, then issues the minimal set of insert/delete calls.
- The reconciler is idempotent and resumable: interrupting it must not corrupt state. A re-run from the same intended state converges.
- Rate limit aware: respects YouTube Data API quota (default 10,000 units/day; `subscriptions.insert` costs 50 units, `subscriptions.delete` costs 50 units, `subscriptions.list` costs 1 unit per page). The app must (a) show estimated quota cost before applying, (b) batch / pace requests, and (c) handle quota-exceeded errors gracefully by pausing and surfacing the situation.

### 5.5 Local persistence
- All channel records, group tags, intended-state mappings, and tokens live in a local store (single file or embedded DB — decision deferred to planning).
- Schema is portable and exportable to JSON so I can back it up to my own systems.

### 5.6 UI
- Single-page web app or local desktop UI. Decision deferred to planning.
- One main view: filterable / searchable channel table with inline tag editing.
- One sidebar: list of groups with on/off switches and channel counts.
- One "Apply changes" / "Sync" affordance with a clear preview of what will happen ("Will unsubscribe 17 channels, will subscribe 4 channels, estimated quota cost: 1,050 / 10,000 daily units").

## 6. Non-functional requirements

- **Personal, single-user.** No multi-tenant, no public deployment, no analytics.
- **Local-first.** Tokens and data never leave my machine. If hosted, hosted on my own infrastructure (rv415 / xps15) behind Cloudflare Tunnel.
- **Reversible.** Every action the app takes against YouTube must be undoable by the inverse action (subscribe → unsubscribe and vice versa). No destructive operations beyond unsubscribe.
- **Honest about state.** The UI must always distinguish "intended state" from "last known YouTube state" so I can see drift.

## 7. Explicit non-goals (for the POC)

- No video playback, watch history, recommendations, or feed.
- No notifications about new uploads.
- No automatic re-tagging or ML-based grouping. Tags are manual.
- No mobile app. Desktop / browser only.
- No sharing groups with other users.
- No support for **playlist** management. The original phrasing mentioned "channels and playlists" — this POC is **channels only**. Playlists are a possible follow-on, not in scope.
- No merging of channels across accounts. If channel X is subscribed under two different accounts, it appears twice; toggling one does not toggle the other. (Reconsider in v2.)

## 8. Open questions to resolve before implementation planning

These are real ambiguities I want to nail down before we move to a plan. Not exhaustive — flagged here so they don't get assumed away.

1. **Hosting / form factor.** Local Electron app, local CLI + tiny web UI, or a small web app behind Cloudflare Tunnel on rv415? Each has different OAuth redirect implications.
2. **Storage engine.** SQLite vs a single JSON file. SQLite wins on integrity for the soft-delete log; JSON wins on simplicity for a POC.
3. **Untagged channels: active or dormant by default?** I lean "active by default" — newly discovered channels should not silently disappear from YouTube. Needs to be a user-visible setting either way.
4. **Quota strategy.** The YouTube Data API default daily quota is 10,000 units. A full reconcile that unsubscribes 100 channels and subscribes 100 others costs ~10,000 units by itself. The POC must surface this clearly; I may need to either request a higher quota or pace reconciles across days.
5. **Multiple accounts: one unified channel table or one tab per account?** Affects UI complexity meaningfully.
6. **Drift detection cadence.** Manual re-sync only, or a daily background refresh?
7. **What is "applied"?** Is there an explicit "Apply" button (preview → confirm → execute), or do toggles fire reconciles immediately? Preview is safer; immediate is more fluid. I lean preview for the POC.
8. **API constraint check.** Confirm that `subscriptions.insert` / `subscriptions.delete` work programmatically for personal accounts without additional Google verification. If Google has tightened the youtube scope recently, this POC may require an unverified-app warning screen at sign-in — acceptable, but worth knowing up front.

## 9. Definition of done for the POC

The POC is "done" when, in a single session, I can:

1. Sign in with at least two of my Google accounts.
2. See every channel I am subscribed to across them in one list.
3. Tag a meaningful subset of channels into at least three groups (`podcasts`, `bjj`, `kids`).
4. Deactivate `bjj` and `kids`, click Apply, and verify on YouTube.com that those channels are gone from my subscriptions on the relevant account(s).
5. Reactivate `bjj`, click Apply, and verify on YouTube.com that the BJJ channels are back.
6. Quit and relaunch the app and find all my tags and group states intact.

Everything beyond that — modes, polish, drift detection, playlists, cross-account dedup — is v2.

---

## 10. Out-of-band notes / risks

- **Quota is the most likely thing to bite us.** Plan the smallest viable test run (e.g. one group of ~10 channels) before doing a bulk operation across hundreds.
- **Google OAuth consent screen.** A personal-use unverified app is fine for me but introduces a "this app isn't verified" warning. Acceptable for a POC; document it so future-me doesn't think something is broken.
- **YouTube API deprecations.** The `subscriptions` endpoints have been stable for years but verify they are still in the v3 surface before planning.
- **Reversibility of unsubscribe.** Re-subscribing creates a new subscription record with a new `subscriptionId`; the original is not "restored". Local records must store `channelId` as the stable key, not `subscriptionId`.
