# One vertical master: Metricool reference and ShortWork implementation

Research date: 2026-10-30. This is a feature analysis of Metricool’s public documentation. It does not claim access to Metricool’s private code, internal APIs or account-specific behavior.

## Public workflow observed

Metricool documents selecting several networks, adding media and text, configuring network options, previewing, and then publishing immediately or scheduling. Its planner uses one common publishing time; its MCP workflow can create separate network posts with different captions and times. Sources: [planner workflow](https://help.metricool.com/how-to-schedule-content-from-the-calendar-q8ymv), [network-specific scheduling](https://help.metricool.com/how-to-schedule-a-post-at-different-times-on-each-network-using-metricools-mcp-8tmhd).

The published feature matrix includes network-dependent titles, covers, first comments and settings. YouTube exposes audience and visibility; Instagram exposes feed sharing. Metricool lists video publishing for ten networks, including Pinterest and Google Business Profile. [Network options](https://help.metricool.com/scheduling-and-posting-options-by-social-network-cwmb3).

Metricool recommends MP4 and validates visible media properties before scheduling, while some codec checks happen at the destination. Its connector limits should not be treated as permanent limits of the underlying platforms. [Media requirements](https://help.metricool.com/publishing-requirements-for-images-and-videos-from-metricool-vfc8n).

## Implementation mapping

| Capability | ShortWork implementation in this change |
| --- | --- |
| One master asset | One workspace upload and storage path shared by all targets. Switching Publish/Schedule preserves it. |
| Select destinations | Select all connected accounts or a subset. A per-network readiness check blocks invalid requests. |
| Adapt copy | Master caption/title plus network-specific caption/title overrides; shortening X does not overwrite LinkedIn or YouTube copy. |
| Preview | Vertical media playback and the resolved caption/title for the selected network. This previews content, not an exact replica of native interfaces. |
| Short-video mode | Default Reel/Short mode requires a 9:16 MP4. Facebook Reel eligibility is checked explicitly. |
| Network settings | YouTube privacy and made-for-kids value; Instagram feed sharing; TikTok inbox handoff and caption copy. |
| Publish now | One request dispatches the selected targets and saves separate outcomes. |
| Schedule | A default local time, optional per-network times, and one job per account, created atomically. |
| Delivery review | Published links, partial outcomes, manual actions, interruptions and cancellation before dispatch. |
| Retry control | Stable request IDs and no automatic replay of uncertain provider side effects. |

The initial network scope is ShortWork’s existing eight: YouTube, Instagram, Facebook, TikTok, LinkedIn, X, Threads and Bluesky. Pinterest and Google Business Profile need new account connectors and publishing adapters before they can be included. They are not shown as working destinations.

## Concrete publishing flow

1. Upload a ready vertical master once. For this app’s current eight routes including Facebook Reels, use MP4/H.264/AAC, 1080 × 1920, 4–90 seconds, up to 100 MiB. The app validates dimensions, duration, type and size; it does not transcode or prove the codecs from the filename.
2. Select all connected channels. Enter the main caption and optional title.
3. Open network customizations to shorten or adapt copy. Review the selected network’s preview and settings.
4. Publish now, or choose a default time and override individual network times where useful.
5. Review every target in Queue. Finish TikTok in its app using the saved caption. A handoff or interrupted request is not a published post.

## Remaining differences

This work focuses on one video across connected networks. It does not implement Metricool’s cover-image tools, first-comment automation, video editing/transcoding, trending music, product/collaborator tags, best-time recommendations, recurrence, CSV imports, new approval flows or Pinterest/Google Business adapters. Those need separate API capability checks and implementation; they must not be represented by nonfunctional controls.

Provider approvals, credentials, quotas, paid access and real-account delivery remain deployment checks. The current dependency conflicts and audit findings also remain release gates. See [dependency status](DEPENDENCY_STATUS.md) and [deployment setup](PLATFORM_SETUP.md).
