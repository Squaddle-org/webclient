# webclient

Browser client for Squaddle - TypeScript + vanilla UI, no framework (ADR-0009). Protocol logic
lives entirely in `org.squaddle:core`'s `js` target; this repo is UI, local bookkeeping
(IndexedDB), and browser-platform glue only.

## Development

```bash
# core's js target must be built first (from ../core):
#   SQUADDLE_SPEC_DIR=../spec ./gradlew jsBrowserProductionLibraryDistribution
npm install
npm run dev        # http://localhost:4173
npm run typecheck
npm test           # vitest - some integration tests need a local relay, see e2e/global-setup.ts
npm run e2e         # playwright - builds and runs a real relay binary from ../relay
npm run build
```

## Feature parity with android

This client targets feature parity with the android app, flow for flow, using
`android/MANUAL_TESTING.md` and `android/RELEASE.md`'s smoke-test steps as the checklist. Three
items are intentionally platform-specific substitutes rather than ports (a browser has no
equivalent of the android mechanism), and one (biometric app-lock) is intentionally out of scope
with no substitute at all.

| Feature | android | web | notes |
|---|---|---|---|
| Create / restore identity (seed phrase) | ✅ | ✅ | Same BIP39 mnemonic, same core identity code. |
| Restore from backup file | ✅ (SAF) | ✅ | See "Backup/restore" row below for the file-handling substitution. |
| Rooms list, create room | ✅ | ✅ | |
| Join via link | ✅ (App Link, confirm screen) | ✅ | Confirm screen before joining; approval-required invites supported (join request sent, shows as pending). |
| Ideas: create/vote/edit/delete | ✅ | ✅ | Vote is -1/0/1 (down/none/up), same as android's `VoteControl`. |
| Comments: add/delete | ✅ | ✅ | |
| Events: create/edit/cancel | ✅ | ✅ | |
| RSVP (yes/no/maybe) | ✅ | ✅ | |
| Add event to calendar | ✅ (`CalendarContract` intent into a device calendar app) | ✅ (`.ics` file download) | **Platform substitute.** A browser has no calendar-provider API; the generated `.ics` (same UID scheme, same field mapping as android's `CalendarExport.kt`) is handed to the OS via a normal file download, which opens in whatever calendar app the user has registered for `.ics`. |
| Member management (kick/promote/demote/transfer/approve/reject) | ✅ | ✅ | Same gating rules (`MembersViewModel`'s `can*` flags ported exactly). |
| Invite controls (expiry / max uses / requires-approval) | ✅ | ✅ | |
| Room limits + voucher redemption | ✅ | ✅ | |
| Profile / display name | ✅ | ✅ | Stored locally, re-applied to every known room on save (same `applyStoredDisplayName` pattern as android). |
| Relay host override | ✅ (developer settings) | ✅ (Settings) | |
| Backup / restore | ✅ (Storage Access Framework: pick a destination in Drive/Nextcloud/local storage) | ✅ (browser file download for backup, `<input type=file>` for restore) | **Platform substitute.** No SAF in a browser; same `BackupApi`/PROTOCOL.md §7 codec either way (same Argon2 params), so a backup file is cross-client compatible - a file created on android restores on web and vice versa. |
| Push notifications | ✅ (UnifiedPush + WorkManager background sync) | ✅ (Web Push + Service Worker) | **Platform substitute.** Same relay contract (`GET /push/vapid`, `POST`/`DELETE /push`) and the same content-free push design (ADR-0013/PROTOCOL.md §6: a push never carries room content) - the service worker only ever shows a generic "something changed" notification, same posture as android building its real notification from a post-sync diff, never the push payload. |
| Localization (EN/DE) | ✅ | ✅ | Same 164 string keys and copy as `strings.xml`/`values-de/strings.xml`, reused verbatim. |
| Design tokens (colors, type, shapes, avatars, empty states) | ✅ (Phase H design pass) | ✅ | Same hex values, same Fraunces/Inter font files (self-hosted, no CDN), same avatar hash/HSL/initials/geometric-mark algorithm, same empty-state illustration geometry. |
| Install referrer attribution | ✅ (Play/F-Droid install source) | — | Not applicable - a web app has no install-source concept. |
| Self-update checker | ✅ (`github` flavor only - manual "Check for updates") | — | Not applicable - a browser always serves the currently-deployed version; there is no APK to self-update. |
| Biometric app-lock | ✅ (`BiometricPrompt`) | — | **Out of scope, no substitute.** No equivalent trust model exists for a web page without WebAuthn, which is a materially different mechanism (platform authenticator binding, not a simple re-auth gate) - left out rather than faked with a weaker passphrase-only lock. |

**Known pre-existing limitation, not introduced by this parity pass**: `RoomSessionOrchestrator`
talks to a single relay host for the lifetime of the page (`SessionApi.open`'s one `RelaySession`),
not per-room. A room whose stored `relayHost` differs from the currently-configured one (e.g.
after restoring a backup that lists rooms from several relays) will show in the Rooms list but
its `pull`/push calls silently target the wrong host. Multi-relay-per-session support would be a
real architecture change (android's `RealSyncGateway.syncClientForRoom` already does this
correctly, building a fresh `SyncClient` per relay host on demand) - tracked as a follow-up, not
attempted here to avoid scope creep on top of the parity work itself.
